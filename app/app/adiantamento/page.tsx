'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$, diasDoMes, formatDate, fim1Quinzena, AUSENCIAS } from '@/lib/utils'

interface Linha {
  func_id: string
  nome: string
  equipe: string
  pix_tipo: string | null
  pix_chave: string | null
  valor_diaria: number
  salario_base: number
  total_diarias: number
  extras_folha: number
  extra_folha_valor: number
  adiantamento: number
  complemento: number
  descontos: number
  total_pagamento: number
}

export default function AdiantamentoPage() {
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [mes, setMes] = useState(mesAtual())
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Record<string, { complemento: number; descontos: number }>>({})
  const [msg, setMsg] = useState('')
  const [modalFunc, setModalFunc] = useState<any>(null)
  const [mostrarResumo, setMostrarResumo] = useState(false)

  useEffect(() => { carregar() }, [equipe, mes])

  async function carregar() {
    setLoading(true)

    const { data: comp } = await supabase
      .from('competencias')
      .select('id')
      .eq('mes_ano', mes)
      .maybeSingle()

    const { data: funcs } = await supabase
      .from('funcionarios')
      .select('id,nome,equipe,valor_diaria,salario_base,pix_tipo,pix_chave')
      .eq('equipe', equipe)
      .eq('ativo', true)
      .order('nome')

    if (!funcs || funcs.length === 0) {
      setLinhas([])
      setLoading(false)
      return
    }

    const diasMes = diasDoMes(mes)
    const f1 = fim1Quinzena(diasMes)
    const dias1Q = diasMes.slice(0, f1 + 1)

    let presencas: any[] = []
    if (comp?.id) {
      const { data: pres } = await supabase
        .from('presencas')
        .select('funcionario_id,tipo,fracao,fracao2,data')
        .eq('competencia_id', comp.id)
        .in('data', dias1Q.map(d => formatDate(d)))
        .in('funcionario_id', funcs.map((f: any) => f.id))

      presencas = pres || []
    }

    let avulsos: any[] = []
    if (comp?.id) {
      const { data: av } = await supabase
        .from('avulso_parcelas')
        .select('*, avulsos(funcionario_id)')
        .eq('mes_ano', mes)
        .eq('quando', 'adiantamento')
        .eq('descontado', false)

      avulsos = av || []
    }

    const resultado: Linha[] = funcs.map((func: any) => {
      const presFunci = presencas.filter(p => p.funcionario_id === func.id)
      let totalDiarias = 0
      let extrasFolha = 0

      presFunci.forEach(p => {
        if (['FALTA', ...AUSENCIAS].includes(p.tipo)) return

        const soma = Number(p.fracao || 0) + Number(p.fracao2 || 0)

        if (p.tipo === 'SABADO_EXTRA') {
          extrasFolha += soma
        } else {
          totalDiarias += soma
        }
      })

      const salarioBase = Number(func.salario_base || 0)
      const valorDiaria = Number(func.valor_diaria || 0)
      const adiantamento = salarioBase * 0.5
      const extraFolhaValor = extrasFolha * valorDiaria

      const descFunci = avulsos
        .filter((a: any) => a.avulsos?.funcionario_id === func.id)
        .reduce((s: number, a: any) => s + Number(a.valor || 0), 0)

      const editFunci = editando[func.id] || {
        complemento: 0,
        descontos: descFunci,
      }

      const total = adiantamento + extraFolhaValor + editFunci.complemento - editFunci.descontos

      return {
        func_id: func.id,
        nome: func.nome,
        equipe: func.equipe,
        pix_tipo: func.pix_tipo || '',
        pix_chave: func.pix_chave || '',
        valor_diaria: valorDiaria,
        salario_base: salarioBase,
        total_diarias: totalDiarias,
        extras_folha: extrasFolha,
        extra_folha_valor: extraFolhaValor,
        adiantamento,
        complemento: editFunci.complemento,
        descontos: editFunci.descontos,
        total_pagamento: total,
      }
    })

    let ajustes: any[] = []
    if (comp?.id) {
      const { data: aj } = await supabase
        .from('pagamento_ajustes')
        .select('*')
        .eq('competencia_id', comp.id)
        .eq('tipo', 'adiantamento')
        .in('funcionario_id', funcs.map((f: any) => f.id))

      ajustes = aj || []
    }

    setLinhas(resultado)

    const newEdit: typeof editando = {}
    resultado.forEach(l => {
      const aj = ajustes.find(a => a.funcionario_id === l.func_id)
      newEdit[l.func_id] = aj
        ? {
            complemento: Number(aj.complemento || 0),
            descontos: Number(aj.descontos || l.descontos || 0),
          }
        : {
            complemento: 0,
            descontos: Number(l.descontos || 0),
          }
    })

    setEditando(newEdit)
    setLoading(false)
  }

  const saveTimers = useRef<Record<string, any>>({})

  async function salvarAjuste(funcId: string, newEd: any) {
    const { data: comp } = await supabase
      .from('competencias')
      .select('id')
      .eq('mes_ano', mes)
      .maybeSingle()

    if (!comp?.id) return

    await supabase.from('pagamento_ajustes').upsert({
      competencia_id: comp.id,
      funcionario_id: funcId,
      tipo: 'adiantamento',
      hora_extra: 0,
      complemento: Number(newEd.complemento || 0),
      descontos: Number(newEd.descontos || 0),
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'competencia_id,funcionario_id,tipo' })
  }

  function setEdit(funcId: string, field: 'complemento' | 'descontos', val: number) {
    setEditando(ed => {
      const newEd = {
        ...(ed[funcId] || { complemento: 0, descontos: 0 }),
        [field]: val,
      }

      clearTimeout(saveTimers.current[funcId])
      saveTimers.current[funcId] = setTimeout(() => salvarAjuste(funcId, newEd), 800)

      return { ...ed, [funcId]: newEd }
    })
  }

  function getEd(funcId: string, descontosPadrao = 0) {
    return editando[funcId] || { complemento: 0, descontos: descontosPadrao }
  }

  function horaExtra(linha: Linha) {
    return linha.extras_folha * linha.valor_diaria
  }

  function adiantamentoLiquido(linha: Linha) {
    const ed = getEd(linha.func_id, linha.descontos)
    return linha.adiantamento - Number(ed.descontos || 0)
  }

  function recalcular(linha: Linha) {
    const ed = getEd(linha.func_id, linha.descontos)
    return adiantamentoLiquido(linha) + horaExtra(linha) + Number(ed.complemento || 0)
  }

  function copiarResumo() {
    const linhasResumo = linhas.map(l => {
      const ed = getEd(l.func_id, l.descontos)
      return `${l.nome}\t${l.pix_tipo || '—'}\t${l.pix_chave || '—'}\t${formatR$(adiantamentoLiquido(l))}\t${formatR$(horaExtra(l))}\t${formatR$(ed.complemento || 0)}`
    })

    const texto = [
      `RESUMO ADIANTAMENTO — ${equipe} — ${nomeMes(mes)}`,
      '',
      'FUNCIONÁRIO\tPIX\tCHAVE PIX\tADIANTAMENTO\tHORA EXTRA\tCOMPLEMENTO',
      ...linhasResumo,
      '',
      `TOTAL\t\t\t${formatR$(totalAdiantLiquido)}\t${formatR$(totalHoraExtra)}\t${formatR$(totalComplemento)}`,
    ].join('\n')

    navigator.clipboard.writeText(texto)
    setMsg('✅ Resumo copiado!')
    setTimeout(() => setMsg(''), 2000)
  }

  const totalDiarias = linhas.reduce((s, l) => s + l.total_diarias, 0)
  const totalExtras = linhas.reduce((s, l) => s + l.extras_folha, 0)
  const totalAdiant = linhas.reduce((s, l) => s + l.adiantamento, 0)
  const totalDesc = linhas.reduce((s, l) => s + Number(getEd(l.func_id, l.descontos).descontos || 0), 0)
  const totalAdiantLiquido = linhas.reduce((s, l) => s + adiantamentoLiquido(l), 0)
  const totalHoraExtra = linhas.reduce((s, l) => s + horaExtra(l), 0)
  const totalComplemento = linhas.reduce((s, l) => s + Number(getEd(l.func_id, l.descontos).complemento || 0), 0)
  const totalGeral = linhas.reduce((s, l) => s + recalcular(l), 0)

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
    width: 90,
    textAlign: 'right' as const,
    border: '1px solid #fbbf24',
    borderRadius: 4,
    padding: '3px 6px',
    fontSize: 12,
    background: '#fefce8',
    fontWeight: 600,
  }

  return (
    <div>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          html,
          body {
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .print-resumo,
          .print-resumo * {
            visibility: visible !important;
          }

          .print-resumo {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }

          .print-resumo-scroll {
            overflow: visible !important;
            padding: 10px !important;
          }

          .print-resumo table {
            width: 100% !important;
            min-width: 0 !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }

          .print-resumo tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }

          .print-resumo th,
          .print-resumo td {
            font-size: 9px !important;
            padding: 5px 6px !important;
          }

          .no-print {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btnEq('ARMAÇÃO')} onClick={() => setEquipe('ARMAÇÃO')}>Armação</button>
        <button style={btnEq('CARPINTARIA')} onClick={() => setEquipe('CARPINTARIA')}>Carpintaria</button>

        <select
          value={mes}
          onChange={e => {
            setMes(e.target.value)
            setEditando({})
          }}
          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}
        >
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => {
            const v = `2026-${m}`
            const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
            return <option key={v} value={v}>{nomes[+m - 1]} 2026</option>
          })}
        </select>

        <button
          onClick={() => setMostrarResumo(true)}
          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1a3a5c', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
        >
          📋 Resumo para pagamento
        </button>

        <button
          onClick={() => window.print()}
          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #6b7280', background: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          🖨 Imprimir
        </button>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
          Hora extra automática · Adiantamento do resumo já desconta os descontos
        </span>
      </div>

      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c', marginBottom: 2 }}>
        Adiantamento — Dia 20 · {equipe}
      </h1>

      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
        1ª Quinzena de {nomeMes(mes)} · Adiantamento = 50% do salário base
      </p>

      {msg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#14532d', fontSize: 13 }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 'max-content', width: '100%' }}>
            <thead>
              <tr>
                {[
                  { label: 'FUNCIONÁRIO', bg: '#1a3a5c', min: 220, sticky: true },
                  { label: 'DIAS TRABALHADOS', bg: '#1e4d2b' },
                  { label: 'SÁBADOS E FERIADOS', bg: '#4c1d95' },
                  { label: 'VALOR', bg: '#1a3a5c' },
                  { label: 'SALÁRIO BASE', bg: '#1a3a5c' },
                  { label: 'ADIANTAMENTO', bg: '#065f46' },
                  { label: 'HORA EXTRA', bg: '#7c2d12' },
                  { label: 'COMPLEMENTO', bg: '#7c2d12' },
                  { label: 'DESCONTOS', bg: '#991b1b' },
                  { label: 'TOTAL DO PAGAMENTO', bg: '#064e3b' },
                ].map((h, i) => (
                  <th key={i} style={{
                    background: h.bg,
                    color: '#fff',
                    padding: '8px 10px',
                    textAlign: i === 0 ? 'left' : 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: h.min || 110,
                    whiteSpace: 'nowrap',
                    position: h.sticky ? 'sticky' : undefined,
                    left: h.sticky ? 0 : undefined,
                    zIndex: h.sticky ? 20 : undefined,
                  }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {linhas.map((l, fi) => {
                const ed = getEd(l.func_id, l.descontos)
                const total = recalcular(l)
                const bg = fi % 2 === 0 ? '#fff' : '#f9fafb'

                return (
                  <tr key={l.func_id} style={{ background: bg }}>
                    <td
                      style={{ padding: '7px 12px', fontWeight: 600, color: '#1a3a5c', fontSize: 12, position: 'sticky', left: 0, background: bg, zIndex: 2, borderRight: '2px solid #e5e7eb', whiteSpace: 'nowrap', minWidth: 220, cursor: 'pointer' }}
                      onClick={() => setModalFunc({ l, ed, total })}
                    >
                      <span style={{ borderBottom: '1px dashed #93c5fd' }}>{l.nome}</span>
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

                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#92400e', background: '#fff7ed', fontSize: 13 }}>
                      {formatR$(horaExtra(l))}
                    </td>

                    <td style={{ padding: '4px 6px', textAlign: 'center', background: '#fff7ed' }}>
                      <input
                        type="number"
                        step="0.01"
                        style={inputStyle}
                        value={ed.complemento || ''}
                        placeholder="0,00"
                        onChange={e => setEdit(l.func_id, 'complemento', parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    <td style={{ padding: '4px 6px', textAlign: 'center', background: '#fef2f2' }}>
                      <input
                        type="number"
                        step="0.01"
                        style={{ ...inputStyle, border: '1px solid #fca5a5', background: '#fef2f2' }}
                        value={ed.descontos || ''}
                        placeholder="0,00"
                        onChange={e => setEdit(l.func_id, 'descontos', parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#065f46', background: '#dcfce7', fontSize: 14 }}>
                      {formatR$(total)}
                    </td>
                  </tr>
                )
              })}

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
                <td style={{ padding: '9px 10px' }}></td>
                <td style={{ padding: '9px 10px' }}></td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#86efac', fontSize: 13 }}>
                  {formatR$(totalAdiant)}
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#c4b5fd', fontSize: 12 }}>
                  {totalHoraExtra > 0 ? formatR$(totalHoraExtra) : '—'}
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#c4b5fd', fontSize: 12 }}>
                  {totalComplemento > 0 ? formatR$(totalComplemento) : '—'}
                </td>
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

      {mostrarResumo && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setMostrarResumo(false)}
        >
          <div
            className="print-resumo"
            style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 900, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#1a3a5c', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>Resumo para pagamento — {equipe}</div>
                <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12 }}>{nomeMes(mes)} · Adiantamento líquido = adiantamento - descontos</div>
              </div>
              <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={copiarResumo}
                  style={{ background: '#fff', border: 'none', color: '#1a3a5c', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Copiar
                </button>
                <button
                  onClick={() => window.print()}
                  style={{ background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.35)', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Imprimir
                </button>
                <button onClick={() => setMostrarResumo(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer' }}>×</button>
              </div>
            </div>

            <div className="print-resumo-scroll" style={{ padding: 16, overflow: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 980 }}>
                <thead>
                  <tr>
                    {['FUNCIONÁRIO', 'PIX', 'CHAVE PIX', 'ADIANTAMENTO', 'HORA EXTRA', 'COMPLEMENTO'].map((h, i) => (
                      <th key={h} style={{
                        background: i === 0 ? '#1a3a5c' : '#374151',
                        color: '#fff',
                        padding: '9px 10px',
                        textAlign: i <= 2 ? 'left' : 'right',
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => {
                    const ed = getEd(l.func_id, l.descontos)
                    const bg = i % 2 === 0 ? '#fff' : '#f9fafb'

                    return (
                      <tr key={l.func_id} style={{ background: bg }}>
                        <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#1a3a5c', borderBottom: '1px solid #e5e7eb' }}>{l.nome}</td>
                        <td style={{ padding: '8px 10px', fontSize: 12, borderBottom: '1px solid #e5e7eb', color: '#374151', fontWeight: 600 }}>{l.pix_tipo || '—'}</td>
                        <td style={{ padding: '8px 10px', fontSize: 12, borderBottom: '1px solid #e5e7eb', color: '#374151', fontWeight: 600 }}>{l.pix_chave || '—'}</td>
                        <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#065f46', fontWeight: 700 }}>{formatR$(adiantamentoLiquido(l))}</td>
                        <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#92400e', fontWeight: 700 }}>{formatR$(horaExtra(l))}</td>
                        <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right', borderBottom: '1px solid #e5e7eb', color: '#1e40af', fontWeight: 700 }}>{formatR$(ed.complemento || 0)}</td>
                      </tr>
                    )
                  })}

                  <tr style={{ background: '#1a3a5c', fontWeight: 800 }}>
                    <td style={{ padding: '10px', color: '#fff', fontSize: 12 }}>TOTAL {equipe}</td>
                    <td style={{ padding: '10px', color: '#fff', fontSize: 13 }}></td>
                    <td style={{ padding: '10px', color: '#fff', fontSize: 13 }}></td>
                    <td style={{ padding: '10px', color: '#86efac', fontSize: 13, textAlign: 'right' }}>{formatR$(totalAdiantLiquido)}</td>
                    <td style={{ padding: '10px', color: '#fed7aa', fontSize: 13, textAlign: 'right' }}>{formatR$(totalHoraExtra)}</td>
                    <td style={{ padding: '10px', color: '#bfdbfe', fontSize: 13, textAlign: 'right' }}>{formatR$(totalComplemento)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalFunc && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setModalFunc(null)}
        >
          <div
            style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#1a3a5c', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{modalFunc.l.nome}</div>
                <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>{equipe} · Adiantamento — {mes}</div>
              </div>
              <button onClick={() => setModalFunc(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: 20 }}>
              {[
                { label: 'Dias Trabalhados', val: modalFunc.l.total_diarias.toFixed(1), unit: ' dias', color: '#166534' },
                { label: 'Sábados e Feriados', val: modalFunc.l.extras_folha.toFixed(1), unit: ' dias', color: '#6d28d9' },
                { label: 'Valor', val: formatR$(modalFunc.l.valor_diaria), color: '#1a3a5c' },
                { label: 'Salário Base', val: formatR$(modalFunc.l.salario_base), color: '#1a3a5c' },
                { label: 'Adiantamento (50%)', val: formatR$(modalFunc.l.adiantamento), color: '#065f46', bold: true },
                { label: 'Hora Extra', val: formatR$(horaExtra(modalFunc.l)), color: '#92400e' },
                { label: 'Complemento', val: formatR$(modalFunc.ed.complemento || 0), color: '#92400e' },
                { label: 'Descontos', val: '-' + formatR$(modalFunc.ed.descontos || 0), color: '#dc2626' },
                { label: 'Adiantamento líquido', val: formatR$(adiantamentoLiquido(modalFunc.l)), color: '#065f46', bold: true },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: item.bold ? 700 : 600, color: item.color }}>{item.val}{item.unit || ''}</span>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', marginTop: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1a3a5c' }}>TOTAL DO PAGAMENTO</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#065f46' }}>{formatR$(modalFunc.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
