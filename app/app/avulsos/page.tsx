'use client'
import { useEffect, useState } from 'react'
import { supabase, Avulso, AvulsoTipo, Funcionario } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$ } from '@/lib/utils'

export default function AvulsosPage() {
  const [avulsos, setAvulsos] = useState<(Avulso & { funcionarios: any })[]>([])
  const [funcs, setFuncs] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(mesAtual())
  const [equipe, setEquipe] = useState<'' | 'ARMAÇÃO' | 'CARPINTARIA'>('')
  const [form, setForm] = useState<{
    funcionario_id: string; data: string; tipo: AvulsoTipo; valor: string; observacao: string
  }>({ funcionario_id: '', data: new Date().toISOString().slice(0, 10), tipo: 'Vale', valor: '', observacao: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { carregar() }, [mes])

  async function carregar() {
    setLoading(true)
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).single()

    const [{ data: avs }, { data: fs }] = await Promise.all([
      comp
        ? supabase.from('avulsos')
            .select('*, funcionarios(nome,equipe)')
            .eq('competencia_id', comp.id)
            .order('data', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from('funcionarios')
        .select('id,nome,equipe,funcao,valor_diaria,salario_base,ativo')
        .eq('ativo', true)
        .order('equipe')
        .order('nome'),
    ])

    setAvulsos(avs || [])

    // ✅ CORREÇÃO AQUI
    setFuncs((fs || []).map((f: any) => ({
      id: f.id,
      nome: f.nome,
      equipe: f.equipe,
      funcao: f.funcao || '',
      valor_diaria: f.valor_diaria || 0,
      salario_base: f.salario_base || 0,
      ativo: f.ativo ?? true,
    })))

    setLoading(false)
  }

  async function salvar() {
    if (!form.funcionario_id) { setMsg({ tipo: 'err', texto: 'Selecione o funcionário.' }); return }
    if (!form.valor || +form.valor <= 0) { setMsg({ tipo: 'err', texto: 'Informe o valor.' }); return }

    setSalvando(true); setMsg(null)

    let { data: comp } = await supabase.from('competencias').select('id,status').eq('mes_ano', mes).single()

    if (!comp) {
      const { data: nova } = await supabase.from('competencias')
        .insert({ mes_ano: mes, status: 'ABERTA' })
        .select()
        .single()
      comp = nova
    }

    if (comp?.status === 'FECHADA') {
      setMsg({ tipo: 'err', texto: 'Competência fechada. Não é possível registrar avulsos.' })
      setSalvando(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('avulsos').insert({
      competencia_id: comp!.id,
      funcionario_id: form.funcionario_id,
      data: form.data,
      tipo: form.tipo,
      valor: +form.valor,
      observacao: form.observacao || null,
      registrado_por: user?.id,
    })

    if (error) {
      setMsg({ tipo: 'err', texto: error.message })
      setSalvando(false)
      return
    }

    setMsg({ tipo: 'ok', texto: '✅ Avulso registrado!' })
    setTimeout(() => setMsg(null), 2500)

    setForm({
      funcionario_id: '',
      data: new Date().toISOString().slice(0, 10),
      tipo: 'Vale',
      valor: '',
      observacao: ''
    })

    setShowForm(false)
    await carregar()
    setSalvando(false)
  }

  async function remover(id: string) {
    if (!confirm('Remover este lançamento?')) return
    await supabase.from('avulsos').delete().eq('id', id)
    await carregar()
  }

  const filtrados = avulsos.filter(a => !equipe || a.funcionarios?.equipe === equipe)
  const totalGeral = filtrados.reduce((s, a) => s + a.valor, 0)
  const funcsFiltradas = equipe ? funcs.filter(f => f.equipe === equipe) : funcs

  const tipoCor: Record<AvulsoTipo, string> = {
    Vale: 'badge-warn',
    Empréstimo: 'badge-err',
    Desconto: 'badge-err',
    Adiantamento: 'badge-blue',
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-[#1a3a5c] mb-4">
        Avulsos — Vales & Empréstimos
      </h1>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Carregando...</div>
      ) : (
        <div>
          {filtrados.map(a => (
            <div key={a.id} className="border-b py-2 flex justify-between">
              <span>{a.funcionarios?.nome}</span>
              <span className="text-orange-700">-{formatR$(a.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}