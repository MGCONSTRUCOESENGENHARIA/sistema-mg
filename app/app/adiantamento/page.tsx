'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$, diasDoMes, formatDate, fim1Quinzena, AUSENCIAS } from '@/lib/utils'

interface Linha {
  func_id: string
  nome: string
  equipe: string
  valor_diaria: number
  salario_base: number
  total_diarias: number
  extras_folha: number
  extra_folha_valor: number
  adiantamento: number
  hora_extra: number
  complemento: number
  descontos: number
  total_pagamento: number
}

export default function AdiantamentoPage() {
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [mes, setMes] = useState(mesAtual())
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Record<string, { hora_extra: number; complemento: number; descontos: number }>>({})
  const [salvando, setSalvando] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { carregar() }, [equipe, mes])

  async function carregar() {
    setLoading(true)

    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    const { data: funcs } = await supabase.from('funcionarios')
      .select('id,nome,equipe,valor_diaria,salario_base')
      .eq('equipe', equipe).eq('ativo', true).order('nome')

    if (!funcs || funcs.length === 0) { setLinhas([]); setLoading(false); return }

    const diasMes = diasDoMes(mes)
    const f1 = fim1Quinzena(diasMes)
    const dias1Q = diasMes.slice(0, f1 + 1)

    // Presenças apenas da 1ª quinzena
    let presencas: any[] = []
    if (comp?.id) {
      const { data: pres } = await supabase.from('presencas')
        .select('funcionario_id,tipo,fracao,fracao2,data')
        .eq('competencia_id', comp.id)
        .in('data', dias1Q.map(d => formatDate(d)))
        .in('funcionario_id', funcs.map((f: any) => f.id))
      presencas = pres || []
    }

    // Descontos do adiantamento via avulso_parcelas
    let avulsos: any[] = []
    if (comp?.id) {
      const { data: av } = await supabase.from('avulso_parcelas')
        .select('*, avulsos(funcionario_id)')
        .eq('mes_ano', mes)
        .eq('quando', 'adiantamento')
        .eq('descontado', false)
      avulsos = av || []
    }

    // Calcular por funcionário
    const resultado: Linha[] = funcs.map((func: any) => {
      const presFunci = presencas.filter(p => p.funcionario_id === func.id)
      let totalDiarias = 0, extrasfolha = 0

      presFunci.forEach(p => {
        if (['FALTA', ...AUSENCIAS].includes(p.tipo)) return
        const soma = (p.fracao || 0) + (p.fracao2 || 0)
        if (p.tipo === 'SABADO_EXTRA') extrasfolha += soma
        else totalDiarias += soma
      })

      const adiantamento = func.salario_base * 0.5
      const extraFolhaValor = extrasfolha * func.valor_diaria
      const descFunci = avulsos.filter((a: any) => a.avulsos?.funcionario_id === func.id).reduce((s: number, a: any) => s + (a.valor||0), 0)
      const editFunci = editando[func.id] || { hora_extra: 0, complemento: 0, descontos: descFunci }

      const total = adiantamento + extraFolhaValor + editFunci.hora_extra + editFunci.complemento - editFunci.descontos

      return {
        func_id: func.id, nome: func.nome, equipe: func.equipe,
        valor_diaria: func.valor_diaria, salario_base: func.salario_base,
        total_diarias: totalDiarias, extras_folha: extrasfolha,
        extra_folha_valor: extraFolhaValor, adiantamento,
        hora_extra: editFunci.hora_extra, complemento: editFunci.complemento,
        descontos: editFunci.descontos, total_pagamento: total,
      }
    })

    // Carregar ajustes salvos do banco
    let ajustes: any[] = []
    if (comp?.id) {
      const { data: aj } = await supabase.from('pagamento_ajustes')
        .select('*').eq('competencia_id', comp.id).eq('tipo', 'adiantamento')
        .in('funcionario_id', funcs.map((f: any) => f.id))
      ajustes = aj || []
    }

    setLinhas(resultado)
    const newEdit: typeof editando = {}
    resultado.forEach(l => {
      const aj = ajustes.find(a => a.funcionario_id === l.func_id)
      newEdit[l.func_id] = aj ? {
        hora_extra: aj.hora_extra || 0,
        complemento: aj.complemento || 0,
        descontos: aj.descontos || l.descontos,
      } : { hora_extra: 0, complemento: 0, descontos: l.descontos }
    })
    setEditando(newEdit)
    setLoading(false)
  }

  const saveTimers = useRef<Record<string, any>>({})

  async function salvarAjuste(funcId: string, newEd: any) {
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    if (!comp?.id) return
    await supabase.from('pagamento_ajustes').upsert({
      competencia_id: comp.id,
      funcionario_id: funcId,
      tipo: 'adiantamento',
      hora_extra: newEd.hora_extra || 0,
      complemento: newEd.complemento || 0,
      descontos: newEd.descontos || 0,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'competencia_id,funcionario_id,tipo' })
  }

  function setEdit(funcId: string, field: 'hora_extra' | 'complemento' | 'descontos', val: number) {
    setEditando(ed => {
      const newEd = { ...(ed[funcId] || { hora_extra: 0, complemento: 0, descontos: 0 }), [field]: val }
      clearTimeout(saveTimers.current[funcId])
      saveTimers.current[funcId] = setTimeout(() => salvarAjuste(funcId, newEd), 800)
      return { ...ed, [funcId]: newEd }
    })
  }

  function recalcular(linha: Linha) {
    const ed = editando[linha.func_id] || { hora_extra: 0, complemento: 0, descontos: linha.descontos }
    return linha.adiantamento + linha.extra_folha_valor + ed.hora_extra + ed.complemento - ed.descontos
  }

  const totalDiarias = linhas.reduce((s, l) => s + l.total_diarias, 0)
  const totalExtras = linhas.reduce((s, l) => s + l.extras_folha, 0)
  const totalAdiant = linhas.reduce((s, l) => s + l.adiantamento, 0)
  const totalExtraFolha = linhas.reduce((s, l) => s + l.extra_folha_valor, 0)
  const totalDesc = linhas.reduce((s, l) => s + (editando[l.func_id]?.descontos ?? l.descontos), 0)
  const totalGeral = linhas.reduce((s, l) => s + recalcular(l), 0)

  const btnEq = (eq: 'ARMAÇÃO' | 'CARPINTARIA') => ({
    padding: '7px 18px', borderRadius: 8, border: '2px solid #1a3a5c', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: equipe === eq ? '#1a3a5c' : '#fff', color: equipe === eq ? '#fff' : '#1a3a5c',
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btnEq('ARMAÇÃO')} onClick={() => setEquipe('ARMAÇÃO')}>Armação</button>
        <button style={btnEq('CARPINTARIA')} onClick={() => setEquipe('CARPINTARIA')}>Carpintaria</button>
        <select value={mes} onChange={e => { setMes(e.target.value); setEditando({}) }}
          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => {
            const v = `2026-${m}`
            const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
            return <option key={v} value={v}>{nomes[+m-1]} 2026</option>
          })}
        </select>
        <button onClick={() => window.print()}
          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #6b7280', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          🖨 Imprimir
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
          Campos em amarelo são editáveis · Pressione Enter para confirmar
        </span>
      </div>

      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c', marginBottom: 2 }}>
        Adiantamento — Dia 20 · {equipe}
      </h1>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
        1ª Quinzena de {nomeMes(mes)} · Adiantamento = 50% do salário base
      </p>

      {msg && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#14532d', fontSize: 13 }}>{msg}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 'max-content', width: '100%' }}>
            <thead>
              <tr>
                {/* Cabeçalhos */}
                {[
                  { label: 'FUNCIONÁRIO', bg: '#1a3a5c', min: 220, sticky: true },
                  { label: 'TOTAL DIÁRIAS', bg: '#1e4d2b' },
                  { label: 'DIÁRIAS EXTRA FOLHA', bg: '#4c1d95' },
                  { label: 'VALOR DA DIÁRIA', bg: '#1a3a5c' },
                  { label: 'SALÁRIO BASE', bg: '#1a3a5c' },
                  { label: 'ADIANTAMENTO', bg: '#065f46' },
                  { label: 'EXTRA FOLHA', bg: '#4c1d95' },
                  { label: 'HORA EXTRA', bg: '#7c2d12' },
                  { label: 'COMPLEMENTO', bg: '#7c2d12' },
                  { label: 'DESCONTOS', bg: '#991b1b' },
                  { label: 'TOTAL DO PAGAMENTO', bg: '#064e3b' },
                ].map((h, i) => (
                  <th key={i} style={{
                    background: h.bg, color: '#fff', padding: '8px 10px',
                    textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 700,
                    minWidth: h.min || 110, whiteSpace: 'nowrap',
                    position: h.sticky ? 'sticky' : undefined,
                    left: h.sticky ? 0 : undefined, zIndex: h.sticky ? 20 : undefined,
                  }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, fi) => {
                const ed = editando[l.func_id] || { hora_extra: 0, complemento: 0, descontos: l.descontos }
                const total = recalcular(l)
                const bg = fi % 2 === 0 ? '#fff' : '#f9fafb'
                const inputStyle = {
                  width: 90, textAlign: 'right' as const, border: '1px solid #fbbf24',
                  borderRadius: 4, padding: '3px 6px', fontSize: 12,
                  background: '#fefce8', fontWeight: 600,
                }
                return (
                  <tr key={l.func_id} style={{ background: bg }}>
                    <td style={{ padding: '7px 12px', fontWeight: 600, color: '#1a3a5c', fontSize: 12, position: 'sticky', left: 0, background: bg, zIndex: 2, borderRight: '2px solid #e5e7eb', whiteSpace: 'nowrap', minWidth: 220 }}>
                      {l.nome}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: '#166534', fontSize: 13 }}>
                      {l.total_diarias.toFixed(1)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: '#6d28d9', fontSize: 13 }}>
                      {l.extras_folha.toFixed(1)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 12 }}>
                      {formatR$(l.valor_diaria)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 12 }}>
                      {formatR$(l.salario_base)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#065f46', background: '#f0fdf4', fontSize: 13 }}>
                      {formatR$(l.adiantamento)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6d28d9', background: '#f5f3ff', fontSize: 12 }}>
                      {l.extra_folha_valor > 0 ? formatR$(l.extra_folha_valor) : '—'}
                    </td>
                    {/* Hora Extra editável */}
                    <td style={{ padding: '4px 6px', textAlign: 'center', background: '#fff7ed' }}>
                      <input type="number" step="0.01" style={inputStyle}
                        value={ed.hora_extra || ''}
                        placeholder="0,00"
                        onChange={e => setEdit(l.func_id, 'hora_extra', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    {/* Complemento editável */}
                    <td style={{ padding: '4px 6px', textAlign: 'center', background: '#fff7ed' }}>
                      <input type="number" step="0.01" style={inputStyle}
                        value={ed.complemento || ''}
                        placeholder="0,00"
                        onChange={e => setEdit(l.func_id, 'complemento', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    {/* Descontos editável */}
                    <td style={{ padding: '4px 6px', textAlign: 'center', background: '#fef2f2' }}>
                      <input type="number" step="0.01" style={{ ...inputStyle, border: '1px solid #fca5a5', background: '#fef2f2' }}
                        value={ed.descontos || ''}
                        placeholder="0,00"
                        onChange={e => setEdit(l.func_id, 'descontos', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    {/* Total */}
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#065f46', background: '#dcfce7', fontSize: 14 }}>
                      {formatR$(total)}
                    </td>
                  </tr>
                )
              })}

              {/* Totais */}
              <tr style={{ background: '#1a3a5c', fontWeight: 700 }}>
                <td style={{ padding: '9px 12px', color: '#fff', fontSize: 12, position: 'sticky', left: 0, background: '#1a3a5c', zIndex: 1 }}>
                  TOTAL {equipe}
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'center', color: '#86efac', fontSize: 13 }}>
                  {totalDiarias.toFixed(1)}
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'center', color: '#c4b5fd', fontSize: 13 }}>
                  {totalExtras.toFixed(1)}
                </td>
                <td colSpan={2} style={{ padding: '9px 10px' }}></td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#86efac', fontSize: 13 }}>
                  {formatR$(totalAdiant)}
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#c4b5fd', fontSize: 12 }}>
                  {totalExtraFolha > 0 ? formatR$(totalExtraFolha) : '—'}
                </td>
                <td colSpan={2} style={{ padding: '9px 10px' }}></td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#fca5a5', fontSize: 12 }}>
                  -{formatR$(totalDesc)}
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#86efac', fontSize: 14 }}>
                  {formatR$(totalGeral)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
