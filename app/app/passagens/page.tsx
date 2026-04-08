'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type TipoPassagem = 'PRA FRENTE' | 'REEMBOLSO' | 'MG' | 'NÃO TEM'

interface Func { id: string; nome: string; equipe: string }
interface Obra { id: string; codigo: string; nome: string }
interface Passagem { id: string; funcionario_id: string; obra_id: string; tipo_passagem: TipoPassagem; valor_passagem: number }

export default function PassagensPage() {
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [mes, setMes] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [funcs, setFuncs] = useState<Func[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [passagens, setPassagens] = useState<Record<string, Passagem>>({})
  const [obrasComPresenca, setObrasComPresenca] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [msg, setMsg] = useState('')
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => { carregar() }, [equipe, mes])

  async function carregar() {
    setLoading(true)
    const [{ data: fs }, { data: os }] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,equipe').eq('equipe', equipe).eq('ativo', true).order('nome'),
      supabase.from('obras').select('id,codigo,nome').eq('status', 'ATIVA').order('nome'),
    ])
    setFuncs(fs || [])
    setObras(os || [])

    // Buscar passagens filtradas por equipe
    if (fs && fs.length > 0) {
      const ids = fs.map((f: any) => f.id)
      const { data: pass } = await supabase
        .from('funcionario_obra_passagem')
        .select('id,funcionario_id,obra_id,tipo_passagem,valor_passagem')
        .in('funcionario_id', ids)
      const mapa: Record<string, Passagem> = {}
      pass?.forEach((p: any) => { mapa[`${p.funcionario_id}|${p.obra_id}`] = p })
      setPassagens(mapa)

      // Obras com presença neste mês para esta equipe
      const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
      if (comp?.id) {
        const { data: pres } = await supabase
          .from('presencas')
          .select('funcionario_id,obra_id,obra2_id')
          .eq('competencia_id', comp.id)
          .in('funcionario_id', ids)
        const obraSet = new Set<string>()
        pres?.forEach((p: any) => {
          if (p.obra_id) obraSet.add(`${p.funcionario_id}|${p.obra_id}`)
          if (p.obra2_id) obraSet.add(`${p.funcionario_id}|${p.obra2_id}`)
        })
        setObrasComPresenca(obraSet)
      }
    }
    setLoading(false)
  }

  function getPass(funcId: string, obraId: string): Passagem | undefined {
    return passagens[`${funcId}|${obraId}`]
  }

  function getTipoFunc(funcId: string): TipoPassagem {
    const passFunc = obras.map(o => getPass(funcId, o.id)).filter(Boolean)
    if (passFunc.length === 0) return 'MG'
    // Pegar o tipo mais comum
    const tipos = passFunc.map(p => p!.tipo_passagem)
    const counts: Record<string, number> = {}
    tipos.forEach(t => { counts[t] = (counts[t] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as TipoPassagem
  }

  async function salvarTipoFunc(funcId: string, tipo: TipoPassagem) {
    setSalvando(funcId)
    // Atualizar tipo em todas as obras deste funcionário
    for (const obra of obras) {
      const p = getPass(funcId, obra.id)
      if (p) {
        await supabase.from('funcionario_obra_passagem')
          .update({ tipo_passagem: tipo, valor_passagem: (tipo === 'MG' || tipo === 'NÃO TEM') ? 0 : p.valor_passagem })
          .eq('id', p.id)
      } else {
        await supabase.from('funcionario_obra_passagem').insert({
          funcionario_id: funcId, obra_id: obra.id,
          tipo_passagem: tipo, valor_passagem: 0,
        })
      }
    }
    // Atualizar só os itens modificados localmente
    const { data: novos } = await supabase.from('funcionario_obra_passagem')
      .select('*').eq('funcionario_id', funcId)
    setPassagens(prev => {
      const next = { ...prev }
      ;(novos || []).forEach((p: any) => { next[p.funcionario_id + '_' + p.obra_id] = p })
      return next
    })
    setSalvando(null)
  }

  async function salvarValor(funcId: string, obraId: string, valorStr: string) {
    const valor = parseFloat(valorStr.replace(',', '.')) || 0
    const p = getPass(funcId, obraId)
    const tipo = getTipoFunc(funcId)
    if (p) {
      await supabase.from('funcionario_obra_passagem')
        .update({ valor_passagem: valor }).eq('id', p.id)
      // Atualizar só esse item localmente
      setPassagens(prev => ({ ...prev, [funcId + '_' + obraId]: { ...p, valor_passagem: valor } }))
    } else {
      const { data: novo } = await supabase.from('funcionario_obra_passagem').insert({
        funcionario_id: funcId, obra_id: obraId,
        tipo_passagem: tipo, valor_passagem: valor,
      }).select().single()
      if (novo) setPassagens(prev => ({ ...prev, [funcId + '_' + obraId]: novo }))
    }
  }

  const funcsFiltradas = funcs.filter(f => !busca || f.nome.toLowerCase().includes(busca.toLowerCase()))
  const btnEq = (eq: 'ARMAÇÃO' | 'CARPINTARIA') => ({
    padding: '7px 18px', borderRadius: 8, border: '2px solid #1a3a5c', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: equipe === eq ? '#1a3a5c' : '#fff', color: equipe === eq ? '#fff' : '#1a3a5c',
  })

  // Meses disponíveis
  const mesesOpts = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, i, 1)
    return `2026-${String(i + 1).padStart(2, '0')}`
  })
  const nomeMes: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
  }

  return (
    <div>
      {/* BOTÕES EQUIPE */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btnEq('ARMAÇÃO')} onClick={() => setEquipe('ARMAÇÃO')}>
          Armação ({equipe === 'ARMAÇÃO' ? funcs.length : '...'})
        </button>
        <button style={btnEq('CARPINTARIA')} onClick={() => setEquipe('CARPINTARIA')}>
          Carpintaria ({equipe === 'CARPINTARIA' ? funcs.length : '...'})
        </button>
        <select value={mes} onChange={e => setMes(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
          {mesesOpts.map(m => (
            <option key={m} value={m}>{nomeMes[m.split('-')[1]]} 2026</option>
          ))}
        </select>
      </div>

      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c', marginBottom: 4 }}>
        Matriz de Passagens — {equipe}
      </h1>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
        Obras com fundo <span style={{ background: '#dbeafe', padding: '1px 6px', borderRadius: 4, color: '#1e40af', fontWeight: 600 }}>azul</span> = funcionário teve presença neste mês. Digite o valor direto na célula.
      </p>

      {msg && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#14532d', fontSize: 13 }}>{msg}</div>}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
        <input type="text" placeholder="🔍 Buscar funcionário..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, width: 260 }} />
        <span style={{ marginLeft: 16, fontSize: 12, color: '#9ca3af' }}>
          {funcs.length} funcionários × {obras.length} obras
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 'calc(100vh - 320px)' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th style={{ background: '#1a3a5c', color: '#fff', padding: '8px 12px', textAlign: 'left', minWidth: 210, position: 'sticky', left: 0, zIndex: 20, fontSize: 11 }}>
                  Funcionário
                </th>
                <th style={{ background: '#1a3a5c', color: '#fff', padding: '8px 10px', minWidth: 130, position: 'sticky', left: 210, zIndex: 20, fontSize: 11 }}>
                  Tipo Passagem
                </th>
                {obras.map(o => (
                  <th key={o.id} style={{ background: '#1a3a5c', color: '#fff', padding: '8px 6px', minWidth: 90, textAlign: 'center', fontSize: 10 }}>
                    {o.codigo}<br />
                    <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 9 }}>{o.nome.substring(0, 10)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {funcsFiltradas.map((func, fi) => {
                const bg = fi % 2 === 0 ? '#fff' : '#f9fafb'
                const tipoAtual = getTipoFunc(func.id)
                const isMgOuNaoTem = tipoAtual === 'MG' || tipoAtual === 'NÃO TEM'
                return (
                  <tr key={func.id} style={{ background: bg }}>
                    {/* Nome */}
                    <td style={{ padding: '6px 12px', fontWeight: 600, color: '#1a3a5c', position: 'sticky', left: 0, background: bg, zIndex: 1, borderRight: '1px solid #e5e7eb', fontSize: 12, minWidth: 210, whiteSpace: 'nowrap' }}>
                      {salvando === func.id ? '⏳ ' : ''}{func.nome}
                    </td>
                    {/* Tipo */}
                    <td style={{ padding: '4px 8px', position: 'sticky', left: 210, background: bg, zIndex: 1, borderRight: '2px solid #1a3a5c', minWidth: 130 }}>
                      <select
                        value={tipoAtual}
                        onChange={e => salvarTipoFunc(func.id, e.target.value as TipoPassagem)}
                        disabled={salvando === func.id}
                        style={{
                          width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 6px', fontSize: 11, cursor: 'pointer',
                          background: tipoAtual === 'PRA FRENTE' ? '#dbeafe' : tipoAtual === 'REEMBOLSO' ? '#fef9c3' : tipoAtual === 'NÃO TEM' ? '#f3f4f6' : '#fff',
                          color: tipoAtual === 'PRA FRENTE' ? '#1e40af' : tipoAtual === 'REEMBOLSO' ? '#854d0e' : '#374151',
                          fontWeight: 600,
                        }}>
                        <option value="MG">MG (sem passagem)</option>
                        <option value="PRA FRENTE">Pra Frente</option>
                        <option value="REEMBOLSO">Reembolso</option>
                        <option value="NÃO TEM">Não Tem</option>
                      </select>
                    </td>
                    {/* Células de valor por obra */}
                    {obras.map(obra => {
                      const p = getPass(func.id, obra.id)
                      const temPresenca = obrasComPresenca.has(`${func.id}|${obra.id}`)
                      const key = `${func.id}|${obra.id}`
                      return (
                        <td key={obra.id} style={{
                          padding: '2px 4px', minWidth: 90,
                          background: temPresenca ? '#dbeafe' : bg,
                          borderBottom: '1px solid #f3f4f6',
                          borderLeft: temPresenca ? '2px solid #93c5fd' : undefined,
                        }}>
                          {isMgOuNaoTem ? (
                            <div style={{ textAlign: 'center', fontSize: 10, color: '#9ca3af', padding: '4px 0' }}>
                              {temPresenca ? <span style={{ color: '#1e40af', fontWeight: 700 }}>—</span> : '—'}
                            </div>
                          ) : (
                            <input
                              ref={el => { inputRefs.current[key] = el }}
                              type="number"
                              step="0.01"
                              defaultValue={p?.valor_passagem || ''}
                              placeholder={temPresenca ? '⚠' : '0'}
                              onBlur={e => {
                                const val = e.target.value
                                if (val !== String(p?.valor_passagem || '')) {
                                  salvarValor(func.id, obra.id, val)
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === 'Tab') {
                                  const val = (e.target as HTMLInputElement).value
                                  if (val !== String(p?.valor_passagem || '')) {
                                    salvarValor(func.id, obra.id, val)
                                  }
                                }
                              }}
                              style={{
                                width: '100%', border: 'none', background: 'transparent',
                                textAlign: 'center', fontSize: 12, padding: '4px 2px',
                                outline: 'none', fontWeight: p?.valor_passagem ? 700 : 400,
                                color: temPresenca && !p?.valor_passagem ? '#dc2626' : '#1a3a5c',
                              }}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda */}
      <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
        <span><span style={{ background: '#dbeafe', padding: '2px 8px', borderRadius: 4, color: '#1e40af', fontWeight: 600 }}>azul</span> = teve presença neste mês</span>
        <span><span style={{ color: '#dc2626', fontWeight: 700 }}>vermelho</span> = tem presença mas sem valor cadastrado</span>
        <span>Pressione <strong>Enter</strong> ou <strong>Tab</strong> para salvar o valor</span>
      </div>
    </div>
  )
}
