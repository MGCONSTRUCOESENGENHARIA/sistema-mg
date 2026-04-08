'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$, diasDoMes, formatDate, fim1Quinzena, AUSENCIAS } from '@/lib/utils'

interface Linha {
  func_id: string; nome: string; equipe: string
  tipo_pagamento: 'DIÁRIA' | 'SALÁRIO'
  valor_diaria: number; salario_base: number
  total_diarias: number; extras_folha: number
  faltas: number; ausentes: number; dsr: number
  extra_folha_valor: number
  hora_extra: number; complemento: number
  descontos: number; desc_pensao: number; desc_dsr: number
  desc_sindicato: number; desc_inss: number
  adiantamento: number
}

function calcTotal(l: Linha, ed: any) {
  const tipo = ed.tipo_pagamento || l.tipo_pagamento
  const base = tipo === 'SALÁRIO' ? l.salario_base : (l.total_diarias + l.extras_folha) * l.valor_diaria
  const totalDesc = (ed.descontos||0) + (ed.desc_pensao||0) + (ed.desc_dsr||0) + (ed.desc_sindicato||0) + (ed.desc_inss||0)
  const total = base + (ed.hora_extra||0) + (ed.complemento||0) - totalDesc
  const contracheque = total - (l.adiantamento||0)
  return { base, totalDesc, total, contracheque }
}

