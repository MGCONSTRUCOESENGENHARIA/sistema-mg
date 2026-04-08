'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Func { id: string; nome: string; equipe: string }
interface Obra { id: string; nome: string; codigo: string }
type Status = 'PRESENTE' | 'FALTA' | 'AUSENTE' | 'ATESTADO' | 'SAIU' | 'X' | null

export default function LancamentoRapidoPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [funcs, setFuncs] = useState<Func[]>([])
  const [obraId, setObraId] = useState('')
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [marcacoes, setMarcacoes] = useState<Record<string, Status>>({})
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [busca, setBusca] = useState('')
  const [tipoDiaria, setTipoDiaria] = useState<'NORMAL' | 'CONTA_MG' | 'CONTA_OBRA'>('NORMAL')

  useEffect(() => {
    supabase.from('obras').select('id,nome,codigo').eq('status', 'ATIVA').order('nome').then(({ data: d }) => setObras(d || []))
  }, [])

  useEffect(() => {
    const dataAtual = data
    supabase.from('funcionarios').select('id,nome,equipe').eq('equipe', equipe).eq('ativo', true).order('nome')
      .then(({ data: d }) => { 
        const lista = d || []
        setFuncs(lista)
        setMarcacoes({})
        carregarExistentes(lista, dataAtual)
      })
  }, [equipe, data])

  async function carregarExistentes(fs: Func[], dataAtual: string) {
    if (!fs.length) return
    const mes = dataAtual.slice(0, 7)
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    if (!comp?.id) { setMarcacoes({}); return }
    const { data: pres } = await supabase.from('presencas')
      .select('funcionario_id,tipo,obra_id')
      .eq('competencia_id', comp.id)
      .eq('data', dataAtual)
      .in('funcionario_id', fs.map(f => f.id))
    const map: Record<string, Status> = {}
    ;(pres || []).forEach((p: any) => {
      if (p.tipo === 'FALTA') map[p.funcionario_id] = 'FALTA'
      else if (p.tipo === 'ATESTADO') map[p.funcionario_id] = 'ATESTADO'
      else if (p.tipo === 'AUSENTE') map[p.funcionario_id] = 'AUSENTE'
      else if (p.tipo === 'SAIU') map[p.funcionario_id] = 'SAIU'
      else if (p.obra_id) map[p.funcionario_id] = 'PRESENTE'
    })
    setMarcacoes(map)
  }

  function toggle(funcId: string, status: Status) {
    setMarcacoes(prev => ({ ...prev, [funcId]: prev[funcId] === status ? null : status }))
  }

  function marcarTodos(status: Status) {
    const novo: Record<string, Status> = {}
    funcsFiltradas.forEach(f => { novo[f.id] = status })
    setMarcacoes(prev => ({ ...prev, ...novo }))
  }

  async function salvar() {
    const marcacoesAtivas = Object.entries(marcacoes).filter(([_, s]) => s !== null)
    if (marcacoesAtivas.length === 0) { setMsg('⚠️ Nenhuma marcação feita.'); setTimeout(() => setMsg(''), 3000); return }
    const temPresente = marcacoesAtivas.some(([_, s]) => s === 'PRESENTE')
    const soTemX = marcacoesAtivas.every(([_, s]) => s === 'X')
    if (temPresente && !obraId && !soTemX) {
      setMsg('⚠️ Selecione a obra — obrigatório para presentes.'); setTimeout(() => setMsg(''), 4000); return
    }
    setSalvando(true)
    
    const mes = data.slice(0, 7)
    let { data: comp } = await supabase.from('competencias').select('id,status').eq('mes_ano', mes).maybeSingle()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status: 'ABERTA' }).select().single()
      comp = nova
    }
    if (!comp?.id) { setMsg('⚠️ Erro ao obter competência.'); setSalvando(false); return }
    
    let count = 0
    let erros = 0
    
    console.log('Salvando - obraId:', obraId, 'comp.id:', comp.id, 'data:', data)
    for (const [funcId, status] of marcacoesAtivas) {
      const tipo = status === 'PRESENTE' ? 'NORMAL' : status
      const obraParaSalvar = status === 'PRESENTE' ? obraId : null
      const { error } = await supabase.from('presencas').upsert({
        competencia_id: comp.id,
        funcionario_id: funcId,
        data,
        tipo,
        obra_id: obraParaSalvar || null,
        fracao: 1,
      }, { onConflict: 'funcionario_id,data,competencia_id' })
      if (error) { console.error('Upsert error:', error.message, error.details); erros++ } else count++
    }
    
    // Salvar diárias extras se for conta MG ou conta Obra
    if (tipoDiaria !== 'NORMAL' && obraId && count > 0) {
      for (const [funcId, status] of marcacoesAtivas) {
        if (status !== 'PRESENTE') continue
        // Buscar valor_diaria do funcionário
        const func = funcs.find(f => f.id === funcId)
        await supabase.from('diarias_extras').insert({
          obra_id: obraId,
          funcionario_id: funcId,
          data,
          tipo: tipoDiaria,
          quantidade: 1,
          servico: '',
          descontada_producao: false,
          recebida_medicao: false,
        })
      }
    }

    if (erros > 0) setMsg(`⚠️ Salvos: ${count}, Erros: ${erros}. Verifique o console.`)
    else setMsg(`✅ ${count} lançamentos salvos na grade!${tipoDiaria !== 'NORMAL' ? ` (${tipoDiaria === 'CONTA_MG' ? 'Conta MG' : 'Conta Obra'} registrado em Engenharia)` : ''}`)
    setTimeout(() => setMsg(''), 4000)
    
    await carregarExistentes(funcs, data)
    setSalvando(false)
  }

  const funcsFiltradas = funcs.filter(f => !busca || f.nome.toLowerCase().includes(busca.toLowerCase()))
  const presentes = Object.values(marcacoes).filter(s => s === 'PRESENTE').length
  const faltas = Object.values(marcacoes).filter(s => s === 'FALTA').length
  const outros = Object.values(marcacoes).filter(s => s && s !== 'PRESENTE' && s !== 'FALTA').length
  const semMarcacao = funcs.length - Object.values(marcacoes).filter(Boolean).length

  const Btn = ({ funcId, status, label, bg, color, border }: any) => {
    const ativo = marcacoes[funcId] === status
    return (
      <button onClick={() => toggle(funcId, status)} style={{
        padding: '7px 14px', borderRadius: 8, border: `2px solid ${ativo ? border : '#e5e7eb'}`,
        background: ativo ? bg : 'white', color: ativo ? color : '#9ca3af',
        cursor: 'pointer', fontSize: 12, fontWeight: ativo ? 700 : 400, transition: 'all .1s', whiteSpace: 'nowrap',
      }}>{label}</button>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>Lançamento Rápido</h1>
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Selecione data e obra, marque cada funcionário com um clique e salve tudo de uma vez</p>
      </div>

      {/* Configuração */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Equipe</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
                <button key={eq} onClick={() => setEquipe(eq)} style={{
                  padding: '9px 14px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  borderColor: equipe === eq ? '#7c3aed' : '#e5e7eb',
                  background: equipe === eq ? '#7c3aed' : 'white',
                  color: equipe === eq ? 'white' : '#6b7280',
                }}>{eq === 'ARMAÇÃO' ? 'Armação' : 'Carpintaria'}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Obra (para presentes)</label>
            <select value={obraId} onChange={e => setObraId(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none' }}>
              <option value="">Selecione a obra...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Tipo de Diária</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { val: 'NORMAL', label: '✅ Normal', bg: '#f0fdf4', color: '#166534', border: '#059669' },
              { val: 'CONTA_MG', label: '🏢 Conta MG', bg: '#eff6ff', color: '#1e40af', border: '#3b82f6' },
              { val: 'CONTA_OBRA', label: '🏗 Conta Obra', bg: '#fef3c7', color: '#92400e', border: '#d97706' },
            ] as const).map(t => (
              <button key={t.val} onClick={() => setTipoDiaria(t.val)}
                style={{ padding: '8px 16px', borderRadius: 8, border: `2px solid ${tipoDiaria === t.val ? t.border : '#e5e7eb'}`, background: tipoDiaria === t.val ? t.bg : 'white', color: tipoDiaria === t.val ? t.color : '#9ca3af', cursor: 'pointer', fontSize: 13, fontWeight: tipoDiaria === t.val ? 700 : 400 }}>
                {t.label}
              </button>
            ))}
          </div>
          {tipoDiaria !== 'NORMAL' && (
            <div style={{ marginTop: 8, background: tipoDiaria === 'CONTA_MG' ? '#eff6ff' : '#fef3c7', border: `1px solid ${tipoDiaria === 'CONTA_MG' ? '#bfdbfe' : '#fde68a'}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: tipoDiaria === 'CONTA_MG' ? '#1e40af' : '#92400e' }}>
              {tipoDiaria === 'CONTA_MG' ? '🏢 Diária por conta da MG — será registrada em Engenharia para desconto na produção' : '🏗 Diária por conta da Obra — será registrada em Engenharia para desconto na produção e cobrança na medição'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Marcar todos:</span>
          <button onClick={() => marcarTodos('PRESENTE')} style={{ padding: '5px 14px', borderRadius: 8, border: '1.5px solid #059669', background: '#f0fdf4', color: '#059669', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✅ Todos Presentes</button>
          <button onClick={() => marcarTodos('FALTA')} style={{ padding: '5px 14px', borderRadius: 8, border: '1.5px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>❌ Todos Faltaram</button>
          <button onClick={() => marcarTodos('AUSENTE')} style={{ padding: '5px 14px', borderRadius: 8, border: '1.5px solid #9ca3af', background: '#f3f4f6', color: '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>⚪ Todos Ausentes</button>
          <button onClick={() => marcarTodos('X')} style={{ padding: '5px 14px', borderRadius: 8, border: '1.5px solid #6b7280', background: '#f3f4f6', color: '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✖ Todos X</button>
          <button onClick={() => setMarcacoes({})} style={{ padding: '5px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}>🔄 Limpar tudo</button>
        </div>
      </div>

      {/* Resumo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Presentes', val: presentes, color: '#059669', bg: '#f0fdf4' },
          { label: 'Faltas', val: faltas, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Outros', val: outros, color: '#92400e', bg: '#fffbeb' },
          { label: 'Sem marcação', val: semMarcacao, color: '#9ca3af', bg: '#f9fafb' },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 8, padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center', border: `1px solid ${s.color}22` }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</span>
            <span style={{ fontSize: 12, color: s.color }}>{s.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <input placeholder="🔍 Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', width: 220 }} />
        </div>
      </div>

      {msg && <div style={{ background: msg.includes('✅') ? '#f0fdf4' : '#fffbeb', border: `1px solid ${msg.includes('✅') ? '#bbf7d0' : '#fde68a'}`, borderRadius: 10, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: msg.includes('✅') ? '#166534' : '#92400e' }}>{msg}</div>}

      {/* Lista */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 80 }}>
        {funcsFiltradas.map((func, fi) => {
          const status = marcacoes[func.id]
          const bgRow = status === 'PRESENTE' ? '#f0fdf4' : status === 'FALTA' ? '#fee2e2' : status === 'X' ? '#f3f4f6' : status ? '#fffbeb' : fi % 2 === 0 ? 'white' : '#f9fafb'
          return (
            <div key={func.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #f3f4f6', background: bgRow, transition: 'background .1s' }}>
              <div style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{func.nome}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn funcId={func.id} status="PRESENTE" label="✅ Presente" bg="#dcfce7" color="#166534" border="#059669" />
                <Btn funcId={func.id} status="FALTA" label="❌ Falta" bg="#fee2e2" color="#991b1b" border="#dc2626" />
                <Btn funcId={func.id} status="ATESTADO" label="🏥 Atestado" bg="#fef3c7" color="#92400e" border="#d97706" />
                <Btn funcId={func.id} status="AUSENTE" label="⚪ Ausente" bg="#f3f4f6" color="#374151" border="#9ca3af" />
                <Btn funcId={func.id} status="SAIU" label="🚪 Saiu" bg="#fce7f3" color="#9d174d" border="#db2777" />
                <Btn funcId={func.id} status="X" label="✖ Feriado/Sáb" bg="#f3f4f6" color="#374151" border="#6b7280" />
              </div>
            </div>
          )
        })}
        {funcsFiltradas.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhum funcionário encontrado.</div>
        )}
      </div>

      {/* Botão salvar fixo no bottom */}
      <div style={{ position: 'fixed', bottom: 20, right: 28, zIndex: 50 }}>
        <button onClick={salvar} disabled={salvando || Object.values(marcacoes).filter(Boolean).length === 0}
          style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 14, padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 20px rgba(124,58,237,.5)', opacity: salvando ? .7 : 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          {salvando ? '⏳ Salvando...' : `💾 Salvar ${Object.values(marcacoes).filter(Boolean).length} lançamentos`}
        </button>
      </div>
    </div>
  )
}
