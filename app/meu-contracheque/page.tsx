'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$, diasDoMes, formatDate, formatBR, AUSENCIAS } from '@/lib/utils'

export default function MeuContracheque() {
  const [func, setFunc] = useState<any>(null)
  const [pagamento, setPagamento] = useState<any>(null)
  const [presencas, setPresencas] = useState<any[]>([])
  const [avulsos, setAvulsos] = useState<any[]>([])
  const [mes, setMes] = useState(mesAtual())
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [mes])

  async function carregar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const { data: funcData } = await supabase.from('funcionarios').select('*').eq('usuario_id', user.id).single()
    setFunc(funcData)
    if (!funcData) { setLoading(false); return }

    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).single()
    if (!comp) { setPagamento(null); setPresencas([]); setAvulsos([]); setLoading(false); return }

    const [{ data: pag }, { data: pres }, { data: av }] = await Promise.all([
      supabase.from('pagamentos').select('*').eq('competencia_id', comp.id).eq('funcionario_id', funcData.id).eq('tipo', 'pagamento_final').single(),
      supabase.from('presencas').select('*, obras(nome,codigo), obras2:obra2_id(nome,codigo)').eq('competencia_id', comp.id).eq('funcionario_id', funcData.id).order('data'),
      supabase.from('avulsos').select('*').eq('competencia_id', comp.id).eq('funcionario_id', funcData.id).order('data'),
    ])
    setPagamento(pag)
    setPresencas(pres || [])
    setAvulsos(av || [])
    setLoading(false)
  }

  async function sair() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const nomeDia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const diasMes = diasDoMes(mes)

  let totalDias = 0, totalExtras = 0, faltas = 0
  presencas.forEach(p => {
    if (p.tipo === 'FALTA') { faltas++; return }
    if (AUSENCIAS.includes(p.tipo)) return
    const soma = (p.fracao || 0) + (p.fracao2 || 0)
    if (p.tipo === 'SABADO_EXTRA') totalExtras += soma
    else totalDias += soma
  })
  const totalAvulsos = avulsos.reduce((s, a) => s + a.valor, 0)

  if (loading) return (
    <div className="min-h-screen bg-[#1a3a5c] flex items-center justify-center">
      <div className="text-white/60">Carregando...</div>
    </div>
  )

  if (!func) return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="card-pad text-center max-w-sm">
        <div className="text-4xl mb-3">⚒</div>
        <h2 className="font-bold text-[#1a3a5c] mb-2">Conta não vinculada</h2>
        <p className="text-gray-500 text-sm mb-4">Seu usuário não está vinculado a um funcionário. Fale com o escritório.</p>
        <button onClick={sair} className="btn-ghost btn-sm">Sair</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* Header */}
      <div className="bg-[#1a3a5c] px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <div className="text-white font-bold">⚒ Meu Contracheque</div>
            <div className="text-white/60 text-sm">{func.nome}</div>
          </div>
          <button onClick={sair} className="text-white/50 hover:text-white text-sm transition-colors">Sair</button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Seletor de mês */}
        <div className="card-pad flex items-center justify-between gap-3">
          <span className="font-semibold text-[#1a3a5c] text-sm">Período</span>
          <input type="month" className="input w-36 text-sm py-1.5" value={mes} onChange={e => setMes(e.target.value)} />
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3">
          <div className="stat">
            <div className="stat-label">Diárias</div>
            <div className="stat-val">{totalDias.toFixed(1)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Extras Sáb</div>
            <div className="stat-val text-purple-700">{totalExtras.toFixed(1)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Faltas</div>
            <div className="stat-val text-red-600">{faltas}</div>
          </div>
        </div>

        {/* Contra-cheque */}
        {pagamento ? (
          <div className="card-pad">
            <h2 className="font-bold text-[#1a3a5c] mb-4">
              Contra-cheque — {nomeMes(mes)} {mes.split('-')[0]}
            </h2>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Diárias trabalhadas', val: `${pagamento.total_diarias} dias × ${formatR$(func.valor_diaria)}`, destaque: false },
                { label: 'Valor das diárias', val: formatR$(pagamento.valor_diarias), destaque: false },
                pagamento.total_extras > 0 && { label: 'Extras sábado', val: `+ ${formatR$(pagamento.total_extras * func.valor_diaria)}`, destaque: false },
                pagamento.total_passagem > 0 && { label: 'Passagem/transporte', val: `+ ${formatR$(pagamento.total_passagem)}`, destaque: false },
                pagamento.total_cafe > 0 && { label: 'Café da manhã', val: `+ ${formatR$(pagamento.total_cafe)}`, destaque: false },
                pagamento.hora_extra > 0 && { label: 'Hora extra', val: `+ ${formatR$(pagamento.hora_extra)}`, destaque: false },
                pagamento.total_avulsos > 0 && { label: 'Descontos avulsos', val: `- ${formatR$(pagamento.total_avulsos)}`, destaque: false },
                pagamento.desc_materiais && { label: 'Desc. materiais', val: `- ${formatR$(Math.abs(pagamento.desc_materiais))}`, destaque: false },
                pagamento.desc_inss && { label: 'Desc. INSS', val: `- ${formatR$(Math.abs(pagamento.desc_inss))}`, destaque: false },
                pagamento.desc_pensao && { label: 'Desc. pensão', val: `- ${formatR$(Math.abs(pagamento.desc_pensao))}`, destaque: false },
              ].filter(Boolean).map((item: any, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium">{item.val}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 mt-2 border-t-2 border-[#1a3a5c]">
                <span className="font-bold text-[#1a3a5c] text-base">TOTAL A RECEBER</span>
                <span className="font-bold text-green-700 text-xl">{formatR$(pagamento.total_contra_cheque)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card-pad text-center py-6 text-gray-400 text-sm">
            Pagamento de {nomeMes(mes)} ainda não foi calculado.
          </div>
        )}

        {/* Presença detalhada */}
        <div className="card-pad">
          <h2 className="font-bold text-[#1a3a5c] mb-3 text-sm">Presença — {nomeMes(mes)}</h2>
          {presencas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Nenhum lançamento ainda</p>
          ) : (
            <div className="space-y-1">
              {diasMes.filter(d => presencas.some(p => p.data === formatDate(d))).map(d => {
                const p = presencas.find(p => p.data === formatDate(d))
                if (!p) return null
                const isAbs = AUSENCIAS.includes(p.tipo)
                const isSab = d.getDay() === 6
                const o1 = (p.obras as any)?.nome || ''
                const o2 = (p.obras2 as any)?.nome || ''
                const fracLabel = p.fracao === 1 ? '1 diária' : p.fracao ? `${p.fracao} diária` : ''
                const obra2Label = o2 ? ` + ${o2} (${p.fracao2})` : ''
                return (
                  <div key={d.toISOString()}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${isAbs ? 'bg-red-50' : isSab ? 'bg-orange-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs w-20">{formatBR(d)} {nomeDia[d.getDay()]}</span>
                      <span className={`font-medium ${isAbs ? 'text-red-600' : 'text-gray-800'}`}>
                        {isAbs ? p.tipo : `${o1}${obra2Label}`}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{!isAbs && fracLabel}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Avulsos */}
        {avulsos.length > 0 && (
          <div className="card-pad">
            <h2 className="font-bold text-[#1a3a5c] mb-3 text-sm">Descontos do mês</h2>
            {avulsos.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
                <div>
                  <span className="font-medium text-gray-700">{a.tipo}</span>
                  {a.observacao && <span className="text-gray-400 ml-1 text-xs">— {a.observacao}</span>}
                  <div className="text-xs text-gray-400">{new Date(a.data + 'T12:00').toLocaleDateString('pt-BR')}</div>
                </div>
                <span className="font-bold text-orange-700">-{formatR$(a.valor)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-bold text-sm">
              <span>Total descontos</span>
              <span className="text-orange-700">-{formatR$(totalAvulsos)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
