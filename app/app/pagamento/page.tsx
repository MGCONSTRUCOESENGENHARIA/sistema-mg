'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$, diasDoMes, formatDate, fim1Quinzena, AUSENCIAS } from '@/lib/utils'

// Tabela INSS progressiva (salario_base -> desconto)
const TABELA_INSS: [number, number][] = [
  [4000, 368.60], [3866.67, 352.60], [3733.33, 336.60],
  [2800, 227.68], [2706.67, 219.28], [2613.33, 210.88],
  [2520, 202.48], [2426.67, 194.08], [2333.33, 185.68],
  [2240, 177.28], [2146.67, 168.88], [2050, 160.18],
  [1981.67, 154.03], [1913.33, 147.88], [1845, 141.73],
  [1776.67, 135.58], [1708.33, 129.43], [1640, 123.28],
  [1571.67, 117.87], [1800, 137.68],
]

function calcINSS(salario: number): number {
  // VLOOKUP aproximado — pega o maior salário <= salario base
  const sorted = [...TABELA_INSS].sort((a, b) => b[0] - a[0])
  for (const [base, desc] of sorted) {
    if (salario >= base) return desc
  }
  return 0
}

function calcDSR(presencasDatas: { data: string; tipo: string }[], mes: string): number {
  // Agrupar faltas/ausentes por semana e verificar se domingo do mês existe
  const faltasDatas = presencasDatas
    .filter(p => p.tipo === 'FALTA' || p.tipo === 'AUSENTE')
    .map(p => new Date(p.data + 'T12:00'))

  if (faltasDatas.length === 0) return 0

  // Pegar todos os domingos do mês
  const [ano, mo] = mes.split('-').map(Number)
  const domingosMes: Date[] = []
  const d = new Date(ano, mo - 1, 1)
  while (d.getMonth() === mo - 1) {
    if (d.getDay() === 0) domingosMes.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }

  // Para cada falta, verificar qual domingo da semana pertence
  const domingosPenalizados = new Set<string>()
  for (const falta of faltasDatas) {
    // Achar o domingo da semana desta falta (próximo domingo após a falta)
    const domingo = new Date(falta)
    domingo.setDate(falta.getDate() + (7 - falta.getDay()) % 7)
    if (domingo.getDay() !== 0) continue

    // Verificar se este domingo está no mês
    const domKey = formatDate(domingo)
    const estaNomes = domingosMes.some(dom => formatDate(dom) === domKey)
    if (estaNomes) {
      domingosPenalizados.add(domKey)
    }
  }

  return domingosPenalizados.size
}

interface Linha {
  func_id: string; nome: string; equipe: string
  tipo_pagamento: string
  valor_diaria: number; salario_base: number
  total_diarias: number; extras_folha: number
  dias_uteis: number; faltas: number; ausentes: number
  extra_folha_valor: number
  adiantamento_valor: number
  presencas_datas: { data: string; tipo: string }[]
}

function calcRow(l: Linha, ed: any) {
  const tipo = ed.tipo_pagamento || l.tipo_pagamento
  const faltas = l.faltas
  const ausentes = l.ausentes
  const dsr = calcDSR(l.presencas_datas, '')  // será calculado com mes

  if (tipo === 'DIÁRIA') {
    const extraFolha = l.extra_folha_valor
    const totalBase = l.dias_uteis * l.valor_diaria
    const somaDescontos = -(l.adiantamento_valor) + (ed.hora_extra||0) + (ed.complemento||0)
      - (ed.desc_materiais||0) - (ed.desc_emprestimo||0) - (ed.desc_acerto||0)
      - (ed.desc_pensao||0) - (ed.desc_dsr||0) - (ed.desc_sindicato||0) - (ed.desc_inss||0)
    const total = totalBase + extraFolha + somaDescontos
    const contracheque = total - extraFolha - (ed.hora_extra||0)
    return { dsr: 0, inss: 0, salarioLiq: 0, total, contracheque }
  } else {
    // SALÁRIO
    const salBase = l.salario_base
    const salLiq = salBase - (salBase / 30 * faltas)
    const dsrCalc = ed.dsr_manual !== undefined ? ed.dsr_manual : (salLiq * 2) / 30 * (ed.dsr_qtd || 0)
    const inss = calcINSS(salBase)
    const total = salLiq - (l.adiantamento_valor)
      + (ed.hora_extra||0) + (ed.complemento||0)
      - (ed.desc_materiais||0) - (ed.desc_emprestimo||0) - (ed.desc_acerto||0)
      - (ed.desc_pensao||0) - dsrCalc - 17.66 - inss
    const contracheque = total - (ed.hora_extra||0)
    return { dsr: dsrCalc, inss, salarioLiq: salLiq, total, contracheque }
  }
}

