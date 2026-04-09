'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'

interface Func {
  id: string; nome: string; equipe: string; funcao: string
  valor_diaria: number; salario_base: number
}
interface Obra { id: string; nome: string; codigo: string }
interface Alocacao { id: string; obra_id: string; funcionario_id: string; funcao: string }

export default function PlanejamentoPage() {
  const [funcs, setFuncs] = useState<Func[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([])
  const [loading, setLoading] = useState(true)
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { carregar() }, [equipe])

  async function carregar() {
    setLoading(true)
    const [{ data: fs }, { data: os }, { data: al }] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,equipe,funcao,valor_diaria,salario_base').eq('ativo', true).eq('equipe', equipe).order('nome'),
      supabase.from('obras').select('id,nome,codigo').eq('status', 'ATIVA').order('nome'),
      supabase.from('planejamento_obras').select('*'),
    ])
    setFuncs(fs || [])
    setObras(os || [])
    setAlocacoes(al || [])
    setLoading(false)
  }

  function getFuncsObra(obraId: string) {
    const ids = alocacoes.filter(a => a.obra_id === obraId).map(a => a.funcionario_id)
    return funcs.filter(f => ids.includes(f.id))
  }

  function getFuncsNaoAlocados() {
    const alocadosIds = alocacoes.map(a => a.funcionario_id)
    return funcs.filter(f => !alocadosIds.includes(f.id))
  }

  async function alocar(funcId: string, obraId: string | null) {
    // Remove alocação anterior
    await supabase.from('planejamento_obras').delete().eq('funcionario_id', funcId)

    if (obraId) {
      const func = funcs.find(f => f.id === funcId)
      const { data: nova } = await supabase.from('planejamento_obras').insert({
        obra_id: obraId, funcionario_id: funcId, funcao: func?.funcao || ''
      }).select().single()

      setAlocacoes(prev => [...prev.filter(a => a.funcionario_id !== funcId), nova as Alocacao])
    } else {
      setAlocacoes(prev => prev.filter(a => a.funcionario_id !== funcId))
    }
  }

  function onDragStart(funcId: string) {
    setDragging(funcId)
  }

  function onDrop(obraId: string | null) {
    if (!dragging) return
    alocar(dragging, obraId)
    setDragging(null)
    setDragOver(null)
  }

  const btnEq = (eq: 'ARMAÇÃO' | 'CARPINTARIA') => ({
    padding: '7px 18px', borderRadius: 8, border: '2px solid #1a3a5c', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: equipe === eq ? '#1a3a5c' : '#fff', color: equipe === eq ? '#fff' : '#1a3a5c',
  })

  const FuncCard = ({ func, obraId }: { func: Func; obraId: string | null }) => (
    <div
      draggable
      onDragStart={() => onDragStart(func.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
        background: dragging === func.id ? '#eff6ff' : 'white',
        border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'grab',
        marginBottom: 6, transition: 'all .15s',
        boxShadow: dragging === func.id ? '0 4px 12px rgba(0,0,0,.1)' : '0 1px 3px rgba(0,0,0,.05)',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#93c5fd'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {func.nome.split(' ').slice(0, 3).join(' ')}
        </div>
        <div style={{ fontSize: 10, color: '#9ca3af' }}>{func.funcao || '—'}</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>
        {formatR$(func.valor_diaria)}
      </div>
      {obraId && (
        <button onClick={() => alocar(func.id, null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, padding: 0, lineHeight: 1 }}>
          ×
        </button>
      )}
    </div>
  )

  const Bloco = ({ obraId, titulo, cor }: { obraId: string | null; titulo: string; cor: string }) => {
    const lista = obraId ? getFuncsObra(obraId) : getFuncsNaoAlocados()
    const isOver = dragOver === (obraId || 'nao-alocados')
    const totalDiaria = lista.reduce((s, f) => s + (f.valor_diaria || 0), 0)

    return (
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(obraId || 'nao-alocados') }}
        onDragLeave={() => setDragOver(null)}
        onDrop={() => onDrop(obraId)}
        style={{
          border: `2px solid ${isOver ? '#3b82f6' : '#e5e7eb'}`,
          borderRadius: 12, overflow: 'hidden', minWidth: 220, maxWidth: 260,
          background: isOver ? '#eff6ff' : 'white',
          transition: 'all .15s', flexShrink: 0,
          boxShadow: isOver ? '0 0 0 4px rgba(59,130,246,.2)' : '0 1px 4px rgba(0,0,0,.06)',
        }}>
        {/* Header */}
        <div style={{ background: cor, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{titulo}</div>
            {obraId && <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 10 }}>{formatR$(totalDiaria)}/dia</div>}
          </div>
          <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 20, padding: '2px 10px', color: 'white', fontSize: 12, fontWeight: 700 }}>
            {lista.length}
          </div>
        </div>

        {/* Lista */}
        <div style={{ padding: '10px 10px 4px', minHeight: 80 }}>
          {lista.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#d1d5db', fontSize: 12, padding: '20px 0' }}>
              {isOver ? '📥 Soltar aqui' : 'Arraste funcionários aqui'}
            </div>
          ) : (
            lista.map(f => <FuncCard key={f.id} func={f} obraId={obraId} />)
          )}
        </div>

        {/* Footer total */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #f3f4f6', background: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{lista.length} funcionário{lista.length !== 1 ? 's' : ''}</span>
          {obraId && totalDiaria > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>{formatR$(totalDiaria)}/dia</span>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>Planejamento de Obras</h1>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>Arraste os funcionários entre os blocos para alocar nas obras</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnEq('ARMAÇÃO')} onClick={() => setEquipe('ARMAÇÃO')}>Armação</button>
          <button style={btnEq('CARPINTARIA')} onClick={() => setEquipe('CARPINTARIA')}>Carpintaria</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
          {/* Bloco Não Alocados */}
          <Bloco obraId={null} titulo="Não Alocados" cor="#6b7280" />

          {/* Blocos por obra */}
          {obras.map((obra, i) => {
            const cores = ['#1e3a8a', '#065f46', '#7c3aed', '#92400e', '#0891b2', '#dc2626', '#059669', '#4f46e5']
            return (
              <Bloco key={obra.id} obraId={obra.id} titulo={obra.nome} cor={cores[i % cores.length]} />
            )
          })}
        </div>
      )}
    </div>
  )
}
