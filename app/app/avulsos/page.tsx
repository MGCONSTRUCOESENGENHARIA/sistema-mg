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
        ? supabase.from('avulsos').select('*, funcionarios(nome,equipe)').eq('competencia_id', comp.id).order('data', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.from('funcionarios').select('id,nome,equipe').eq('ativo', true).order('equipe').order('nome'),
    ])
    setAvulsos(avs || [])
    setFuncs(fs || [])
    setLoading(false)
  }

  async function salvar() {
    if (!form.funcionario_id) { setMsg({ tipo: 'err', texto: 'Selecione o funcionário.' }); return }
    if (!form.valor || +form.valor <= 0) { setMsg({ tipo: 'err', texto: 'Informe o valor.' }); return }
    setSalvando(true); setMsg(null)
    // Garantir competência
    let { data: comp } = await supabase.from('competencias').select('id,status').eq('mes_ano', mes).single()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status: 'ABERTA' }).select().single()
      comp = nova
    }
    if (comp?.status === 'FECHADA') { setMsg({ tipo: 'err', texto: 'Competência fechada. Não é possível registrar avulsos.' }); setSalvando(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('avulsos').insert({
      competencia_id: comp!.id, funcionario_id: form.funcionario_id,
      data: form.data, tipo: form.tipo, valor: +form.valor,
      observacao: form.observacao || null, registrado_por: user?.id,
    })
    if (error) { setMsg({ tipo: 'err', texto: error.message }); setSalvando(false); return }
    setMsg({ tipo: 'ok', texto: '✅ Avulso registrado!' })
    setTimeout(() => setMsg(null), 2500)
    setForm({ funcionario_id: '', data: new Date().toISOString().slice(0, 10), tipo: 'Vale', valor: '', observacao: '' })
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
    Vale: 'badge-warn', Empréstimo: 'badge-err', Desconto: 'badge-err', Adiantamento: 'badge-blue',
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1a3a5c]">Avulsos — Vales & Empréstimos</h1>
          <p className="text-gray-500 text-sm mt-0.5">Lançados no mês, descontados no pagamento final</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input type="month" className="input text-sm py-1.5 w-36" value={mes} onChange={e => setMes(e.target.value)} />
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? '✕ Fechar' : '+ Novo Avulso'}
          </button>
        </div>
      </div>

      {msg && <div className={msg.tipo === 'ok' ? 'alert-ok mb-4' : 'alert-err mb-4'}>{msg.texto}</div>}

      {/* Formulário */}
      {showForm && (
        <div className="card-pad mb-4 border-2 border-blue-200">
          <h3 className="font-semibold text-[#1a3a5c] mb-4">Novo Lançamento</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="label">Funcionário *</label>
              <select className="select" value={form.funcionario_id}
                onChange={e => setForm(f => ({ ...f, funcionario_id: e.target.value }))}>
                <option value="">Selecione...</option>
                <optgroup label="ARMAÇÃO">
                  {funcsFiltradas.filter(f => f.equipe === 'ARMAÇÃO').map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </optgroup>
                <optgroup label="CARPINTARIA">
                  {funcsFiltradas.filter(f => f.equipe === 'CARPINTARIA').map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="label">Data *</label>
              <input type="date" className="input" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select className="select" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as AvulsoTipo }))}>
                <option value="Vale">Vale</option>
                <option value="Empréstimo">Empréstimo</option>
                <option value="Adiantamento">Adiantamento</option>
                <option value="Desconto">Desconto</option>
              </select>
            </div>
            <div>
              <label className="label">Valor (R$) *</label>
              <input type="number" step="0.01" className="input" placeholder="0,00" value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div className="col-span-2 lg:col-span-3">
              <label className="label">Observação</label>
              <input className="input" placeholder="Ex: Vale para remédio" value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={salvar} disabled={salvando} className="btn-primary">
              {salvando ? 'Salvando...' : '💾 Registrar'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card-pad mb-4 flex gap-2 items-center flex-wrap">
        {(['', 'ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
          <button key={eq} onClick={() => setEquipe(eq)}
            className={equipe === eq ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>
            {eq || 'Todos'}
          </button>
        ))}
        <span className="ml-auto text-sm font-semibold text-orange-700">
          Total descontos: {formatR$(totalGeral)}
        </span>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="card-pad text-center py-12 text-gray-400">Carregando...</div>
      ) : (
        <div className="card overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th-left">Funcionário</th>
                <th className="th">Equipe</th>
                <th className="th">Data</th>
                <th className="th">Tipo</th>
                <th className="th">Valor</th>
                <th className="th-left">Observação</th>
                <th className="th">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a, i) => (
                <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                  <td className="td font-medium text-[#1a3a5c]">{a.funcionarios?.nome}</td>
                  <td className="td-center text-xs">{a.funcionarios?.equipe}</td>
                  <td className="td-center">{new Date(a.data + 'T12:00').toLocaleDateString('pt-BR')}</td>
                  <td className="td-center"><span className={tipoCor[a.tipo]}>{a.tipo}</span></td>
                  <td className="td-num font-bold text-orange-700">-{formatR$(a.valor)}</td>
                  <td className="td text-gray-500 text-xs">{a.observacao || '—'}</td>
                  <td className="td-center">
                    <button onClick={() => remover(a.id)} className="btn-red btn-sm">Remover</button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-8">
                  Nenhum avulso em {nomeMes(mes)}
                </td></tr>
              )}
            </tbody>
            {filtrados.length > 0 && (
              <tfoot>
                <tr className="bg-orange-50 font-bold">
                  <td className="td" colSpan={4}>TOTAL {equipe || 'GERAL'}</td>
                  <td className="td-num text-orange-700">-{formatR$(totalGeral)}</td>
                  <td className="td" colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
