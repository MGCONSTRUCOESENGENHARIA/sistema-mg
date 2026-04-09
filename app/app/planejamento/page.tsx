'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'

interface Func {
  id: string; nome: string; equipe: string; funcao: string; valor_diaria: number
}
interface Obra { id: string; nome: string; codigo: string }
interface Alocacao { id: string; obra_id: string; funcionario_id: string }

export default function PlanejamentoPage() {
  const [funcs, setFuncs] = useState<Func[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([])
  const [loading, setLoading] = useState(true)
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  useEffect(() => { carregar() }, [equipe])

  async function carregar() {
    setLoading(true)
    const [{ data: fs }, { data: os }, { data: al }] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,equipe,funcao,valor_diaria').eq('ativo', true).eq('equipe', equipe).order('nome'),
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

  function getNaoAlocados() {
    const ids = alocacoes.map(a => a.funcionario_id)
    return funcs.filter(f => !ids.includes(f.id))
  }

  async function alocar(funcId: string, obraId: string | null) {
    await supabase.from('planejamento_obras').delete().eq('funcionario_id', funcId)
    if (obraId) {
      const { data: nova } = await supabase.from('planejamento_obras').insert({
        obra_id: obraId, funcionario_id: funcId
      }).select().single()
      setAlocacoes(prev => [...prev.filter(a => a.funcionario_id !== funcId), nova as Alocacao])
    } else {
      setAlocacoes(prev => prev.filter(a => a.funcionario_id !== funcId))
    }
  }

  function onDrop(obraId: string | null) {
    if (!dragging) return
    alocar(dragging, obraId)
    setDragging(null)
    setDragOver(null)
  }

  const CORES = ['#1e3a8a','#065f46','#7c3aed','#92400e','#0891b2','#dc2626','#059669','#4f46e5','#be185d','#0f766e','#b45309','#1d4ed8','#7f1d1d','#14532d','#4c1d95','#0c4a6e','#713f12','#581c87']

  const FuncCard = ({ func, showX }: { func: Func; showX: boolean }) => (
    <div
      draggable
      onDragStart={() => setDragging(func.id)}
      onDragEnd={() => setDragging(null)}
      style={{
        display:'flex', alignItems:'center', gap:6, padding:'5px 8px',
        background: dragging === func.id ? '#dbeafe' : 'white',
        border:`1px solid ${dragging === func.id ? '#93c5fd' : '#e5e7eb'}`,
        borderRadius:6, cursor:'grab', marginBottom:4,
        boxShadow:'0 1px 2px rgba(0,0,0,.04)', transition:'all .1s',
      }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'#1f2937', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {func.nome.split(' ').slice(0,2).join(' ')}
        </div>
        <div style={{ fontSize:10, color:'#9ca3af' }}>{func.funcao || '—'} · {formatR$(func.valor_diaria)}</div>
      </div>
      {showX && (
        <button onClick={() => alocar(func.id, null)}
          style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:14, padding:0, lineHeight:1, flexShrink:0 }}>×</button>
      )}
    </div>
  )

  const Bloco = ({ obraId, titulo, cor }: { obraId: string | null; titulo: string; cor: string }) => {
    const lista = obraId ? getFuncsObra(obraId) : getNaoAlocados()
    const isOver = dragOver === (obraId || 'nao')
    const total = lista.reduce((s, f) => s + (f.valor_diaria || 0), 0)

    return (
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(obraId || 'nao') }}
        onDragLeave={() => setDragOver(null)}
        onDrop={() => onDrop(obraId)}
        style={{
          border:`2px solid ${isOver ? '#3b82f6' : '#e5e7eb'}`,
          borderRadius:10, overflow:'hidden', background: isOver ? '#eff6ff' : 'white',
          transition:'all .15s',
          boxShadow: isOver ? '0 0 0 3px rgba(59,130,246,.2)' : '0 1px 3px rgba(0,0,0,.06)',
        }}>
        {/* Header */}
        <div style={{ background:cor, padding:'8px 10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ color:'white', fontWeight:700, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, marginRight:6 }}>
            {titulo}
          </div>
          <div style={{ background:'rgba(255,255,255,.25)', borderRadius:20, padding:'1px 8px', color:'white', fontSize:11, fontWeight:700, flexShrink:0 }}>
            {lista.length}
          </div>
        </div>

        {/* Lista */}
        <div style={{ padding:'8px 8px 4px', minHeight:60 }}>
          {lista.length === 0 ? (
            <div style={{ textAlign:'center', color:'#d1d5db', fontSize:11, padding:'14px 0' }}>
              {isOver ? '📥 Soltar aqui' : 'Vazio'}
            </div>
          ) : lista.map(f => <FuncCard key={f.id} func={f} showX={!!obraId} />)}
        </div>

        {/* Footer */}
        <div style={{ padding:'5px 10px', borderTop:'1px solid #f3f4f6', background:'#f9fafb', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:10, color:'#9ca3af' }}>{lista.length} func.</span>
          {obraId && total > 0 && <span style={{ fontSize:10, fontWeight:700, color:'#059669' }}>{formatR$(total)}/dia</span>}
        </div>
      </div>
    )
  }

  const btnEq = (eq: 'ARMAÇÃO' | 'CARPINTARIA') => ({
    padding:'7px 18px', borderRadius:8, border:'2px solid #1a3a5c', cursor:'pointer', fontWeight:700, fontSize:13,
    background: equipe===eq ? '#1a3a5c' : '#fff', color: equipe===eq ? '#fff' : '#1a3a5c',
  })

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1f2937', marginBottom:4 }}>Planejamento de Obras</h1>
          <p style={{ fontSize:13, color:'#9ca3af' }}>Arraste os funcionários entre os blocos para alocar nas obras</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={btnEq('ARMAÇÃO')} onClick={() => setEquipe('ARMAÇÃO')}>Armação</button>
          <button style={btnEq('CARPINTARIA')} onClick={() => setEquipe('CARPINTARIA')}>Carpintaria</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:12, alignItems:'start' }}>
          {/* Não Alocados - coluna fixa */}
          <div>
            <Bloco obraId={null} titulo={`Não Alocados`} cor="#6b7280" />
          </div>
          {/* Obras em grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10 }}>
            {obras.map((obra, i) => (
              <Bloco key={obra.id} obraId={obra.id} titulo={obra.nome} cor={CORES[i % CORES.length]} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
