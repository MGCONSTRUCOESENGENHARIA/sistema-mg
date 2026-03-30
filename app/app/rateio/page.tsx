'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$ } from '@/lib/utils'

interface LinhaRateio {
  obra_id: string
  obra: string
  codigo: string
  total_armacao: number
  total_carpintaria: number
  total_geral: number
  percentual: number
  ant?: number
}

export default function RateioPage() {
  const [mes, setMes] = useState(mesAtual())
  const [linhas, setLinhas] = useState<LinhaRateio[]>([])
  const [loading, setLoading] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { carregar() }, [mes])

  async function carregar() {
    setLoading(true)
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).single()
    if (!comp) { setLinhas([]); setLoading(false); return }

    const { data } = await supabase.from('rateio_mensal')
      .select('*, obras(nome,codigo)')
      .eq('competencia_id', comp.id)
      .order('total_geral', { ascending: false })

    // Buscar mês anterior para comparativo
    const [anoStr, mesStr] = mes.split('-')
    const dtAnt = new Date(+anoStr, +mesStr - 2, 1)
    const mesAnt = `${dtAnt.getFullYear()}-${String(dtAnt.getMonth() + 1).padStart(2, '0')}`
    const { data: compAnt } = await supabase.from('competencias').select('id').eq('mes_ano', mesAnt).single()
    let rateioAnt: Record<string, number> = {}
    if (compAnt) {
      const { data: antData } = await supabase.from('rateio_mensal')
        .select('obra_id,total_geral').eq('competencia_id', compAnt.id)
      antData?.forEach((r: any) => { rateioAnt[r.obra_id] = r.total_geral })
    }

    setLinhas((data || []).map((r: any) => ({
      obra_id: r.obra_id,
      obra: r.obras?.nome || '',
      codigo: r.obras?.codigo || '',
      total_armacao: r.total_armacao,
      total_carpintaria: r.total_carpintaria,
      total_geral: r.total_geral,
      percentual: r.percentual,
      ant: rateioAnt[r.obra_id],
    })))
    setLoading(false)
  }

  async function calcular() {
    setCalculando(true); setMsg('')
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).single()
    if (!comp) { setMsg('⚠️ Competência não encontrada.'); setCalculando(false); return }
    const { error } = await supabase.rpc('calcular_rateio', { p_competencia_id: comp.id })
    if (error) { setMsg('Erro: ' + error.message); setCalculando(false); return }
    await carregar()
    setMsg('✅ Rateio calculado!')
    setTimeout(() => setMsg(''), 3000)
    setCalculando(false)
  }

  function exportarCSV() {
    const grand = linhas.reduce((s, l) => s + l.total_geral, 0)
    let csv = 'Obra,Código,Armação R$,Carpintaria R$,Total R$,% do Mês\n'
    csv += linhas.map(l =>
      `"${l.obra}","${l.codigo}",${l.total_armacao.toFixed(2)},${l.total_carpintaria.toFixed(2)},${l.total_geral.toFixed(2)},${(l.percentual * 100).toFixed(2)}%`
    ).join('\n')
    csv += `\nTOTAL,,${linhas.reduce((s,l)=>s+l.total_armacao,0).toFixed(2)},${linhas.reduce((s,l)=>s+l.total_carpintaria,0).toFixed(2)},${grand.toFixed(2)},100%`
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `rateio_${mes}.csv`; a.click()
  }

  const grand = linhas.reduce((s, l) => s + l.total_geral, 0)
  const totalArm = linhas.reduce((s, l) => s + l.total_armacao, 0)
  const totalCarp = linhas.reduce((s, l) => s + l.total_carpintaria, 0)

  function vsAnt(linha: LinhaRateio) {
    if (linha.ant === undefined) return <span className="text-gray-300">—</span>
    const diff = linha.total_geral - linha.ant
    if (Math.abs(diff) < 1) return <span className="text-gray-400">≈ igual</span>
    return diff > 0
      ? <span className="text-green-700 font-semibold">▲ {formatR$(diff)}</span>
      : <span className="text-red-600 font-semibold">▼ {formatR$(Math.abs(diff))}</span>
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1a3a5c]">Rateio por Obra</h1>
          <p className="text-gray-500 text-sm mt-0.5">Custo total distribuído por obra no mês</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input type="month" className="input text-sm py-1.5 w-36" value={mes} onChange={e => setMes(e.target.value)} />
          <button onClick={calcular} disabled={calculando} className="btn-green btn-sm">
            {calculando ? 'Calculando...' : '▶ Calcular Rateio'}
          </button>
          {linhas.length > 0 && (
            <>
              <button onClick={exportarCSV} className="btn-ghost btn-sm">⬇ CSV</button>
              <button onClick={() => window.print()} className="btn-ghost btn-sm">🖨 PDF</button>
            </>
          )}
        </div>
      </div>

      {msg && <div className={msg.includes('⚠') || msg.includes('Erro') ? 'alert-warn mb-4' : 'alert-ok mb-4'}>{msg}</div>}

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="stat">
          <div className="stat-label">Total Armação</div>
          <div className="stat-val text-blue-700">{formatR$(totalArm)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Carpintaria</div>
          <div className="stat-val text-purple-700">{formatR$(totalCarp)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Geral</div>
          <div className="stat-val text-green-700">{formatR$(grand)}</div>
        </div>
      </div>

      {loading ? (
        <div className="card-pad text-center py-12 text-gray-400">Carregando...</div>
      ) : linhas.length === 0 ? (
        <div className="card-pad text-center py-12">
          <p className="text-gray-400 mb-3">Rateio não calculado para {nomeMes(mes)}.</p>
          <p className="text-gray-400 text-sm mb-4">Lance as presenças primeiro, depois clique em Calcular Rateio.</p>
          <button onClick={calcular} className="btn-primary">▶ Calcular Agora</button>
        </div>
      ) : (
        <div className="card overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th" style={{ width: 70 }}>Código</th>
                <th className="th-left">Obra</th>
                <th className="th">Armação R$</th>
                <th className="th">Carpintaria R$</th>
                <th className="th">Total R$</th>
                <th className="th">% do Mês</th>
                <th className="th">Vs Mês Ant.</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.obra_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                  <td className="td text-center font-mono font-bold text-[#1a3a5c]">{l.codigo}</td>
                  <td className="td font-medium">{l.obra}</td>
                  <td className="td-num text-blue-700">{formatR$(l.total_armacao)}</td>
                  <td className="td-num text-purple-700">{formatR$(l.total_carpintaria)}</td>
                  <td className="td-num font-bold">{formatR$(l.total_geral)}</td>
                  <td className="td-center">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5" style={{ minWidth: 60 }}>
                        <div className="bg-[#1a3a5c] h-1.5 rounded-full"
                          style={{ width: `${(l.percentual * 100).toFixed(1)}%` }}></div>
                      </div>
                      <span className="text-xs font-semibold text-gray-600 w-10 text-right">
                        {(l.percentual * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="td-center text-xs">{vsAnt(l)}</td>
                </tr>
              ))}
              <tr className="bg-green-50 font-bold">
                <td className="td" colSpan={2}>TOTAL GERAL</td>
                <td className="td-num text-blue-900">{formatR$(totalArm)}</td>
                <td className="td-num text-purple-900">{formatR$(totalCarp)}</td>
                <td className="td-num text-green-900 text-base">{formatR$(grand)}</td>
                <td className="td-center font-bold">100%</td>
                <td className="td"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
