'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { nomeMes, formatR$ } from '@/lib/utils'

export default function HistoricoPage() {
  const [competencias, setCompetencias] = useState<any[]>([])
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [rateio, setRateio] = useState<any[]>([])
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [aba, setAba] = useState<'rateio' | 'pagamentos'>('rateio')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('competencias').select('*').order('mes_ano', { ascending: false })
    setCompetencias(data || [])
    setLoading(false)
  }

  async function verDetalhe(comp: any) {
    setSelecionado(comp.id)
    setLoadingDetalhe(true)
    const [{ data: rat }, { data: pag }] = await Promise.all([
      supabase.from('rateio_mensal').select('*, obras(nome,codigo)').eq('competencia_id', comp.id).order('total_geral', { ascending: false }),
      supabase.from('pagamentos').select('*, funcionarios(nome,equipe,valor_diaria)').eq('competencia_id', comp.id).eq('tipo', 'pagamento_final'),
    ])
    setRateio(rat || [])
    setPagamentos(pag || [])
    setLoadingDetalhe(false)
  }

  const compSelecionada = competencias.find(c => c.id === selecionado)
  const grandRateio = rateio.reduce((s, r) => s + r.total_geral, 0)
  const grandPag = pagamentos.reduce((s, p) => s + p.total_contra_cheque, 0)

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#1a3a5c]">Histórico de Meses</h1>
        <p className="text-gray-500 text-sm mt-0.5">Consulte qualquer mês já processado</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de competências */}
        <div className="card overflow-auto" style={{ maxHeight: 600 }}>
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-[#1a3a5c] text-sm">Meses disponíveis</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {competencias.map(c => (
                <button key={c.id} onClick={() => verDetalhe(c)}
                  className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selecionado === c.id ? 'bg-blue-50 border-r-2 border-[#1a3a5c]' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-[#1a3a5c]">
                        {nomeMes(c.mes_ano)} / {c.mes_ano.split('-')[0]}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{c.mes_ano}</div>
                    </div>
                    <span className={c.status === 'FECHADA' ? 'badge-err' : 'badge-ok'}>
                      {c.status === 'FECHADA' ? '🔒' : '🔓'} {c.status}
                    </span>
                  </div>
                </button>
              ))}
              {competencias.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">Nenhuma competência ainda</div>
              )}
            </div>
          )}
        </div>

        {/* Detalhe */}
        <div className="lg:col-span-2">
          {!selecionado ? (
            <div className="card-pad text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📅</div>
              <p>Selecione um mês ao lado para ver o histórico</p>
            </div>
          ) : (
            <div>
              {/* Header do mês selecionado */}
              <div className="card-pad mb-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-[#1a3a5c] text-lg">
                    {compSelecionada && nomeMes(compSelecionada.mes_ano)} / {compSelecionada?.mes_ano.split('-')[0]}
                  </h2>
                  <div className="flex gap-4 text-sm text-gray-500 mt-1">
                    <span>Rateio total: <strong className="text-[#1a3a5c]">{formatR$(grandRateio)}</strong></span>
                    <span>Pagamentos: <strong className="text-green-700">{formatR$(grandPag)}</strong></span>
                  </div>
                </div>
                <button onClick={() => window.print()} className="btn-ghost btn-sm">🖨 Imprimir</button>
              </div>

              {/* Abas */}
              <div className="flex gap-1 mb-3 border-b border-gray-200">
                {(['rateio', 'pagamentos'] as const).map(a => (
                  <button key={a} onClick={() => setAba(a)}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${aba === a ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                    {a === 'rateio' ? '📊 Rateio por Obra' : '💳 Pagamentos'}
                  </button>
                ))}
              </div>

              {loadingDetalhe ? (
                <div className="card-pad text-center py-8 text-gray-400">Carregando...</div>
              ) : (
                <div className="card overflow-auto">
                  {aba === 'rateio' && (
                    <table className="w-full border-collapse">
                      <thead><tr>
                        <th className="th">Cód.</th>
                        <th className="th-left">Obra</th>
                        <th className="th">Armação</th>
                        <th className="th">Carpintaria</th>
                        <th className="th">Total</th>
                        <th className="th">%</th>
                      </tr></thead>
                      <tbody>
                        {rateio.map((r, i) => (
                          <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                            <td className="td-center font-mono font-bold text-[#1a3a5c]">{(r.obras as any)?.codigo}</td>
                            <td className="td font-medium">{(r.obras as any)?.nome}</td>
                            <td className="td-num text-blue-700">{formatR$(r.total_armacao)}</td>
                            <td className="td-num text-purple-700">{formatR$(r.total_carpintaria)}</td>
                            <td className="td-num font-bold">{formatR$(r.total_geral)}</td>
                            <td className="td-center">{(r.percentual * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                        <tr className="bg-green-50 font-bold">
                          <td className="td" colSpan={2}>TOTAL</td>
                          <td className="td-num text-blue-900">{formatR$(rateio.reduce((s,r)=>s+r.total_armacao,0))}</td>
                          <td className="td-num text-purple-900">{formatR$(rateio.reduce((s,r)=>s+r.total_carpintaria,0))}</td>
                          <td className="td-num text-green-900">{formatR$(grandRateio)}</td>
                          <td className="td-center">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                  {aba === 'pagamentos' && (
                    <table className="w-full border-collapse">
                      <thead><tr>
                        <th className="th-left">Funcionário</th>
                        <th className="th">Equipe</th>
                        <th className="th">Diárias</th>
                        <th className="th">Passagem</th>
                        <th className="th">Avulsos</th>
                        <th className="th">Total</th>
                        <th className="th">Contra Cheque</th>
                        <th className="th">Status</th>
                      </tr></thead>
                      <tbody>
                        {pagamentos.map((p, i) => (
                          <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                            <td className="td font-medium text-[#1a3a5c]">{(p.funcionarios as any)?.nome}</td>
                            <td className="td-center text-xs">{(p.funcionarios as any)?.equipe}</td>
                            <td className="td-center">{p.total_diarias}</td>
                            <td className="td-num">{formatR$(p.total_passagem)}</td>
                            <td className="td-num text-orange-600">-{formatR$(p.total_avulsos)}</td>
                            <td className="td-num font-bold text-green-800">{formatR$(p.total_pagamento)}</td>
                            <td className="td-num font-bold text-green-900">{formatR$(p.total_contra_cheque)}</td>
                            <td className="td-center">
                              <span className={p.status === 'CALCULADO' ? 'badge-ok' : p.status === 'APROVADO' ? 'badge-blue' : 'badge-warn'}>{p.status}</span>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-green-50 font-bold">
                          <td className="td" colSpan={5}>TOTAL</td>
                          <td className="td-num text-green-900">{formatR$(pagamentos.reduce((s,p)=>s+p.total_pagamento,0))}</td>
                          <td className="td-num text-green-900">{formatR$(grandPag)}</td>
                          <td className="td"></td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
