'use client'
import { useEffect, useState } from 'react'
import { supabase, Obra, ObraStatus } from '@/lib/supabase'

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<Partial<Obra> | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)
  const [busca, setBusca] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('obras').select('*').order('status').order('nome')
    setObras(data || [])
    setLoading(false)
  }

  async function salvar() {
    if (!editando?.nome?.trim()) { setMsg({ tipo: 'err', texto: 'Nome é obrigatório.' }); return }
    if (!editando?.codigo?.trim()) { setMsg({ tipo: 'err', texto: 'Código é obrigatório.' }); return }
    setSalvando(true); setMsg(null)
    const payload = {
      nome: editando.nome.trim().toUpperCase(),
      codigo: editando.codigo.trim().toUpperCase(),
      status: editando.status || 'ATIVA',
    }
    const { error } = editando.id
      ? await supabase.from('obras').update(payload).eq('id', editando.id)
      : await supabase.from('obras').insert(payload)
    if (error) { setMsg({ tipo: 'err', texto: error.message }); setSalvando(false); return }
    setMsg({ tipo: 'ok', texto: '✅ Obra salva!' })
    setTimeout(() => setMsg(null), 2000)
    setEditando(null)
    await carregar()
    setSalvando(false)
  }

  const filtradas = obras.filter(o => !busca || o.nome.toLowerCase().includes(busca.toLowerCase()) || o.codigo.toLowerCase().includes(busca.toLowerCase()))
  const ativas = obras.filter(o => o.status === 'ATIVA').length

  const corStatus: Record<ObraStatus, string> = {
    ATIVA: 'badge-ok', INATIVA: 'badge-warn', CONCLUIDA: 'badge-gray'
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1a3a5c]">Obras</h1>
          <p className="text-gray-500 text-sm mt-0.5">{ativas} ativas de {obras.length} total</p>
        </div>
        <button onClick={() => setEditando({ status: 'ATIVA' })} className="btn-primary">+ Nova Obra</button>
      </div>

      {msg && <div className={msg.tipo === 'ok' ? 'alert-ok mb-4' : 'alert-err mb-4'}>{msg.texto}</div>}

      <div className="card-pad mb-4">
        <input type="text" placeholder="🔍 Buscar por nome ou código..." value={busca}
          onChange={e => setBusca(e.target.value)} className="input w-72" />
      </div>

      {loading ? (
        <div className="card-pad text-center py-12 text-gray-400">Carregando...</div>
      ) : (
        <div className="card overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th" style={{ width: 80 }}>Código</th>
                <th className="th-left">Nome</th>
                <th className="th">Status</th>
                <th className="th">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((o, i) => (
                <tr key={o.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                  <td className="td text-center font-mono font-bold text-[#1a3a5c]">{o.codigo}</td>
                  <td className="td font-medium">{o.nome}</td>
                  <td className="td-center"><span className={corStatus[o.status]}>{o.status}</span></td>
                  <td className="td-center">
                    <button onClick={() => setEditando({ ...o })} className="btn-ghost btn-sm">Editar</button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={4} className="td text-center text-gray-400 py-8">Nenhuma obra encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[#1a3a5c]">{editando.id ? 'Editar' : 'Nova'} Obra</h2>
            </div>
            <div className="p-5 space-y-4">
              {msg?.tipo === 'err' && <div className="alert-err">{msg.texto}</div>}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Código *</label>
                  <input className="input font-mono uppercase" value={editando.codigo || ''}
                    onChange={e => setEditando(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                    placeholder="BLL" />
                </div>
                <div className="col-span-2">
                  <label className="label">Nome completo *</label>
                  <input className="input uppercase" value={editando.nome || ''}
                    onChange={e => setEditando(p => ({ ...p, nome: e.target.value.toUpperCase() }))}
                    placeholder="BLL MANGABEIRAS" />
                </div>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" value={editando.status || 'ATIVA'}
                  onChange={e => setEditando(p => ({ ...p, status: e.target.value as ObraStatus }))}>
                  <option value="ATIVA">Ativa</option>
                  <option value="INATIVA">Inativa</option>
                  <option value="CONCLUIDA">Concluída</option>
                </select>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end">
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
