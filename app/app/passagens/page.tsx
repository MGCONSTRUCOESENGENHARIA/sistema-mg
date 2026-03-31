'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type TipoPassagem = 'PRA FRENTE' | 'REEMBOLSO' | 'MG' | 'NÃO TEM'

interface Funcionario {
  id: string
  nome: string
  equipe: string
  ativo: boolean
}

interface Obra {
  id: string
  codigo: string
  nome: string
  status: string
}

interface Passagem {
  id: string
  funcionario_id: string
  obra_id: string
  tipo_passagem: TipoPassagem
  valor_passagem: number
}

export default function PassagensPage() {
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [passagens, setPassagens] = useState<Passagem[]>([])
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<Partial<Passagem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { carregar() }, [equipe])

  async function carregar() {
    setLoading(true)
    const [{ data: funcs }, { data: obrasData }, { data: pass }] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,equipe,ativo').eq('equipe', equipe).eq('ativo', true).order('nome'),
      supabase.from('obras').select('id,codigo,nome,status').eq('status', 'ATIVA').order('nome'),
      supabase.from('funcionario_obra_passagem').select('id,funcionario_id,obra_id,tipo_passagem,valor_passagem'),
    ])
    setFuncionarios(funcs || [])
    setObras(obrasData || [])
    setPassagens(pass || [])
    setLoading(false)
  }

  function getPassagem(funcId: string, obraId: string): Passagem | undefined {
    return passagens.find(p => p.funcionario_id === funcId && p.obra_id === obraId)
  }

  async function salvarPassagem() {
    if (!editando?.funcionario_id || !editando?.obra_id) return
    setSalvando(true)
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
    setEditando(null)
    await carregar()
    setSalvando(false)
  }

  async function preencherMG(funcId: string) {
    const inserts = obras
      .filter(o => !getPassagem(funcId, o.id))
      .map(o => ({ funcionario_id: funcId, obra_id: o.id, tipo_passagem: 'MG' as TipoPassagem, valor_passagem: 0 }))
    if (inserts.length) {
      await supabase.from('funcionario_obra_passagem').insert(inserts)
      await carregar()
    }
  }

  async function preencherTodosMG() {
    const inserts: any[] = []
    funcionarios.forEach(f => {
      obras.forEach(o => {
        if (!getPassagem(f.id, o.id)) {
          inserts.push({ funcionario_id: f.id, obra_id: o.id, tipo_passagem: 'MG', valor_passagem: 0 })
        }
      })
    })
    if (inserts.length) {
      // Inserir em lotes de 100
      for (let i = 0; i < inserts.length; i += 100) {
        await supabase.from('funcionario_obra_passagem').insert(inserts.slice(i, i + 100))
      }
      await carregar()
      setMsg(`✅ ${inserts.length} passagens preenchidas com MG`)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const funcsFiltradas = funcionarios.filter(f =>
    !busca || f.nome.toLowerCase().includes(busca.toLowerCase())
  )

  const semCadastro = funcionarios.reduce((total, f) => {
    return total + obras.filter(o => !getPassagem(f.id, o.id)).length
  }, 0)

  const tipoLabel: Record<TipoPassagem, string> = {
    'PRA FRENTE': 'Pra Frente',
    'REEMBOLSO': 'Reembolso',
    'MG': 'MG',
    'NÃO TEM': 'Não Tem',
  }

  function corCelula(p: Passagem | undefined): string {
    if (!p) return 'bg-red-50 text-red-600 font-bold cursor-pointer hover:bg-red-100'
    if (p.tipo_passagem === 'MG' || p.tipo_passagem === 'NÃO TEM') return 'bg-gray-50 text-gray-500 cursor-pointer hover:bg-gray-100'
    return 'bg-blue-50 text-blue-800 cursor-pointer hover:bg-blue-100'
  }

  return (
    <div>
      {/* HEADER */}
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1a3a5c]">Matriz de Passagens</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Passagem é definida por funcionário + obra. <strong>Obrigatório</strong> para todos os pares.
          </p>
        </div>
        {/* BOTÕES EQUIPE */}
        <div className="flex gap-2">
          <button
            onClick={() => setEquipe('ARMAÇÃO')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '2px solid #1a3a5c',
              background: equipe === 'ARMAÇÃO' ? '#1a3a5c' : '#fff',
              color: equipe === 'ARMAÇÃO' ? '#fff' : '#1a3a5c',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Armação ({equipe === 'ARMAÇÃO' ? funcionarios.length : '...'})
          </button>
          <button
            onClick={() => setEquipe('CARPINTARIA')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '2px solid #1a3a5c',
              background: equipe === 'CARPINTARIA' ? '#1a3a5c' : '#fff',
              color: equipe === 'CARPINTARIA' ? '#fff' : '#1a3a5c',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Carpintaria ({equipe === 'CARPINTARIA' ? funcionarios.length : '...'})
          </button>
        </div>
      </div>

      {/* ALERTAS */}
      {semCadastro > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#7f1d1d' }}>
            ⚠️ {semCadastro} passagens não cadastradas — bloqueiam cálculo
          </div>
          <button
            onClick={preencherTodosMG}
            style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Preencher todas com MG (sem passagem)
          </button>
        </div>
      )}

      {msg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#14532d' }}>
          {msg}
        </div>
      )}

      {/* FILTRO */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
        <input
          type="text"
          placeholder="🔍 Buscar funcionário..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, width: 260 }}
        />
        <span style={{ marginLeft: 16, fontSize: 12, color: '#9ca3af' }}>
          {funcionarios.length} funcionários × {obras.length} obras
        </span>
      </div>

      {/* TABELA */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 'calc(100vh - 320px)' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 'max-content', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ background: '#1a3a5c', color: '#fff', padding: '8px 12px', textAlign: 'left', minWidth: 220, position: 'sticky', left: 0, zIndex: 20, fontSize: 11 }}>
                  Funcionário
                </th>
                <th style={{ background: '#1a3a5c', color: '#fff', padding: '8px 12px', minWidth: 100, position: 'sticky', left: 220, zIndex: 20, fontSize: 11 }}>
                  Ação
                </th>
                {obras.map(o => (
                  <th key={o.id} style={{ background: '#1a3a5c', color: '#fff', padding: '8px 6px', minWidth: 100, textAlign: 'center', fontSize: 10 }}>
                    {o.codigo}<br />
                    <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 9 }}>{o.nome.substring(0, 10)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {funcsFiltradas.map((func, fi) => {
                const semPass = obras.filter(o => !getPassagem(func.id, o.id)).length
                return (
                  <tr key={func.id} style={{ background: fi % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1a3a5c', position: 'sticky', left: 0, background: fi % 2 === 0 ? '#fff' : '#f9fafb', zIndex: 1, borderRight: '1px solid #e5e7eb', fontSize: 12, minWidth: 220 }}>
                      {func.nome}
                      {semPass > 0 && (
                        <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: 10, padding: '1px 6px', borderRadius: 8, marginLeft: 6 }}>
                          {semPass} faltando
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '4px 8px', position: 'sticky', left: 220, background: fi % 2 === 0 ? '#fff' : '#f9fafb', zIndex: 1, borderRight: '1px solid #e5e7eb', minWidth: 100 }}>
                      <button
                        onClick={() => preencherMG(func.id)}
                        style={{ fontSize: 10, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Preencher MG
                      </button>
                    </td>
                    {obras.map(obra => {
                      const p = getPassagem(func.id, obra.id)
                      return (
                        <td
                          key={obra.id}
                          onClick={() => setEditando(p
                            ? { ...p }
                            : { funcionario_id: func.id, obra_id: obra.id, tipo_passagem: 'MG', valor_passagem: 0 }
                          )}
                          style={{ padding: '4px', textAlign: 'center', fontSize: 10, cursor: 'pointer', minWidth: 100, borderBottom: '1px solid #f3f4f6' }}
                          className={corCelula(p)}
                          title={p ? `${tipoLabel[p.tipo_passagem]} — R$ ${p.valor_passagem}` : 'Clique para cadastrar'}
                        >
                          {p ? (
                            <div>
                              <div>{tipoLabel[p.tipo_passagem]}</div>
                              {p.valor_passagem > 0 && <div style={{ fontWeight: 700 }}>R$ {p.valor_passagem}</div>}
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

      {/* MODAL */}
      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: 380 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontWeight: 700, color: '#1a3a5c', fontSize: 14 }}>
                {funcionarios.find(f => f.id === editando.funcionario_id)?.nome}
              </div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>
                {obras.find(o => o.id === editando.obra_id)?.nome}
              </div>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tipo de passagem</label>
                <select
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                  value={editando.tipo_passagem || 'MG'}
                  onChange={e => setEditando(p => ({ ...p, tipo_passagem: e.target.value as TipoPassagem }))}
                >
                  <option value="PRA FRENTE">Pra Frente (vale transporte)</option>
                  <option value="REEMBOLSO">Reembolso</option>
                  <option value="MG">MG (sem passagem)</option>
                  <option value="NÃO TEM">Não Tem</option>
                </select>
              </div>
              {(editando.tipo_passagem === 'PRA FRENTE' || editando.tipo_passagem === 'REEMBOLSO') && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Valor unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                    value={editando.valor_passagem || ''}
                    onChange={e => setEditando(p => ({ ...p, valor_passagem: parseFloat(e.target.value) || 0 }))}
                    placeholder="Ex: 17.90"
                  />
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    Para 2 obras no mesmo dia: (obra1 + obra2) ÷ 2
                  </p>
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditando(null)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #1a3a5c', background: '#fff', color: '#1a3a5c', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={salvarPassagem} disabled={salvando} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1a3a5c', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {salvando ? 'Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
