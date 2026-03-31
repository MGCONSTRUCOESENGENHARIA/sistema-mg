'use client'

import { useEffect, useState } from 'react'
import { supabase, Funcionario, Obra, Presenca, PresencaTipo, Competencia } from '@/lib/supabase'
import { diasDoMes, formatDate, formatBR, isSabado, fim1Quinzena, mesAtual, PRESENCA_LABEL, AUSENCIAS } from '@/lib/utils'

interface CelulaModal {
  funcId: string
  funcNome: string
  data: string
  presencaAtual?: Presenca
}

export default function PresencaPage() {
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [mes, setMes] = useState(mesAtual())
  const [competencia, setCompetencia] = useState<Competencia | null>(null)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [presencas, setPresencas] = useState<Record<string, Presenca>>({})
  const [modal, setModal] = useState<CelulaModal | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroObra, setFiltroObra] = useState('')

  // Modal form
  const [formTipo, setFormTipo] = useState<PresencaTipo>('NORMAL')
  const [formObra, setFormObra] = useState('')
  const [formFracao, setFormFracao] = useState('1')
  const [formObra2, setFormObra2] = useState('')
  const [formFracao2, setFormFracao2] = useState('')
  const [formErro, setFormErro] = useState('')

  const dias = diasDoMes(mes)
  const f1 = fim1Quinzena(dias)
  const fechada = competencia?.status === 'FECHADA'

  useEffect(() => { carregarDados() }, [equipe, mes])

  async function carregarDados() {
    setLoading(true)

    // Garantir competência
    const { data: compExist } = await supabase.from('competencias').select('*').eq('mes_ano', mes).single()
    let comp = compExist
    if (!comp) {
      const { data: novaComp } = await supabase.from('competencias').insert({ mes_ano: mes, status: 'ABERTA' }).select().single()
      comp = novaComp
    }
    setCompetencia(comp)

    const [{ data: funcs }, { data: obrasData }, { data: presData }] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('equipe', equipe).eq('ativo', true).order('nome'),
      supabase.from('obras').select('*').eq('status', 'ATIVA').order('nome'),
      supabase.from('presencas').select(`*, obras:obra_id(nome,codigo), obras2:obra2_id(nome,codigo)`).eq('competencia_id', comp?.id || ''),
    ])

    setFuncionarios(funcs || [])
    setObras(obrasData || [])

    const mapaP: Record<string, Presenca> = {}
    presData?.forEach(p => { mapaP[`${p.funcionario_id}|${p.data}`] = p })
    setPresencas(mapaP)
    setLoading(false)
  }

  function abrirModal(funcId: string, funcNome: string, data: string) {
    if (fechada) return
    const key = `${funcId}|${data}`
    const atual = presencas[key]
    setModal({ funcId, funcNome, data, presencaAtual: atual })

    if (atual) {
      setFormTipo(atual.tipo)
      setFormObra(atual.obra_id || '')
      setFormFracao(String(atual.fracao || 1))
      setFormObra2(atual.obra2_id || '')
      setFormFracao2(String(atual.fracao2 || ''))
    } else {
      const d = new Date(data + 'T12:00:00')
      setFormTipo(isSabado(d) ? 'SABADO_EXTRA' : 'NORMAL')
      setFormObra('')
      setFormFracao('1')
      setFormObra2('')
      setFormFracao2('')
    }
    setFormErro('')
  }

  async function salvarPresenca() {
    if (!modal || !competencia) return
    setFormErro('')

    const f1n = parseFloat(formFracao) || 0
    const f2n = parseFloat(formFracao2) || 0

    if (formTipo === 'NORMAL' || formTipo === 'SABADO_EXTRA') {
      if (!formObra) { setFormErro('Selecione a obra.'); return }
      if (f1n <= 0 || f1n > 1) { setFormErro('Fração inválida.'); return }
      if (formObra2 && (f2n <= 0 || f1n + f2n > 1)) { setFormErro('Soma das frações não pode ultrapassar 1.'); return }
      if (formObra2 && !f2n) { setFormErro('Informe a fração da obra 2.'); return }
    }

    setSalvando(true)
    const payload: any = {
      competencia_id: competencia.id,
      funcionario_id: modal.funcId,
      data: modal.data,
      tipo: formTipo,
      obra_id: (formTipo === 'NORMAL' || formTipo === 'SABADO_EXTRA') ? formObra || null : null,
      fracao: (formTipo === 'NORMAL' || formTipo === 'SABADO_EXTRA') ? f1n : null,
      obra2_id: formObra2 || null,
      fracao2: formObra2 && f2n ? f2n : null,
    }

    const { error } = modal.presencaAtual
      ? await supabase.from('presencas').update(payload).eq('id', modal.presencaAtual.id)
      : await supabase.from('presencas').insert(payload)

    if (error) { setFormErro(error.message); setSalvando(false); return }
    await carregarDados()
    setSalvando(false)
    setModal(null)
  }

  async function limparPresenca() {
    if (!modal?.presencaAtual) return
    setSalvando(true)
    await supabase.from('presencas').delete().eq('id', modal.presencaAtual.id)
    await carregarDados()
    setSalvando(false)
    setModal(null)
  }

  function celInfo(funcId: string, data: string) {
    return presencas[`${funcId}|${data}`]
  }

  function celLabel(p: Presenca | undefined): string {
    if (!p) return ''
    if (AUSENCIAS.includes(p.tipo)) return p.tipo.substring(0, 3)
    if (p.tipo === 'SAIU') return 'SAIU'
    const o1 = (p.obras as any)?.codigo || ''
    const o2 = (p.obras2 as any)?.codigo || ''
    const f1 = p.fracao === 1 ? '' : `/${p.fracao}`
    const f2 = p.fracao2 ? `+${o2}/${p.fracao2}` : ''
    return `${o1}${f1}${f2}`
  }

  function celCor(p: Presenca | undefined, isSab: boolean): string {
    if (!p) return isSab ? 'bg-orange-50' : 'bg-white hover:bg-blue-50'
    if (p.tipo === 'FALTA') return 'bg-red-100'
    if (p.tipo === 'ATESTADO') return 'bg-yellow-100'
    if (p.tipo === 'AUSENTE' || p.tipo === 'SAIU') return 'bg-gray-100'
    if (p.tipo === 'SABADO_EXTRA') return 'bg-orange-200'
    return 'bg-green-50'
  }

  function calcTotais(funcId: string) {
    let q1 = 0, q2 = 0, q1ex = 0, q2ex = 0, faltas = 0, aus = 0
    dias.forEach((d, di) => {
      const p = celInfo(funcId, formatDate(d))
      if (!p) return
      if (p.tipo === 'FALTA') { faltas++; return }
      if (p.tipo === 'AUSENTE') { aus++; return }
      if (AUSENCIAS.includes(p.tipo)) return
      const soma = (p.fracao || 0) + (p.fracao2 || 0)
      if (p.tipo === 'SABADO_EXTRA') { di <= f1 ? q1ex += soma : q2ex += soma; return }
      if (p.tipo === 'NORMAL') { di <= f1 ? q1 += soma : q2 += soma }
    })
    return { q1, q2, q1ex, q2ex, faltas, aus, tot: q1 + q2 }
  }

  const funcsFiltradas = funcionarios.filter(f => {
    if (busca && !f.nome.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroObra) {
      return dias.some(d => {
        const p = celInfo(f.id, formatDate(d))
        return p && (p.obra_id === filtroObra || p.obra2_id === filtroObra)
      })
    }
    return true
  })

  const nomeDia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div>
      {/* Botões Equipe visíveis no topo */}
      <div className="mb-2 flex gap-2 flex-wrap">
        {(['ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
          <button key={eq} onClick={() => setEquipe(eq)}
            className={equipe === eq ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>
            {eq}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1a3a5c]">Grade de Presença</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {funcsFiltradas.length} funcionários · {dias.length} dias úteis
            {fechada && <span className="badge-err ml-2">Competência Fechada</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input type="month" className="input text-sm py-1.5 w-36"
            value={mes} onChange={e => setMes(e.target.value)} />
        </div>
      </div>

      {/* Filtros e legenda */}
      <div className="card-pad mb-4 flex gap-3 flex-wrap items-center">
        <input type="text" placeholder="🔍 Buscar funcionário..." value={busca}
          onChange={e => setBusca(e.target.value)} className="input w-56" />
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} className="select w-48">
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        {busca || filtroObra ? (
          <button onClick={() => { setBusca(''); setFiltroObra('') }}
            className="btn-ghost btn-sm">Limpar filtros</button>
        ) : null}
        <div className="ml-auto flex gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 inline-block"></span>Normal</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-300 inline-block"></span>Sáb extra</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 inline-block"></span>Falta</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-200 inline-block"></span>Atestado</span>
        </div>
      </div>

      {/* Grade */}
      {loading ? (
        <div className="card-pad text-center py-16 text-gray-400">Carregando...</div>
      ) : (
        <div className="card overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="border-collapse" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th className="th-left sticky left-0 z-20 bg-[#1a3a5c]" style={{ minWidth: 200 }}>Funcionário</th>
                {dias.map((d, di) => {
                  const sab = isSabado(d)
                  return (
                    <th key={di} className="th" style={{ minWidth: 68, background: sab ? '#c2410c' : '#1a3a5c' }}>
                      {formatBR(d)}<br />
                      <span className="font-normal opacity-70 text-[9px]">
                        {nomeDia[d.getDay()]}{di === f1 ? ' ◀' : ''}
                      </span>
                    </th>
                  )
                })}
                <th className="th" style={{ background: '#0c4a6e', minWidth: 44 }}>1ªQ</th>
                <th className="th" style={{ background: '#7c3aed', minWidth: 40 }}>Ex1</th>
                <th className="th" style={{ background: '#0c4a6e', minWidth: 44 }}>2ªQ</th>
                <th className="th" style={{ background: '#7c3aed', minWidth: 40 }}>Ex2</th>
                <th className="th" style={{ background: '#064e3b', minWidth: 48 }}>TOTAL</th>
                <th className="th" style={{ minWidth: 40 }}>Falt</th>
                <th className="th" style={{ minWidth: 40 }}>Aus</th>
              </tr>
            </thead>
            <tbody>
              {funcsFiltradas.map((func, fi) => {
                const t = calcTotais(func.id)
                return (
                  <tr key={func.id} className={fi % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="td-left sticky left-0 z-[1] font-semibold text-[#1a3a5c] bg-inherit border-r-2 border-gray-200"
                      style={{ minWidth: 200 }}>
                      {func.nome}
                    </td>
                    {dias.map((d, di) => {
                      const sab = isSabado(d)
                      const p = celInfo(func.id, formatDate(d))
                      const label = celLabel(p)
                      const cor = celCor(p, sab)
                      return (
                        <td key={di}
                          onClick={() => !fechada && abrirModal(func.id, func.nome, formatDate(d))}
                          className={`td text-center text-[10px] font-medium cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-inset transition-all select-none ${cor}`}
                          style={{ minWidth: 68, maxWidth: 80, padding: '3px 4px' }}
                          title={p ? PRESENCA_LABEL[p.tipo] + (label ? ` — ${label}` : '') : 'Clique para lançar'}>
                          <span className="truncate block">{label || (sab ? '·' : '')}</span>
                        </td>
                      )
                    })}
                    <td className="td text-center font-bold text-blue-800 bg-blue-50">{t.q1}</td>
                    <td className="td text-center text-purple-700 bg-purple-50">{t.q1ex}</td>
                    <td className="td text-center font-bold text-blue-800 bg-blue-50">{t.q2}</td>
                    <td className="td text-center text-purple-700 bg-purple-50">{t.q2ex}</td>
                    <td className="td text-center font-bold text-green-800 bg-green-50">{t.tot}</td>
                    <td className="td text-center text-red-600">{t.faltas}</td>
                    <td className="td text-center text-gray-500">{t.aus}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#1a3a5c] text-sm">{modal.funcNome}</div>
                <div className="text-gray-400 text-xs">{new Date(modal.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p