export default function PagamentoPage() {
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [mes, setMes] = useState(mesAtual())
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Record<string, any>>({})
  const [modalFunc, setModalFunc] = useState<any>(null)

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
    const dias1Q = diasMes.slice(0, f1 + 1)

    let presencas: any[] = []
    if (comp?.id) {
      const { data: pres } = await supabase.from('presencas')
        .select('funcionario_id,tipo,fracao,fracao2,data')
        .eq('competencia_id', comp.id)
        .in('funcionario_id', funcs.map((f: any) => f.id))
      presencas = pres || []
    }

    // Adiantamento pago (buscar da tabela pagamentos tipo adiantamento)
    let adiantamentos: any[] = []
    if (comp?.id) {
      const { data: adt } = await supabase.from('pagamentos')
        .select('funcionario_id, total_pagamento')
        .eq('competencia_id', comp.id)
        .eq('tipo', 'adiantamento')
      adiantamentos = adt || []
    }

    // Descontos pagamento final
    let avulsosPF: any[] = []
    if (comp?.id) {
      const { data: av } = await supabase.from('avulso_parcelas')
        .select('*, avulsos(funcionario_id)')
        .eq('mes_ano', mes).eq('quando', 'pagamento_final').eq('descontado', false)
      avulsosPF = av || []
    }

    const resultado: Linha[] = funcs.map((func: any) => {
      const pAll = presencas.filter(p => p.funcionario_id === func.id)
      let totalDiarias = 0, extrasfolha = 0, faltas = 0, ausentes = 0

      pAll.forEach(p => {
        if (p.tipo === 'FALTA') faltas++
        else if (p.tipo === 'AUSENTE') ausentes++
        else if (p.tipo === 'SABADO_EXTRA') extrasfolha += (p.fracao||1) + (p.fracao2||0)
        else if (p.tipo === 'NORMAL') totalDiarias += (p.fracao||1) + (p.fracao2||0)
      })

      const diasUteis = totalDiarias + faltas
      const adtObj = adiantamentos.find(a => a.funcionario_id === func.id)
      const adiantamentoValor = adtObj?.total_pagamento || 0
      const descAvulsos = avulsosPF.filter((a: any) => a.avulsos?.funcionario_id === func.id).reduce((s: number, a: any) => s + (a.valor||0), 0)

      return {
        func_id: func.id, nome: func.nome, equipe: func.equipe,
        tipo_pagamento: 'DIÁRIA',
        valor_diaria: func.valor_diaria, salario_base: func.salario_base,
        total_diarias: totalDiarias, extras_folha: extrasfolha,
        dias_uteis: diasUteis, faltas, ausentes,
        extra_folha_valor: extrasfolha * func.valor_diaria,
        adiantamento_valor: adiantamentoValor,
        presencas_datas: pAll.map(p => ({ data: p.data, tipo: p.tipo })),
      }
    })

    // Carregar ajustes salvos
    let ajustes: any[] = []
    if (comp?.id) {
      const { data: aj } = await supabase.from('pagamento_ajustes')
        .select('*').eq('competencia_id', comp.id).eq('tipo', 'pagamento_final')
        .in('funcionario_id', funcs.map((f: any) => f.id))
      ajustes = aj || []
    }

    setLinhas(resultado)
    const newEdit: typeof editando = {}
    resultado.forEach(l => {
      const aj = ajustes.find(a => a.funcionario_id === l.func_id)
      const dsr = calcDSR(l.presencas_datas, mes)
      newEdit[l.func_id] = aj ? {
        tipo_pagamento: aj.tipo_pagamento || 'DIÁRIA',
        hora_extra: aj.hora_extra || 0,
        complemento: aj.complemento || 0,
        desc_materiais: aj.desc_materiais || 0,
        desc_emprestimo: aj.desc_emprestimo || 0,
        desc_acerto: aj.desc_acerto || 0,
        desc_pensao: aj.desc_pensao || 0,
        desc_dsr: aj.desc_dsr || 0,
        desc_sindicato: aj.desc_sindicato || 0,
        desc_inss: aj.desc_inss || 0,
        dsr_qtd: aj.dsr_qtd || dsr,
      } : {
        tipo_pagamento: 'DIÁRIA',
        hora_extra: 0, complemento: 0,
        desc_materiais: 0, desc_emprestimo: 0, desc_acerto: 0,
        desc_pensao: 0, desc_dsr: 0, desc_sindicato: 0, desc_inss: 0,
        dsr_qtd: dsr,
      }
    })
    setEditando(newEdit)
    setLoading(false)
  }

  async function salvarAjuste(funcId: string, newEd: any) {
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    if (!comp?.id) return
    await supabase.from('pagamento_ajustes').upsert({
      competencia_id: comp.id,
      funcionario_id: funcId,
      tipo: 'pagamento_final',
      ...newEd,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'competencia_id,funcionario_id,tipo' })
  }

  const saveTimers = useRef<Record<string, any>>({})

  function setEdit(funcId: string, field: string, val: any) {
    setEditando(ed => {
      const newEd = { ...(ed[funcId] || {}), [field]: val }
      // Debounce save 800ms após última alteração
      clearTimeout(saveTimers.current[funcId])
      saveTimers.current[funcId] = setTimeout(() => salvarAjuste(funcId, newEd), 800)
      return { ...ed, [funcId]: newEd }
    })
  }

  function getEd(funcId: string) {
    return editando[funcId] || { tipo_pagamento:'DIÁRIA', hora_extra:0, complemento:0, desc_materiais:0, desc_emprestimo:0, desc_acerto:0, desc_pensao:0, desc_dsr:0, desc_sindicato:0, desc_inss:0, dsr_qtd:0 }
  }

  const btnEq = (eq: 'ARMAÇÃO' | 'CARPINTARIA') => ({
    padding: '7px 18px', borderRadius: 8, border: '2px solid #1a3a5c', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: equipe === eq ? '#1a3a5c' : '#fff', color: equipe === eq ? '#fff' : '#1a3a5c',
  })

  const inp = (red?: boolean) => ({
    width: 75, textAlign: 'right' as const,
    border: `1px solid ${red?'#fca5a5':'#fbbf24'}`,
    borderRadius: 4, padding: '3px 5px', fontSize: 11,
    background: red ? '#fef2f2' : '#fefce8', fontWeight: 600, outline: 'none',
  })

  const totalGeral = linhas.reduce((s, l) => s + calcRow(l, getEd(l.func_id)).total, 0)
  const totalCC = linhas.reduce((s, l) => s + calcRow(l, getEd(l.func_id)).contracheque, 0)

  const COLS = [
    { label: 'FUNCIONÁRIO', bg: '#1a3a5c', min: 200, sticky: true },
    { label: 'TIPO', bg: '#1a3a5c', min: 100 },
    { label: 'DIÁRIAS', bg: '#1e4d2b' },
    { label: 'EXTRAS FOLHA', bg: '#4c1d95' },
    { label: 'DIAS ÚTEIS', bg: '#1e4d2b' },
    { label: 'FALTAS', bg: '#7f1d1d' },
    { label: 'AUSENTE', bg: '#6b7280' },
    { label: 'DSR', bg: '#92400e' },
    { label: 'VL DIÁRIA', bg: '#1a3a5c' },
    { label: 'SALÁRIO', bg: '#1a3a5c' },
    { label: 'ADIANTAMENTO', bg: '#065f46' },
    { label: 'EXTRA FOLHA R$', bg: '#4c1d95' },
    { label: 'HORA EXTRA', bg: '#7c2d12' },
    { label: 'COMPLEMENTO', bg: '#7c2d12' },
    { label: 'DESC. MAT.', bg: '#991b1b' },
    { label: 'DESC. VALE', bg: '#991b1b' },
    { label: 'DESC. ACERTO', bg: '#991b1b' },
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
        <span style={{ marginLeft:'auto', fontSize:12, color:'#6b7280' }}>Campos em amarelo = editáveis · Vermelho = descontos</span>
      </div>

      <h1 style={{ fontSize:18, fontWeight:700, color:'#1a3a5c', marginBottom:2 }}>
        Pagamento Final — Dia 05 · {equipe}
      </h1>
      <p style={{ fontSize:12, color:'#6b7280', marginBottom:14 }}>{nomeMes(mes)} · Mês completo</p>

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ overflowX:'auto', border:'1px solid #e5e7eb', borderRadius:8 }}>
          <table style={{ borderCollapse:'collapse', width:'max-content' }}>
            <thead>
              <tr>
                {COLS.map((h, i) => (
                  <th key={i} style={{
                    background: h.bg, color:'#fff', padding:'8px 8px',
                    textAlign: i===0 ? 'left' : 'center', fontSize:9, fontWeight:700,
                    minWidth: h.min||85, whiteSpace:'nowrap',
                    position: h.sticky ? 'sticky' : undefined,
                    left: h.sticky ? 0 : undefined, zIndex: h.sticky ? 20 : undefined,
                  }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, fi) => {
                const ed = getEd(l.func_id)
                const tipo = ed.tipo_pagamento || l.tipo_pagamento
                const { dsr, inss, salarioLiq, total, contracheque } = calcRow(l, {...ed, _mes: mes})
                const bg = fi%2===0 ? '#fff' : '#f9fafb'
                return (
                  <tr key={l.func_id} style={{ background:bg }}>
                    <td style={{ padding:'7px 12px', fontWeight:600, color:'#1a3a5c', fontSize:12, position:'sticky', left:0, background:bg, zIndex:2, borderRight:'2px solid #e5e7eb', whiteSpace:'nowrap', cursor:'pointer' }}
                      onClick={() => setModalFunc({ l, ed, calc: calcRow(l, ed) })}>
                      <span style={{ borderBottom:'1px dashed #93c5fd' }}>{l.nome}</span>
                    </td>
                    {/* Tipo */}
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fefce8' }}>
                      <select value={tipo} onChange={e => setEdit(l.func_id,'tipo_pagamento',e.target.value)}
                        style={{ border:'1px solid #fbbf24', borderRadius:4, padding:'3px 4px', fontSize:10, fontWeight:700, outline:'none', background:'#fefce8', color: tipo==='DIÁRIA'?'#1e40af':'#166534' }}>
                        <option value="DIÁRIA">DIÁRIA</option>
                        <option value="SALÁRIO">SALÁRIO</option>
                      </select>
                    </td>
                    <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:'#166534', fontSize:13 }}>{l.total_diarias.toFixed(1)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'center', color:'#6d28d9', fontSize:13 }}>{l.extras_folha>0?l.extras_folha.toFixed(1):'—'}</td>
                    <td style={{ padding:'7px 8px', textAlign:'center', color:'#166534', fontSize:13 }}>{l.dias_uteis.toFixed(1)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'center', color:'#dc2626', fontSize:13 }}>{l.faltas||'—'}</td>
                    <td style={{ padding:'7px 8px', textAlign:'center', color:'#6b7280', fontSize:13 }}>{l.ausentes||'—'}</td>
                    {/* DSR editável */}
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fff7ed' }}>
                      <input type="number" step="1" style={{...inp(), width:50}} value={ed.dsr_qtd??''} placeholder="0"
                        onChange={e => setEdit(l.func_id,'dsr_qtd',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'7px 8px', textAlign:'right', fontSize:12 }}>{formatR$(l.valor_diaria)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', fontSize:12 }}>{tipo==='SALÁRIO'?formatR$(salarioLiq):formatR$(l.salario_base)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'#dc2626', fontSize:12 }}>-{formatR$(l.adiantamento_valor)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'#6d28d9', background:'#f5f3ff', fontSize:12 }}>{l.extra_folha_valor>0?formatR$(l.extra_folha_valor):'—'}</td>
                    {/* Editáveis amarelo */}
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fff7ed' }}>
                      <input type="number" step="0.01" style={inp()} value={ed.hora_extra||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'hora_extra',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fff7ed' }}>
                      <input type="number" step="0.01" style={inp()} value={ed.complemento||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'complemento',parseFloat(e.target.value)||0)} />
                    </td>
                    {/* Descontos vermelho */}
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fef2f2' }}>
                      <input type="number" step="0.01" style={inp(true)} value={ed.desc_materiais||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'desc_materiais',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fef2f2' }}>
                      <input type="number" step="0.01" style={inp(true)} value={ed.desc_emprestimo||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'desc_emprestimo',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fef2f2' }}>
                      <input type="number" step="0.01" style={inp(true)} value={ed.desc_acerto||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'desc_acerto',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'4px 4px', textAlign:'center', background:'#fef2f2' }}>
                      <input type="number" step="0.01" style={inp(true)} value={ed.desc_pensao||''} placeholder="0,00" onChange={e => setEdit(l.func_id,'desc_pensao',parseFloat(e.target.value)||0)} />
                    </td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'#dc2626', fontSize:12 }}>{tipo==='SALÁRIO'?formatR$(dsr):'—'}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'#dc2626', fontSize:12 }}>{tipo==='SALÁRIO'?'R$ 17,66':'—'}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'#dc2626', fontSize:12 }}>{tipo==='SALÁRIO'?formatR$(inss):'—'}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:700, color:'#065f46', background:'#dcfce7', fontSize:13 }}>{formatR$(total)}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', fontWeight:700, color:'#1e40af', background:'#eff6ff', fontSize:13 }}>{formatR$(contracheque)}</td>
                  </tr>
                )
              })}
              <tr style={{ background:'#1a3a5c', fontWeight:700 }}>
                <td style={{ padding:'9px 12px', color:'#fff', fontSize:12, position:'sticky', left:0, background:'#1a3a5c', zIndex:2 }}>TOTAL {equipe}</td>
                <td colSpan={20} style={{ padding:'9px 8px' }}></td>
                <td style={{ padding:'9px 8px', textAlign:'right', color:'#86efac', fontSize:13 }}>{formatR$(totalGeral)}</td>
                <td style={{ padding:'9px 8px', textAlign:'right', color:'#93c5fd', fontSize:13 }}>{formatR$(totalCC)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>

    {modalFunc && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
        onClick={() => setModalFunc(null)}>
        <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:440, overflow:'hidden' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ background:'#1a3a5c', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ color:'white', fontWeight:700, fontSize:15 }}>{modalFunc.l.nome}</div>
              <div style={{ color:'rgba(255,255,255,.6)', fontSize:12 }}>{equipe} · Pagamento Final — {mes}</div>
            </div>
            <button onClick={() => setModalFunc(null)} style={{ background:'none', border:'none', color:'white', fontSize:22, cursor:'pointer' }}>×</button>
          </div>
          <div style={{ padding:20 }}>
            {[
              { label:'Tipo', val: modalFunc.ed.tipo_pagamento || 'DIÁRIA', color:'#1a3a5c' },
              { label:'Total Diárias', val: modalFunc.l.total_diarias.toFixed(1) + ' dias', color:'#166534' },
              { label:'Extras Folha', val: modalFunc.l.extras_folha.toFixed(1) + ' dias', color:'#6d28d9' },
              { label:'Dias Úteis', val: modalFunc.l.dias_uteis.toFixed(1), color:'#1a3a5c' },
              { label:'Faltas', val: modalFunc.l.faltas, color:'#dc2626' },
              { label:'Valor da Diária', val: formatR$(modalFunc.l.valor_diaria), color:'#1a3a5c' },
              { label:'Salário Base', val: formatR$(modalFunc.l.salario_base), color:'#1a3a5c' },
              { label:'Extra Folha R$', val: formatR$(modalFunc.l.extra_folha_valor), color:'#6d28d9' },
              { label:'Hora Extra', val: formatR$(modalFunc.ed.hora_extra || 0), color:'#92400e' },
              { label:'Complemento', val: formatR$(modalFunc.ed.complemento || 0), color:'#92400e' },
              { label:'(-) Adiantamento', val: '-' + formatR$(modalFunc.l.adiantamento_valor), color:'#dc2626' },
              { label:'(-) Desc. Materiais', val: '-' + formatR$(modalFunc.ed.desc_materiais || 0), color:'#dc2626' },
              { label:'(-) Desc. Vale', val: '-' + formatR$(modalFunc.ed.desc_emprestimo || 0), color:'#dc2626' },
              { label:'(-) Desc. Pensão', val: '-' + formatR$(modalFunc.ed.desc_pensao || 0), color:'#dc2626' },
              { label:'(-) Desc. DSR', val: '-' + formatR$(modalFunc.ed.desc_dsr || 0), color:'#dc2626' },
              { label:'(-) Sindicato', val: '-' + formatR$(modalFunc.ed.desc_sindicato || 0), color:'#dc2626' },
              { label:'(-) INSS', val: '-' + formatR$(modalFunc.ed.desc_inss || 0), color:'#dc2626' },
            ].map((item, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #f3f4f6' }}>
                <span style={{ fontSize:13, color:'#6b7280' }}>{item.label}</span>
                <span style={{ fontSize:13, fontWeight:600, color: item.color }}>{item.val}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 4px', borderTop:'2px solid #e5e7eb', marginTop:4 }}>
              <span style={{ fontSize:14, fontWeight:700, color:'#1a3a5c' }}>TOTAL PGTO</span>
              <span style={{ fontSize:16, fontWeight:800, color:'#065f46' }}>{formatR$(modalFunc.calc.total)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#1e40af' }}>Contracheque</span>
              <span style={{ fontSize:14, fontWeight:700, color:'#1e40af' }}>{formatR$(modalFunc.calc.contracheque)}</span>
            </div>
          </div>
        </div>
      </div>
    )}
  )
}