export default function PagamentoPage() {
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [mes, setMes] = useState(mesAtual())
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Record<string, any>>({})
  const [msg, setMsg] = useState('')

  useEffect(() => { carregar() }, [equipe, mes])

  async function carregar() {
    setLoading(true)
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    const { data: funcs } = await supabase.from('funcionarios')
      .select('id,nome,equipe,valor_diaria,salario_base')
      .eq('equipe', equipe).eq('ativo', true).order('nome')
    if (!funcs?.length) { setLinhas([]); setLoading(false); return }

    const diasMes = diasDoMes(mes)
    const f1 = fim1Quinzena(diasMes)
    const dias2Q = diasMes.slice(f1 + 1)
    const diasTodos = diasMes

    let presencas: any[] = []
    let presencas1Q: any[] = []
    if (comp?.id) {
      const { data: pres } = await supabase.from('presencas')
        .select('funcionario_id,tipo,fracao,fracao2,data')
        .eq('competencia_id', comp.id)
        .in('funcionario_id', funcs.map((f: any) => f.id))
      presencas = pres || []
      presencas1Q = presencas.filter(p => {
        const d = new Date(p.data + 'T12:00')
        const idx = diasMes.findIndex(dd => formatDate(dd) === p.data)
        return idx <= f1
      })
    }

    // Avulsos pagamento final
    let avulsosPF: any[] = []
    if (comp?.id) {
      const { data: av } = await supabase.from('avulso_parcelas')
        .select('*, avulsos(funcionario_id)')
        .eq('mes_ano', mes).eq('quando', 'pagamento_final').eq('descontado', false)
      avulsosPF = av || []
    }

    const resultado: Linha[] = funcs.map((func: any) => {
      const pAll = presencas.filter(p => p.funcionario_id === func.id)
      const p1Q = presencas1Q.filter(p => p.funcionario_id === func.id)
      const p2Q = pAll.filter(p => !p1Q.includes(p))

      let totalDiarias = 0, extrasfolha = 0, faltas = 0, ausentes = 0
      pAll.forEach(p => {
        if (p.tipo === 'FALTA') faltas++
        else if (p.tipo === 'AUSENTE') ausentes++
        else if (p.tipo === 'SABADO_EXTRA') extrasfolha += (p.fracao||0) + (p.fracao2||0)
        else if (p.tipo === 'NORMAL') totalDiarias += (p.fracao||0) + (p.fracao2||0)
      })

      const dsr = faltas // simplificado
      const adiantamento = func.salario_base * 0.5
      const descAvulsos = avulsosPF.filter(a => a.avulsos?.funcionario_id === func.id).reduce((s: number, a: any) => s + (a.valor||0), 0)

      return {
        func_id: func.id, nome: func.nome, equipe: func.equipe,
        tipo_pagamento: func.salario_base > 0 && func.valor_diaria === 0 ? 'SALÁRIO' : 'DIÁRIA',
        valor_diaria: func.valor_diaria, salario_base: func.salario_base,
        total_diarias: totalDiarias, extras_folha: extrasfolha,
        faltas, ausentes, dsr,
        extra_folha_valor: extrasfolha * func.valor_diaria,
        hora_extra: 0, complemento: 0,
        descontos: descAvulsos, desc_pensao: 0, desc_dsr: 0,
        desc_sindicato: 0, desc_inss: 0,
        adiantamento,
      }
    })

    setLinhas(resultado)
    const newEdit: typeof editando = {}
    resultado.forEach(l => {
      if (!editando[l.func_id]) {
        newEdit[l.func_id] = {
          hora_extra: 0, complemento: 0, descontos: l.descontos,
          desc_pensao: 0, desc_dsr: 0, desc_sindicato: 0, desc_inss: 0,
          dsr: l.dsr||0, tipo_pagamento: l.tipo_pagamento
        }
      }
    })
    setEditando(ed => ({ ...newEdit, ...ed }))
    setLoading(false)
  }

  function setEdit(funcId: string, field: string, val: number) {
    setEditando(ed => ({ ...ed, [funcId]: { ...(ed[funcId] || {}), [field]: val } }))
  }

  function getEd(funcId: string, l?: Linha) {
    return editando[funcId] || { hora_extra:0, complemento:0, descontos:0, desc_pensao:0, desc_dsr:0, desc_sindicato:0, desc_inss:0, dsr: l?.dsr||0, tipo_pagamento: l?.tipo_pagamento||'DIÁRIA' }
  }

  const btnEq = (eq: 'ARMAÇÃO' | 'CARPINTARIA') => ({
    padding: '7px 18px', borderRadius: 8, border: '2px solid #1a3a5c', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: equipe === eq ? '#1a3a5c' : '#fff', color: equipe === eq ? '#fff' : '#1a3a5c',
  })

  const inp = (red?: boolean) => ({
    width: 80, textAlign: 'right' as const, border: `1px solid ${red?'#fca5a5':'#fbbf24'}`,
    borderRadius: 4, padding: '3px 6px', fontSize: 11,
    background: red ? '#fef2f2' : '#fefce8', fontWeight: 600,
  })

  const totalGeral = linhas.reduce((s, l) => s + calcTotal(l, getEd(l.func_id, l)).total, 0)
  const totalCC = linhas.reduce((s, l) => s + calcTotal(l, getEd(l.func_id, l)).contracheque, 0)

  const COLS = [
    { label: 'FUNCIONÁRIO', bg: '#1a3a5c', min: 200, sticky: true },
    { label: 'TIPO', bg: '#1a3a5c' },
    { label: 'DIÁRIAS', bg: '#1e4d2b' },
    { label: 'EXTRAS FOLHA', bg: '#4c1d95' },
    { label: 'FALTAS', bg: '#7f1d1d' },
    { label: 'AUSENTE', bg: '#6b7280' },
    { label: 'DSR', bg: '#92400e' },
    { label: 'VL DIÁRIA', bg: '#1a3a5c' },
    { label: 'SALÁRIO', bg: '#1a3a5c' },
    { label: 'EXTRA FOLHA', bg: '#4c1d95' },
    { label: 'HORA EXTRA', bg: '#7c2d12' },
    { label: 'COMPLEMENTO', bg: '#7c2d12' },
    { label: 'DESCONTOS', bg: '#991b1b' },
    { label: 'DESC. PENSÃO', bg: '#991b1b' },
    { label: 'DESC. DSR', bg: '#991b1b' },
    { label: 'DESC. SIND.', bg: '#991b1b' },
    { label: 'DESC. INSS', bg: '#991b1b' },
    { label: 'TOTAL PGTO', bg: '#064e3b' },
    { label: 'CONTRACHEQUE', bg: '#065f46' },
  ]

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <button style={btnEq('ARMAÇÃO')} onClick={() => setEquipe('ARMAÇÃO')}>Armação</button>
        <button style={btnEq('CARPINTARIA')} onClick={() => setEquipe('CARPINTARIA')}>Carpintaria</button>
        <select value={mes} onChange={e => { setMes(e.target.value); setEditando({}) }}
          style={{ border:'1px solid #d1d5db', borderRadius:6, padding:'6px 10px', fontSize:13 }}>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => {
            const v = `2026-${m}`
            const ns = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
            return <option key={v} value={v}>{ns[+m-1]} 2026</option>
          })}
        </select>
        <button onClick={() => window.print()}
          style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #6b7280', background:'#fff', cursor:'pointer', fontSize:13 }}>
          🖨 Imprimir
        </button>
        <span style={{ marginLeft:'auto', fontSize:12, color:'#6b7280' }}>Campos em amarelo são editáveis</span>
      </div>

      <h1 style={{ fontSize:18, fontWeight:700, color:'#1a3a5c', marginBottom:2 }}>
        Pagamento Final — Dia 05 · {equipe}
      </h1>
      <p style={{ fontSize:12, color:'#6b7280', marginBottom:14 }}>
        {nomeMes(mes)} · Mês completo
      </p>

      {msg && <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, padding:'10px 14px', marginBottom:12, color:'#14532d', fontSize:13 }}>{msg}</div>}

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ overflow:'auto', border:'1px solid #e5e7eb', borderRadius:8 }}>
          <table style={{ borderCollapse:'collapse', width:'max-content' }}>
            <thead>
              <tr>
                {COLS.map((h, i) => (
                  <th key={i} style={{
                    background: h.bg, color:'#fff', padding:'8px 8px',
                    textAlign: i===0 ? 'left' : 'center', fontSize:9, fontWeight:700,
                    minWidth: h.min||90, whiteSpace:'nowrap',
                    position: h.sticky ? 'sticky' : undefined,
                    left: h.sticky ? 0 : undefined, zIndex: h.sticky ? 20 : undefined,
                  }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, fi) => {
                const ed = getEd(l.func_id, l)
                const { base, totalDesc, total, contracheque } = calcTotal(l, ed)
                const bg = fi%2===0 ? '#fff' : '#f9fafb'
                return (
                  <tr key={l.func_id} style={{ background:bg }}>
                    <td style={{ padding:'7px 12px', fontWeight:600, color:'#1a3a5c', fontSize:12, position:'sticky', left:0, background:bg, zIndex:1, borderRight:'2px solid #e5e7eb', whiteSpace:'nowrap' }}>{l.nome}</td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fefce8' }}>
                      <select value={ed.tipo_pagamento||l.tipo_pagamento} onChange={e => setEdit(l.func_id,'tipo_pagamento',e.target.value as any)}
                        style={{ border:'1px solid #fbbf24', borderRadius:4, padding:'3px 4px', fontSize:10, fontWeight:700, outline:'none', background:'#fefce8' }}>
                        <option value="DIÁRIA">DIÁRIA</option>
                        <option value="SALÁRIO">SALÁRIO</option>
                      </select>
                    </td>
                    <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:'#166534', fontSize:13 }}>{l.total_diarias.toFixed(1)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'center', color:'#6d28d9', fontSize:13 }}>{l.extras_folha.toFixed(1)||'—'}</td>
                    <td style={{ padding:'7px 8px', textAlign:'center', color:'#dc2626', fontSize:13 }}>{l.faltas||'—'}</td>
                    <td style={{ padding:'7px 8px', textAlign:'center', color:'#6b7280', fontSize:13 }}>{l.ausentes||'—'}</td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fefce8' }}>
                      <input type="number" step="1" style={{ width:60, textAlign:'right', border:'1px solid #fbbf24', borderRadius:4, padding:'3px 6px', fontSize:11, background:'#fefce8', fontWeight:600 }} value={ed.dsr||''} placeholder="0" onChange={e => setEdit(l.func_id,'dsr',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'7px 8px', textAlign:'right', fontSize:12 }}>{formatR$(l.valor_diaria)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', fontSize:12 }}>{formatR$(l.salario_base)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'#6d28d9', background:'#f5f3ff', fontSize:12 }}>{l.extra_folha_valor>0?formatR$(l.extra_folha_valor):'—'}</td>
                    {/* Editáveis */}
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fff7ed' }}>
                      <input type="number" step="0.01" style={inp()} value={ed.hora_extra||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'hora_extra',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fff7ed' }}>
                      <input type="number" step="0.01" style={inp()} value={ed.complemento||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'complemento',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fef2f2' }}>
                      <input type="number" step="0.01" style={inp(true)} value={ed.descontos||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'descontos',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fef2f2' }}>
                      <input type="number" step="0.01" style={inp(true)} value={ed.desc_pensao||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'desc_pensao',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fef2f2' }}>
                      <input type="number" step="0.01" style={inp(true)} value={ed.desc_dsr||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'desc_dsr',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fef2f2' }}>
                      <input type="number" step="0.01" style={inp(true)} value={ed.desc_sindicato||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'desc_sindicato',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fef2f2' }}>
                      <input type="number" step="0.01" style={inp(true)} value={ed.desc_inss||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'desc_inss',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:700, color:'#065f46', background:'#dcfce7', fontSize:13 }}>{formatR$(total)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:700, color:'#1e40af', background:'#eff6ff', fontSize:13 }}>{formatR$(contracheque)}</td>
                  </tr>
                )
              })}
              <tr style={{ background:'#1a3a5c', fontWeight:700 }}>
                <td style={{ padding:'9px 12px', color:'#fff', fontSize:12, position:'sticky', left:0, background:'#1a3a5c', zIndex:1 }}>TOTAL {equipe}</td>
                <td colSpan={17} style={{ padding:'9px 8px' }}></td>
                <td style={{ padding:'9px 8px', textAlign:'right', color:'#86efac', fontSize:13 }}>{formatR$(totalGeral)}</td>
                <td style={{ padding:'9px 8px', textAlign:'right', color:'#93c5fd', fontSize:13 }}>{formatR$(totalCC)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
