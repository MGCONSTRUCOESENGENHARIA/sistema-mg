'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, formatR$, formatDate, AUSENCIAS } from '@/lib/utils'
const CAFE_DIA = 10
interface Linha {
  func_id: string
  nome: string
  equipe: string
  tipo_passagem: string
  valor_fixo: number
  valor_gasto_quinzena: number
  total_cafe: number
  recebido_anterior: number
  dias_projetados: number
  adicional: number
  saldo_vt: number
  valor_projetado: number
  total_passagem: number
}

function diasCorridosDoMes(mes: string) {
  const [ano, mesNum] = mes.split('-').map(Number)
  const ultimoDia = new Date(ano, mesNum, 0).getDate()
  return Array.from({ length: ultimoDia }, (_, i) => new Date(ano, mesNum - 1, i + 1, 12, 0, 0))
}

function calcularLinha(l: Linha): Linha {
  const saldoVT = l.valor_gasto_quinzena - l.recebido_anterior
  if (l.tipo_passagem === 'REEMBOLSO') {
    return {
      ...l,
      saldo_vt: saldoVT,
      valor_projetado: 0,
      total_passagem: l.valor_gasto_quinzena + l.adicional,
    }
  }
  if (l.tipo_passagem === 'PRA FRENTE') {
    const valorProjetado = l.dias_projetados * l.valor_fixo
    return {
      ...l,
      saldo_vt: saldoVT,
      valor_projetado: valorProjetado,
      total_passagem: saldoVT + valorProjetado + l.adicional,
    }
  }
  return {
    ...l,
    saldo_vt: 0,
    valor_projetado: 0,
    total_passagem: l.adicional,
  }
}
export default function PassagemCafePage() {
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [mes, setMes] = useState(mesAtual())
  const [quinzena, setQuinzena] = useState<1 | 2>(1)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    carregar()
  }, [equipe, mes, quinzena])
  async function carregar() {
    setLoading(true)
    const { data: comp } = await supabase
      .from('competencias')
      .select('id')
      .eq('mes_ano', mes)
      .maybeSingle()
    const { data: funcs } = await supabase
      .from('funcionarios')
      .select('id,nome,equipe')
      .eq('equipe', equipe)
      .eq('ativo', true)
      .order('nome')
    if (!funcs || funcs.length === 0) {
      setLinhas([])
      setLoading(false)
      return
    }
    // Usa dias corridos do mês para NÃO deixar sábado extra fora do cálculo.
    // 1ª quinzena: dia 01 ao dia 15. 2ª quinzena: dia 16 ao último dia do mês.
    const diasMes = diasCorridosDoMes(mes)
    const diasPeriodo = diasMes.filter(d => quinzena === 1 ? d.getDate() <= 15 : d.getDate() >= 16)
    const ids = funcs.map((f: any) => f.id)
    let presencas: any[] = []
    if (comp?.id) {
      // Busca TODAS as presenças do mês para capturar sábados extras (Ex1/Ex2)
      // O filtro por quinzena é feito na hora de calcular via tipo SABADO_EXTRA
      const { data: pres } = await supabase
        .from('presencas')
        .select('funcionario_id,data,tipo,fracao,fracao2,obra_id,obra2_id')
        .eq('competencia_id', comp.id)
        .in('funcionario_id', ids)
      presencas = pres || []
    }
    const { data: passDB } = await supabase
      .from('funcionario_obra_passagem')
      .select('funcionario_id,obra_id,tipo_passagem,valor_passagem')
      .in('funcionario_id', ids)
    let passQuinzena: any[] = []
    if (comp?.id) {
      const { data: pq } = await supabase
        .from('passagens_quinzena')
        .select('*')
        .eq('competencia_id', comp.id)
        .eq('quinzena', quinzena)
        .in('funcionario_id', ids)
      passQuinzena = pq || []
    }

    // Busca quinzena anterior para pré-preencher recebido_ant automaticamente
    // 1ª quinzena atual → usa 2ª quinzena do mês anterior
    // 2ª quinzena atual → usa 1ª quinzena do mesmo mês
    let passQuinzenaAnt: any[] = []
    if (quinzena === 2) {
      // Quinzena anterior é a 1ª do mesmo mês
      if (comp?.id) {
        const { data: pqAnt } = await supabase
          .from('passagens_quinzena')
          .select('funcionario_id,valor_proj,adicional,recebido_ant')
          .eq('competencia_id', comp.id)
          .eq('quinzena', 1)
          .in('funcionario_id', ids)
        passQuinzenaAnt = pqAnt || []
      }
    } else {
      // Quinzena anterior é a 2ª do mês anterior
      const [ano, mesNum] = mes.split('-').map(Number)
      const dataMesAnt = new Date(ano, mesNum - 2, 1)
      const mesAntStr = `${dataMesAnt.getFullYear()}-${String(dataMesAnt.getMonth() + 1).padStart(2, '0')}`
      const { data: compAnt } = await supabase
        .from('competencias')
        .select('id')
        .eq('mes_ano', mesAntStr)
        .maybeSingle()
      if (compAnt?.id) {
        const { data: pqAnt } = await supabase
          .from('passagens_quinzena')
          .select('funcionario_id,valor_proj,adicional,recebido_ant')
          .eq('competencia_id', compAnt.id)
          .eq('quinzena', 2)
          .in('funcionario_id', ids)
        passQuinzenaAnt = pqAnt || []
      }
    }
    const resultado: Linha[] = funcs.map((func: any) => {
      const presFunci = presencas
        .filter(p => p.funcionario_id === func.id)
        .sort((a, b) => String(a.data).localeCompare(String(b.data)))
      const pqFunci = passQuinzena.find(p => p.funcionario_id === func.id)
      let valorGasto = 0
      let diasTrabalhados = 0
      let totalCafe = 0
      let ultimoValorPraFrente = 0
      const diasPeriodoStr = new Set(diasPeriodo.map(d => formatDate(d)))
      presFunci.forEach(p => {
        if (['FALTA', ...AUSENCIAS].includes(p.tipo)) return
        if (!p.obra_id) return
        if (p.tipo !== 'NORMAL' && p.tipo !== 'SABADO_EXTRA') return
        // NORMAL: só conta se a data está no período da quinzena
        // SABADO_EXTRA: Ex1 conta na 1ª quinzena, Ex2 conta na 2ª quinzena
        // Como não temos tipo Ex1/Ex2 separado, usamos a data para identificar:
        // sábados extras do mês inteiro são separados pelos dois primeiros (Ex1) e demais (Ex2)
        if (p.tipo === 'NORMAL' && !diasPeriodoStr.has(String(p.data))) return
        // Para SABADO_EXTRA: divide pelo dia — até dia 15 = Ex1 (1ª quinzena), após = Ex2 (2ª quinzena)
        if (p.tipo === 'SABADO_EXTRA') {
          const dia = new Date(String(p.data) + 'T12:00:00').getDate()
          if (quinzena === 1 && dia > 15) return
          if (quinzena === 2 && dia <= 15) return
        }
        const temDuasObras = !!p.obra2_id
        const fracao1 = temDuasObras ? 0.5 : Number(p.fracao || 1)
        const fracao2 = temDuasObras ? 0.5 : Number(p.fracao2 || 0)
        const soma = fracao1 + fracao2
        if (soma === 0) return
        diasTrabalhados += soma
        totalCafe += CAFE_DIA * soma
        const fop1 = p.obra_id
          ? passDB?.find(x => x.funcionario_id === func.id && x.obra_id === p.obra_id)
          : null
        const fop2 = p.obra2_id
          ? passDB?.find(x => x.funcionario_id === func.id && x.obra_id === p.obra2_id)
          : null
        if (fop1) {
          valorGasto += Number(fop1.valor_passagem || 0) * fracao1
          if (fop1.tipo_passagem === 'PRA FRENTE') {
            ultimoValorPraFrente = Number(fop1.valor_passagem || 0)
          }
        }
        if (fop2) {
          valorGasto += Number(fop2.valor_passagem || 0) * fracao2
          if (fop2.tipo_passagem === 'PRA FRENTE') {
            ultimoValorPraFrente = Number(fop2.valor_passagem || 0)
          }
        }
      })
      const tiposFunc = passDB?.filter(x => x.funcionario_id === func.id) || []
      const tipos = tiposFunc.map(x => x.tipo_passagem)
      const counts: Record<string, number> = {}
      tipos.forEach(t => {
        counts[t] = (counts[t] || 0) + 1
      })
      const tipoFinal =
        Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'MG'
      // Se já foi salvo manualmente, usa o valor salvo.
      // Senão, pré-preenche com valor_proj + adicional da quinzena anterior.
      const pqAntFunci = passQuinzenaAnt.find(p => p.funcionario_id === func.id)
      const recebidoAntAutomatic = pqAntFunci
        ? Number(pqAntFunci.valor_proj || 0) + Number(pqAntFunci.adicional || 0)
        : 0
      const recebidoAnt = pqFunci?.recebido_ant != null
        ? Number(pqFunci.recebido_ant)
        : recebidoAntAutomatic
      const diasProj = Number(pqFunci?.dias_proj ?? (tipoFinal === 'PRA FRENTE' ? diasTrabalhados : 0))
      const adicional = Number(pqFunci?.adicional ?? 0)
      const valorFixo = Number(
        ultimoValorPraFrente ||
        tiposFunc.find(x => x.tipo_passagem === 'PRA FRENTE')?.valor_passagem ||
        0
      )
      const linhaBase: Linha = {
        func_id: func.id,
        nome: func.nome,
        equipe: func.equipe,
        tipo_passagem: tipoFinal,
        valor_fixo: valorFixo,
        valor_gasto_quinzena: valorGasto,
        total_cafe: totalCafe,
        recebido_anterior: recebidoAnt,
        dias_projetados: diasProj,
        adicional,
        saldo_vt: 0,
        valor_projetado: 0,
        total_passagem: 0,
      }
      return calcularLinha(linhaBase)
    })
    setLinhas(resultado)
    setLoading(false)
  }
  function atualizar(
    funcId: string,
    field: 'recebido_anterior' | 'dias_projetados' | 'adicional' | 'valor_fixo',
    val: number
  ) {
    setLinhas(prev =>
      prev.map(l => {
        if (l.func_id !== funcId) return l
        return calcularLinha({ ...l, [field]: val })
      })
    )
  }
  async function obterCompetencia() {
    let { data: comp, error: erroBusca } = await supabase
      .from('competencias')
      .select('id')
      .eq('mes_ano', mes)
      .maybeSingle()
    if (erroBusca) throw new Error(erroBusca.message)
    if (!comp) {
      const { data: nova, error: erroComp } = await supabase
        .from('competencias')
        .insert({ mes_ano: mes, status: 'ABERTA' })
        .select('id')
        .single()
      if (erroComp) throw new Error(erroComp.message)
      comp = nova
    }
    return comp
  }
  async function salvarLinhaNoBanco(l: Linha, competenciaId: string) {
    const linhaCalculada = calcularLinha(l)
    const payload = {
      competencia_id: competenciaId,
      funcionario_id: linhaCalculada.func_id,
      quinzena,
      total_passagem: linhaCalculada.total_passagem,
      total_cafe: linhaCalculada.total_cafe,
      valor_gasto: linhaCalculada.valor_gasto_quinzena,
      recebido_ant: linhaCalculada.recebido_anterior,
      saldo_vt: linhaCalculada.saldo_vt,
      dias_proj: linhaCalculada.dias_projetados,
      valor_proj: linhaCalculada.valor_projetado,
      adicional: linhaCalculada.adicional,
    }
    const { data: existing } = await supabase
      .from('passagens_quinzena')
      .select('id')
      .eq('competencia_id', competenciaId)
      .eq('funcionario_id', linhaCalculada.func_id)
      .eq('quinzena', quinzena)
      .maybeSingle()
    let error = null
    if (existing) {
      const { error: e } = await supabase.from('passagens_quinzena').update(payload).eq('id', existing.id)
      error = e
    } else {
      const { error: e } = await supabase.from('passagens_quinzena').insert(payload)
      error = e
    }
    if (error) throw new Error(error.message)
  }
  async function salvarLinha(l: Linha) {
    try {
      setSalvando(l.func_id)
      const comp = await obterCompetencia()
      await salvarLinhaNoBanco(l, comp.id)
      setMsg('✅ Salvo!')
      setTimeout(() => setMsg(''), 2000)
      await carregar()
    } catch (error: any) {
      alert('Erro ao salvar: ' + error.message)
    } finally {
      setSalvando(null)
    }
  }
  async function salvarTodos() {
    try {
      setSalvando('all')
      const comp = await obterCompetencia()
      for (const l of linhas) {
        await salvarLinhaNoBanco(l, comp.id)
      }
      setMsg('✅ Todos salvos!')
      setTimeout(() => setMsg(''), 2500)
      await carregar()
    } catch (error: any) {
      alert('Erro ao salvar todos: ' + error.message)
    } finally {
      setSalvando(null)
    }
  }
  const totPassagem = linhas.reduce((s, l) => s + l.total_passagem, 0)
  const totCafe = linhas.reduce((s, l) => s + l.total_cafe, 0)
  const totGeral = totPassagem + totCafe
  const corTipo: Record<string, { bg: string; color: string }> = {
    'PRA FRENTE': { bg: '#dbeafe', color: '#1e40af' },
    'REEMBOLSO': { bg: '#fef9c3', color: '#854d0e' },
    MG: { bg: '#f3f4f6', color: '#6b7280' },
    'NÃO TEM': { bg: '#f3f4f6', color: '#9ca3af' },
  }
  const btnEq = (eq: 'ARMAÇÃO' | 'CARPINTARIA') => ({
    padding: '7px 18px',
    borderRadius: 8,
    border: '2px solid #1a3a5c',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
    background: equipe === eq ? '#1a3a5c' : '#fff',
    color: equipe === eq ? '#fff' : '#1a3a5c',
  })
  const inputStyle = {
    width: 80,
    textAlign: 'right' as const,
    border: '1px solid #fbbf24',
    borderRadius: 4,
    padding: '3px 6px',
    fontSize: 12,
    background: '#fefce8',
    fontWeight: 600,
  }
  return (
    <div style={{ width: '100%', maxWidth: 1500, margin: '0 auto', padding: '16px 20px 32px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btnEq('ARMAÇÃO')} onClick={() => setEquipe('ARMAÇÃO')}>Armação</button>
        <button style={btnEq('CARPINTARIA')} onClick={() => setEquipe('CARPINTARIA')}>Carpintaria</button>
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #d1d5db' }}>
          {([1, 2] as const).map(q => (
            <button key={q} onClick={() => setQuinzena(q)}
              style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: quinzena === q ? '#1a3a5c' : '#fff', color: quinzena === q ? '#fff' : '#374151' }}>
              {q === 1 ? '1ª Quinzena (Dia 16)' : '2ª Quinzena (Dia 01)'}
            </button>
          ))}
        </div>
        <select value={mes} onChange={e => setMes(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => {
            const v = `2026-${m}`
            const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
            return <option key={v} value={v}>{nomes[+m - 1]} 2026</option>
          })}
        </select>
        <button onClick={salvarTodos} disabled={salvando === 'all'}
          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          {salvando === 'all' ? 'Salvando...' : '💾 Salvar Todos'}
        </button>
        <button onClick={() => window.print()}
          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #6b7280', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          🖨 Imprimir
        </button>
      </div>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c', marginBottom: 4 }}>
        Passagem & Café — {equipe} · {quinzena === 1 ? '1ª Quinzena' : '2ª Quinzena'}
      </h1>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
        Campos em <span style={{ background: '#fefce8', border: '1px solid #fbbf24', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>amarelo</span> são editáveis · Café = R$10/dia trabalhado
      </p>
      {msg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 10, color: '#14532d', fontSize: 13 }}>
          {msg}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 14 }}>
        {[
          { label: 'Total a Receber de Passagem', val: totPassagem, color: '#1e40af' },
          { label: `Total Café da Manhã (R$${CAFE_DIA}/dia)`, val: totCafe, color: '#166534' },
          { label: 'Total Geral', val: totGeral, color: '#1a3a5c' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{formatR$(s.val)}</div>
          </div>
        ))}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Calculando...</div>
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 1px 3px rgba(15,23,42,.08)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1380 }}>
            <thead>
              <tr>
                {[
                  { label: 'FUNCIONÁRIO', bg: '#1a3a5c', min: 220, sticky: true },
                  { label: 'TIPO', bg: '#374151', min: 100 },
                  { label: 'VL FIXO/DIA', bg: '#374151' },
                  { label: 'VL GASTO QUINZ.', bg: '#7c3aed' },
                  { label: 'RECEBIDO ANT.', bg: '#7c3aed' },
                  { label: 'SALDO VT', bg: '#1a3a5c' },
                  { label: 'DIAS PROJ.', bg: '#7c3aed' },
                  { label: 'VL PROJETADO', bg: '#1a3a5c' },
                  { label: 'ADICIONAL', bg: '#7c3aed' },
                  { label: 'TOTAL PASSAGEM', bg: '#1e4d2b' },
                  { label: 'TOTAL CAFÉ', bg: '#166534' },
                  { label: 'AÇÃO', bg: '#374151' },
                ].map((h, i) => (
                  <th key={i} style={{ background: h.bg, color: '#fff', padding: '8px 10px', textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 700, minWidth: h.min || 100, whiteSpace: 'nowrap', position: h.sticky ? 'sticky' : undefined, left: h.sticky ? 0 : undefined, zIndex: h.sticky ? 20 : undefined }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, fi) => {
                const bg = fi % 2 === 0 ? '#fff' : '#f9fafb'
                const cor = corTipo[l.tipo_passagem] || corTipo.MG
                const isPraFrente = l.tipo_passagem === 'PRA FRENTE'
                const isReembolso = l.tipo_passagem === 'REEMBOLSO'
                const saldoNeg = l.saldo_vt < 0
                const totalNeg = l.total_passagem < 0
                return (
                  <tr key={l.func_id} style={{ background: bg }}>
                    <td style={{ padding: '6px 12px', fontWeight: 600, color: '#1a3a5c', fontSize: 12, position: 'sticky', left: 0, background: bg, zIndex: 1, borderRight: '2px solid #e5e7eb', whiteSpace: 'nowrap', minWidth: 220 }}>
                      {l.nome}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <span style={{ background: cor.bg, color: cor.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                        {l.tipo_passagem}
                      </span>
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', background: isPraFrente ? '#fefce8' : '#f9fafb' }}>
                      {isPraFrente ? (
                        <input type="number" step="0.01" style={inputStyle} value={l.valor_fixo || ''} placeholder="0,00"
                          onChange={e => atualizar(l.func_id, 'valor_fixo', parseFloat(e.target.value) || 0)} />
                      ) : (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: 12, background: '#f5f3ff', fontWeight: 600 }}>
                      {l.valor_gasto_quinzena > 0 ? formatR$(l.valor_gasto_quinzena) : '—'}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', background: '#fefce8' }}>
                      <input type="number" step="0.01" style={inputStyle} value={l.recebido_anterior || ''} placeholder="0,00"
                        onChange={e => atualizar(l.func_id, 'recebido_anterior', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: saldoNeg ? '#dc2626' : '#166534' }}>
                      {isReembolso ? '—' : formatR$(l.saldo_vt)}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', background: isPraFrente ? '#fefce8' : '#f9fafb' }}>
                      {isPraFrente ? (
                        <input type="number" step="0.5" style={{ ...inputStyle, width: 60 }} value={l.dias_projetados || ''} placeholder="0"
                          onChange={e => atualizar(l.func_id, 'dias_projetados', parseFloat(e.target.value) || 0)} />
                      ) : (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: 12, color: isPraFrente ? '#1e40af' : '#9ca3af' }}>
                      {isPraFrente ? formatR$(l.valor_projetado) : '—'}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', background: '#fefce8' }}>
                      <input type="number" step="0.01" style={inputStyle} value={l.adicional || ''} placeholder="0,00"
                        onChange={e => atualizar(l.func_id, 'adicional', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: totalNeg ? '#dc2626' : '#1e4d2b', background: '#f0fdf4' }}>
                      {formatR$(l.total_passagem)}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: 12, color: '#166534', background: '#f0fdf4' }}>
                      {formatR$(l.total_cafe)}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <button onClick={() => salvarLinha(l)} disabled={salvando === l.func_id}
                        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#1a3a5c', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                        {salvando === l.func_id ? '...' : 'Salvar'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: '#1a3a5c', fontWeight: 700 }}>
                <td style={{ padding: '9px 12px', color: '#fff', fontSize: 12, position: 'sticky', left: 0, background: '#1a3a5c', zIndex: 1 }}>
                  TOTAL {equipe}
                </td>
                <td colSpan={8} style={{ padding: '9px 10px' }}></td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#86efac', fontSize: 13 }}>{formatR$(totPassagem)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#86efac', fontSize: 13 }}>{formatR$(totCafe)}</td>
                <td style={{ padding: '9px 10px' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
