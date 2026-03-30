'use client'
import { useEffect, useState } from 'react'
import { supabase, Funcionario, EquipeTipo, TipoPassagem } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'

const VAZIO: Partial<Funcionario> = {
  equipe: 'ARMAÇÃO', funcao: 'Armador', valor_diaria: 0,
  salario_base: 0, ativo: true
}

export default function FuncionariosPage() {
  const [funcs, setFuncs] = useState<Funcionario[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Partial<Funcionario> | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroEq, setFiltroEq] = useState<'' | EquipeTipo>('')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('funcionarios').select('*').order('equipe').order('nome')
    setFuncs(data || [])
    setLoading(false)
  }

  async function salvar() {
    if (!editando?.nome?.trim()) { setMsg({ tipo: 'err', texto: 'Nome é obrigatório.' }); return }
    if (!editando.valor_diaria || editando.valor_diaria <= 0) { setMsg({ tipo: 'err', texto: 'Valor da diária deve ser maior que zero.' }); return }
    if (!editando.salario_base || editando.salario_base <= 0) { setMsg({ tipo: 'err', texto: 'Salário base deve ser maior que zero.' }); return }
    setSalvando(true)
    setMsg(null)
    const payload = {
      nome: editando.nome!.trim(),
      equipe: editando.equipe!, funcao: editando.funcao || 'Operário',
      empresa: editando.empresa || null, cpf: editando.cpf || null,
      valor_diaria: editando.valor_diaria!, salario_base: editando.salario_base!,
      ativo: editando.ativo ?? true,
    }
    const { error } = editando.id
      ? await supabase.from('funcionarios').update(payload).eq('id', editando.id)
      : await supabase.from('funcionarios').insert(payload)
    if (error) { setMsg({ tipo: 'err', texto: error.message }); setSalvando(false); return }
    setMsg({ tipo: 'ok', texto: '✅ Funcionário salvo!' })
    setTimeout(() => setMsg(null), 2500)
    setEditando(null)
    await carregar()
    setSalvando(false)
  }

  async function toggleAtivo(f: Funcionario) {
    await supabase.from('funcionarios').update({ ativo: !f.ativo }).eq('id', f.id)
    await carregar()
  }

  const filtrados = funcs.filter(f => {
    if (filtroEq && f.equipe !== filtroEq) return false
    if (busca && !f.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const arm = funcs.filter(f => f.equipe === 'ARMAÇÃO' && f.ativo).length
  const carp = funcs.filter(f => f.equipe === 'CARPINTARIA' && f.ativo).length

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1a3a5c]">Funcionários</h1>
          <p className="text-gray-500 text-sm mt-0.5">{arm} armação · {carp} carpintaria</p>
        </div>
        <button onClick={() => setEditando({ ...VAZIO })} className="btn-primary">
          + Novo Funcionário
        </button>
      </div>

      {msg && <div className={msg.tipo === 'ok' ? 'alert-ok mb-4' : 'alert-err mb-4'}>{msg.texto}</div>}

      {/* Filtros */}
      <div className="card-pad mb-4 flex gap-3 flex-wrap items-center">
        <input type="text" placeholder="🔍 Buscar pelo nome..." value={busca}
          onChange={e => setBusca(e.target.value)} className="input w-56" />
        <div className="flex gap-1">
          {(['', 'ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
            <button key={eq} onClick={() => setFiltroEq(eq)}
              className={filtroEq === eq ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>
              {eq || 'Todos'}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-400">{filtrados.length} funcionários</span>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="card-pad text-center py-12 text-gray-400">Carregando...</div>
      ) : (
        <div className="card overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th-left">Nome</th>
                <th className="th">Equipe</th>
                <th className="th">Função</th>
                <th className="th">Diária</th>
                <th className="th">Salário Base</th>
                <th className="th">Status</th>
                <th className="th">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((f, i) => (
                <tr key={f.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'} ${!f.ativo ? 'opacity-50' : ''}`}>
                  <td className="td font-medium text-[#1a3a5c]">{f.nome}</td>
                  <td className="td-center">
                    <span className={f.equipe === 'ARMAÇÃO' ? 'badge-blue' : 'badge badge-warn'}>{f.equipe}</span>
                  </td>
                  <td className="td text-gray-500">{f.funcao}</td>
                  <td className="td-num font-semibold">{formatR$(f.valor_diaria)}</td>
                  <td className="td-num">{formatR$(f.salario_base)}</td>
                  <td className="td-center">
                    <span className={f.ativo ? 'badge-ok' : 'badge-err'}>{f.ativo ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="td-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => setEditando({ ...f })} className="btn-ghost btn-sm">Editar</button>
                      <button onClick={() => toggleAtivo(f)}
                        className="btn btn-sm bg-gray-100 text-gray-600 hover:bg-gray-200">
                        {f.ativo ? 'Inativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-8">Nenhum funcionário encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-bold text-[#1a3a5c]">{editando.id ? 'Editar' : 'Novo'} Funcionário</h2>
            </div>
            <div className="p-6 space-y-4">
              {msg?.tipo === 'err' && <div className="alert-err">{msg.texto}</div>}
              <div>
                <label className="label">Nome completo *</label>
                <input className="input" value={editando.nome || ''} onChange={e => setEditando(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Equipe *</label>
                  <select className="select" value={editando.equipe || 'ARMAÇÃO'}
                    onChange={e => setEditando(p => ({ ...p, equipe: e.target.value as EquipeTipo }))}>
                    <option value="ARMAÇÃO">Armação</option>
                    <option value="CARPINTARIA">Carpintaria</option>
                  </select>
                </div>
                <div>
                  <label className="label">Função</label>
                  <input className="input" value={editando.funcao || ''} onChange={e => setEditando(p => ({ ...p, funcao: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valor Diária (R$) *</label>
                  <input type="number" step="0.01" className="input" value={editando.valor_diaria || ''}
                    onChange={e => setEditando(p => ({ ...p, valor_diaria: +e.target.value }))} />
                </div>
                <div>
                  <label className="label">Salário Base (R$) *</label>
                  <input type="number" step="0.01" className="input" value={editando.salario_base || ''}
                    onChange={e => setEditando(p => ({ ...p, salario_base: +e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">CPF</label>
                  <input className="input" value={editando.cpf || ''} onChange={e => setEditando(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" />
                </div>
                <div>
                  <label className="label">Empresa</label>
                  <input className="input" value={editando.empresa || ''} onChange={e => setEditando(p => ({ ...p, empresa: e.target.value }))} />
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>Passagem:</strong> Configurada na tela "Matriz de Passagens" por funcionário + obra.
                Não é um campo fixo aqui.
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => { setEditando(null); setMsg(null) }} className="btn-ghost">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="btn-primary">
                {salvando ? 'Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
