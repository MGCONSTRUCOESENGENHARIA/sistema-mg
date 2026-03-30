'use client'
import { useEffect, useState } from 'react'
import { supabase, Competencia } from '@/lib/supabase'
import { mesAtual, nomeMes } from '@/lib/utils'

export default function CompetenciasPage() {
  const [competencias, setCompetencias] = useState<Competencia[]>([])
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)
  const [novoMes, setNovoMes] = useState(mesAtual())
  const [msg, setMsg] = useState('')
  const [perfilAtual, setPerfilAtual] = useState<any>(null)

  useEffect(() => {
    carregar()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.from('perfis').select('*').eq('id', user.id).single()
        .then(({ data }) => setPerfilAtual(data))
    })
  }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('competencias').select('*').order('mes_ano', { ascending: false })
    setCompetencias(data || [])
    setLoading(false)
  }

  async function criarCompetencia() {
    setCriando(true)
    const { error } = await supabase.from('competencias').insert({ mes_ano: novoMes, status: 'ABERTA' })
    if (error) { setMsg('Erro: ' + (error.message.includes('unique') ? 'Este mês já existe.' : error.message)) }
    else { setMsg('✅ Competência criada!') }
    setTimeout(() => setMsg(''), 3000)
    await carregar()
    setCriando(false)
  }

  async function fecharMes(comp: Competencia) {
    if (!confirm(`Fechar ${nomeMes(comp.mes_ano)}/${comp.mes_ano.split('-')[0]}?\n\nApós fechar, as edições serão bloqueadas. Somente o gestor pode reabrir.`)) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('competencias').update({
      status: 'FECHADA', fechado_por: user?.id, fechado_em: new Date().toISOString()
    }).eq('id', comp.id)
    setMsg('🔒 Mês fechado.')
    setTimeout(() => setMsg(''), 3000)
    await carregar()
  }

  async function reabrirMes(comp: Competencia) {
    if (perfilAtual?.perfil !== 'gestor') { setMsg('⚠️ Somente o gestor pode reabrir um mês fechado.'); return }
    if (!confirm(`Reabrir ${nomeMes(comp.mes_ano)}? Isso permite edições novamente.`)) return
    await supabase.from('competencias').update({ status: 'ABERTA', fechado_por: null, fechado_em: null }).eq('id', comp.id)
    setMsg('🔓 Mês reaberto.')
    setTimeout(() => setMsg(''), 2000)
    await carregar()
  }

  // Meses disponíveis para criar (que ainda não existem)
  const mesesExistentes = new Set(competencias.map(c => c.mes_ano))
  const opcoesMes = [-3,-2,-1,0,1,2].map(i => {
    const d = new Date(); d.setMonth(d.getMonth() + i)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  }).filter(m => !mesesExistentes.has(m))

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#1a3a5c]">Competências</h1>
        <p className="text-gray-500 text-sm mt-0.5">Controle de meses abertos e fechados</p>
      </div>

      {msg && <div className={msg.includes('⚠') ? 'alert-warn mb-4' : msg.includes('Erro') ? 'alert-err mb-4' : 'alert-ok mb-4'}>{msg}</div>}

      {/* Criar novo mês */}
      <div className="card-pad mb-4 flex gap-3 items-end flex-wrap">
        <div>
          <label className="label">Abrir novo mês</label>
          <select className="select w-48" value={novoMes} onChange={e => setNovoMes(e.target.value)}>
            {opcoesMes.map(m => (
              <option key={m} value={m}>{nomeMes(m)} / {m.split('-')[0]}</option>
            ))}
            {opcoesMes.length === 0 && <option>Todos os meses já existem</option>}
          </select>
        </div>
        <button onClick={criarCompetencia} disabled={criando || opcoesMes.length === 0} className="btn-primary">
          {criando ? 'Criando...' : '+ Abrir Mês'}
        </button>
      </div>

      {/* Lista de competências */}
      {loading ? (
        <div className="card-pad text-center py-12 text-gray-400">Carregando...</div>
      ) : (
        <div className="card overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th-left">Mês/Ano</th>
                <th className="th">Status</th>
                <th className="th">Fechado em</th>
                <th className="th">Ações</th>
              </tr>
            </thead>
            <tbody>
              {competencias.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                  <td className="td font-semibold text-[#1a3a5c]">
                    {nomeMes(c.mes_ano)} / {c.mes_ano.split('-')[0]}
                    {c.mes_ano === mesAtual() && <span className="badge-blue ml-2">Atual</span>}
                  </td>
                  <td className="td-center">
                    <span className={c.status === 'ABERTA' ? 'badge-ok' : 'badge-err'}>
                      {c.status === 'ABERTA' ? '🔓 Aberta' : '🔒 Fechada'}
                    </span>
                  </td>
                  <td className="td-center text-gray-400 text-xs">
                    {c.fechado_em ? new Date(c.fechado_em).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="td-center">
                    {c.status === 'ABERTA' ? (
                      <button onClick={() => fecharMes(c)} className="btn btn-sm bg-amber-600 text-white hover:bg-amber-700">
                        🔒 Fechar Mês
                      </button>
                    ) : (
                      perfilAtual?.perfil === 'gestor' ? (
                        <button onClick={() => reabrirMes(c)} className="btn-ghost btn-sm">
                          🔓 Reabrir
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Somente gestor reabre</span>
                      )
                    )}
                  </td>
                </tr>
              ))}
              {competencias.length === 0 && (
                <tr><td colSpan={4} className="td text-center text-gray-400 py-8">Nenhuma competência. Crie o primeiro mês acima.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
