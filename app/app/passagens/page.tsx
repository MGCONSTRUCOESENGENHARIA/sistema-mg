'use client'
import { useEffect, useState } from 'react'
import { supabase, Funcionario, Obra, FuncionarioObraPassagem, TipoPassagem } from '@/lib/supabase'

export default function PassagensPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [passagens, setPassagens] = useState<FuncionarioObraPassagem[]>([])
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<Partial<FuncionarioObraPassagem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [alertas, setAlertas] = useState<string[]>([])

  useEffect(() => { carregar() }, [equipe])

  async function carregar() {
    setLoading(true)
    const [{ data: funcs }, { data: obrasData }, { data: pass }] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('equipe', equipe).eq('ativo', true).order('nome'),
      supabase.from('obras').select('*').eq('status', 'ATIVA').order('nome'),
      supabase.from('funcionario_obra_passagem').select(`
        *, funcionarios(nome,equipe), obras(nome,codigo)
      `).order('funcionario_id'),
    ])
    setFuncionarios(funcs || [])
    setObras(obrasData || [])
    setPassagens(pass || [])

    // Verificar funcionários sem passagem para obras ativas
    const erros: string[] = []
    funcs?.forEach(f => {
      obrasData?.forEach(o => {
        const tem = pass?.some(p => p.funcionario_id === f.id && p.obra_id === o.id)
        if (!tem) erros.push(`${f.nome} → ${o.nome}`)
      })
    })
    setAlertas(erros)
    setLoading(false)
  }

  function getPassagem(funcId: string, obraId: string): FuncionarioObraPassagem | undefined {
    return passagens.find(p => p.funcionario_id === funcId && p.obra_id === obraId)
  }

  async function salvarPassagem() {
    if (!editando?.funcionario_id || !editando?.obra_id) return
    setSalvando(true)
    setMsg('')

    const payload = {
      funcionario_id: editando.funcionario_id,
      obra_id: editando.obra_id,
      tipo_passagem: editando.tipo_passagem || 'MG',
      valor_passagem: editando.valor_passagem || 0,
    }

    if (editando.id) {
      await supabase.from('funcionario_obra_passagem').update(payload).eq('id', editando.id)
    } else {
      await supabase.from('funcionario_obra_passagem').insert(payload)
    }

    setMsg('✅ Salvo!')
    setTimeout(() => setMsg(''), 2000)
    setEditando(null)
    await carregar()
    setSalvando(false)
  }

  async function preencherMG(funcId: string) {
    // Preenche MG (sem passagem) para todas as obras que ainda não têm
    const inserts = obras
      .filter(o => !getPassagem(funcId, o.id))
      .map(o => ({ funcionario_id: funcId, obra_id: o.id, tipo_passagem: 'MG' as TipoPassagem, valor_passagem: 0 }))
    if (inserts.length) {
      await supabase.from('funcionario_obra_passagem').insert(inserts)
      await carregar()
    }
  }

  async function preencherTodosObrasMG() {
    const inserts: any[] = []
    funcionarios.forEach(f => {
      obras.forEach(o => {
        if (!getPassagem(f.id, o.id)) {
          inserts.push({ funcionario_id: f.id, obra_id: o.id, tipo_passagem: 'MG', valor_passagem: 0 })
        }
      })
    })
    if (inserts.length) {
      await supabase.from('funcionario_obra_passagem').insert(inserts)
      await carregar()
      setMsg(`✅ ${inserts.length} passagens preenchidas com MG`)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const funcsFiltradas = funcionarios.filter(f =>
    !busca || f.nome.toLowerCase().includes(busca.toLowerCase())
  )

  const tipoLabel: Record<TipoPassagem, string> = {
    'PRA FRENTE': 'Pra Frente', 'REEMBOLSO': 'Reembolso',
    'MG': 'MG', 'NÃO TEM': 'Não Tem',
  }

  function corTipo(t?: TipoPassagem): string {
    if (!t) return 'bg-red-100 text-red-700 font-bold'
    if (t === 'MG') return 'bg-gray-100 text-gray-500'
    if (t === 'NÃO TEM') return 'bg-gray-100 text-gray-400'
    return 'bg-blue-50 text-blue-800'
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1a3a5c]">Matriz de Passagens</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Passagem é definida por funcionário + obra. <strong>Obrigatório</strong> para todos os pares.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
            <button key={eq} onClick={() => setEquipe(eq)}
              className={equipe === eq ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>{eq}</button>
          ))}
        </div>
      </div>

      {/* Alertas de passagens faltando */}
      {alertas.length > 0 && (
        <div className="alert-err mb-4">
          <div className="font-semibold mb-1">⚠️ {alertas.length} passagens não cadastradas (bloqueiam cálculo):</div>
          <div className="text-xs max-h-28 overflow-y-auto space-y-0.5 mt-1">
            {alertas.slice(0, 20).map((a, i) => <div key={i}>{a}</div>)}
            {alertas.length > 20 && <div>...e mais {alertas.length - 20}</div>}
          </div>
          <button onClick={preencherTodosObrasMG} className="btn btn-sm bg-red-700 text-white hover:bg-red-800 mt-2">
            Preencher todas com MG (sem passagem)
          </button>
        </div>
      )}

      {msg && <div className="alert-ok mb-4">{msg}</div>}

      {/* Filtros */}
      <div className="card-pad mb-4 flex gap-3 flex-wrap items-center">
        <input type="text" placeholder="🔍 Buscar funcionário..." value={busca}
          onChange={e => setBusca(e.target.value)} className="input w-56" />
        <span className="text-xs text-gray-400 ml-auto">
          {funcionarios.length} funcionários × {obras.length} obras = {funcionarios.length * obras.length} combinações
        </span>
      </div>

      {/* Matriz */}
      {loading ? (
        <div className="card-pad text-center py-12 text-gray-400">Carregando...</div>
      ) : (
        <div className="card overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="border-collapse" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th className="th-left sticky left-0 z-20 bg-[#1a3a5c]" style={{ minWidth: 220 }}>Funcionário</th>
                <th className="th sticky left-[220px] z-20 bg-[#1a3a5c]" style={{ minWidth: 100 }}>Ação</th>
                {obras.map(o => (
                  <th key={o.id} className="th" style={{ minWidth: 110 }}>
                    {o.codigo}<br /><span className="font-normal text-[9px] opacity-70">{o.nome.substring(0, 12)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {funcsFiltradas.map((func, fi) => {
                const totalSemPass = obras.filter(o => {
                  const p = getPassagem(func.id, o.id)
                  return !p
                }).length
                return (
                  <tr key={func.id} className={fi % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="td font-semibold text-[#1a3a5c] sticky left-0 z-[1] bg-inherit border-r border-gray-200" style={{ minWidth: 220 }}>
                      <div>{func.nome}</div>
                      {totalSemPass > 0 && (
                        <span className="badge-err mt-0.5">{totalSemPass} sem cadastro</span>
                      )}
                    </td>
                    <td className="td sticky left-[220px] z-[1] bg-inherit border-r border-gray-200" style={{ minWidth: 100 }}>
                      <button onClick={() => preencherMG(func.id)}
                        className="text-[10px] text-gray-400 hover:text-gray-600 underline">
                        Preencher MG
                      </button>
                    </td>
                    {obras.map(obra => {
                      const p = getPassagem(func.id, obra.id)
                      return (
                        <td key={obra.id}
                          onClick={() => setEditando(p
                            ? { ...p }
                            : { funcionario_id: func.id, obra_id: obra.id, tipo_passagem: 'MG', valor_passagem: 0 }
                          )}
                          className={`td text-center text-[10px] cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-inset transition-all ${p ? corTipo(p.tipo_passagem) : 'bg-red-50 text-red-600 font-bold'}`}
                          style={{ minWidth: 110 }}
                          title={p ? `${tipoLabel[p.tipo_passagem]} — R$ ${p.valor_passagem}` : 'Não cadastrado — clique para definir'}>
                          {p ? (
                            <div>
                              <div>{tipoLabel[p.tipo_passagem]}</div>
                              {p.valor_passagem > 0 && <div className="font-bold">R$ {p.valor_passagem}</div>}
                            </div>
                          ) : (
                            <div>⚠ Falta</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de edição de passagem */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="font-semibold text-[#1a3a5c] text-sm">
                {funcionarios.find(f => f.id === editando.funcionario_id)?.nome}
              </div>
              <div className="text-gray-400 text-xs">
                {obras.find(o => o.id === editando.obra_id)?.nome}
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Tipo de passagem</label>
                <select className="select" value={editando.tipo_passagem || 'MG'}
                  onChange={e => setEditando(p => ({ ...p, tipo_passagem: e.target.value as TipoPassagem }))}>
                  <option value="PRA FRENTE">Pra Frente (vale transporte)</option>
                  <option value="REEMBOLSO">Reembolso</option>
                  <option value="MG">MG (sem passagem)</option>
                  <option value="NÃO TEM">Não Tem</option>
                </select>
              </div>
              {(editando.tipo_passagem === 'PRA FRENTE' || editando.tipo_passagem === 'REEMBOLSO') && (
                <div>
                  <label className="label">Valor unitário da passagem (R$)</label>
                  <input type="number" step="0.01" className="input"
                    value={editando.valor_passagem || ''}
                    onChange={e => setEditando(p => ({ ...p, valor_passagem: parseFloat(e.target.value) || 0 }))}
                    placeholder="Ex: 17.90" />
                  <p className="text-xs text-gray-400 mt-1">
                    Valor por trajeto. Para 2 obras no mesmo dia, o sistema faz (obra1 + obra2) ÷ 2.
                  </p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => setEditando(null)} className="btn-ghost btn-sm">Cancelar</button>
              <button onClick={salvarPassagem} disabled={salvando} className="btn-primary btn-sm">
                {salvando ? 'Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
