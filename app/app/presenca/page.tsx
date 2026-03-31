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
      supabase.from('presencas')
        .select(`*, obras:obra_id(nome,codigo), obras2:obra2_id(nome,codigo)`)
        .eq('competencia_id', comp?.id || ''),
    ])

    setFuncionarios(funcs || [])
    setObras(obrasData || [])

    const mapa: Record<string, Presenca> = {}
    presData?.forEach(p => { mapa[`${p.funcionario_id}|${p.data}`] = p })
    setPresencas(mapa)

    setLoading(false)
  }

  function abrirModal(funcId: string, funcNome: string, data: string) {
    if (fechada) return
    const atual = presencas[`${funcId}|${data}`]

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

    const f1n = parseFloat(formFracao) || 0
    const f2n = parseFloat(formFracao2) || 0

    if ((formTipo === 'NORMAL' || formTipo === 'SABADO_EXTRA') && !formObra) {
      setFormErro('Selecione a obra.')
      return
    }

    setSalvando(true)

    const payload: any = {
      competencia_id: competencia.id,
      funcionario_id: modal.funcId,
      data: modal.data,
      tipo: formTipo,
      obra_id: formObra || null,
      fracao: f1n || null,
      obra2_id: formObra2 || null,
      fracao2: f2n || null,
    }

    const { error } = modal.presencaAtual
      ? await supabase.from('presencas').update(payload).eq('id', modal.presencaAtual.id)
      : await supabase.from('presencas').insert(payload)

    if (error) {
      setFormErro(error.message)
      setSalvando(false)
      return
    }

    await carregarDados()
    setSalvando(false)
    setModal(null)
  }

  function celInfo(funcId: string, data: string) {
    return presencas[`${funcId}|${data}`]
  }

  const funcsFiltradas = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>

      {/* 🔥 BOTÕES SEM BUG */}
      <div className="mb-3 flex gap-2 flex-wrap">
        {(['ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
          <button
            key={eq}
            onClick={() => setEquipe(eq)}
            className={equipe === eq ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
          >
            {eq}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between mb-4">
        <h1 className="text-xl font-bold">Presença</h1>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} />
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <div>
          {funcsFiltradas.map(f => (
            <div key={f.id} className="p-2 border-b">
              {f.nome}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}