'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'

interface Diaria {
  id: string; obra_id: string; funcionario_id: string; data: string
  tipo: string; quantidade: number; servico: string; observacao: string
  descontada_producao: boolean; recebida_medicao: boolean
  obras?: any; funcionarios?: any
}

export default function DiariasPage() {
  const [diarias, setDiarias] = useState<Diaria[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [obraFiltro, setObraFiltro] = useState('')
  const [equipe, setEquipe] = useState<'ARMAÇÃO'|'CARPINTARIA'|''>('')
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ obra_id:'', funcionario_id:'', data:new Date().toISOString().slice(0,10), tipo:'CONTA_MG', quantidade:'1', servico:'', observacao:'' })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: ds }, { data: os }, { data: fs }] = await Promise.all([
      supabase.from('diarias_extras').select('*, obras(nome,codigo), funcionarios(nome,equipe,valor_diaria)').order('data', { ascending: false }),
      supabase.from('obras').select('id,nome').eq('status','ATIVA').order('nome'),
      supabase.from('funcionarios').select('id,nome,equipe').eq('ativo',true).order('nome'),
    ])
    setDiarias(ds || [])
    setObras(os || [])
    setFuncs(fs || [])
    setLoading(false)
  }

  async function toggle(id: string, field: string, val: boolean) {
    await supabase.from('diarias_extras').update({ [field]: !val }).eq('id', id)
    setDiarias(prev => prev.map(d => d.id === id ? { ...d, [field]: !val } : d))
  }

  async function deletar(id: string) {
    if (!confirm('Deletar esta diária?')) return
    await supabase.from('diarias_extras').delete().eq('id', id)
    setDiarias(prev => prev.filter(d => d.id !== id))
  }

  async function salvarNova() {
    if (!form.obra_id || !form.funcionario_id || !form.data) return
    setSalvando(true)
    await supabase.from('diarias_extras').insert({
      obra_id:form.obra_id, funcionario_id:form.funcionario_id,
      data:form.data, tipo:form.tipo,
      quantidade:parseFloat(form.quantidade)||1,
      servico:form.servico, observacao:form.observacao,
      descontada_producao:false, recebida_medicao:false,
    })
    setShowForm(false)
    setForm({ obra_id:'', funcionario_id:'', data:new Date().toISOString().slice(0,10), tipo:'CONTA_MG', quantidade:'1', servico:'', observacao:'' })
    setSalvando(false)
    setMsg('✅ Diária registrada!')
    setTimeout(() => setMsg(''), 3000)
    await carregar()
  }

  const filtradas = diarias.filter(d => {
    if (obraFiltro && d.obra_id !== obraFiltro) return false
    if (equipe && d.funcionarios?.equipe !== equipe) return false
    return true
  })

  const totalValor = filtradas.reduce((s,d) => s + (d.quantidade * (d.funcionarios?.valor_diaria||0)), 0)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1f2937', marginBottom:4 }}>Diárias Extras</h1>
          <p style={{ fontSize:13, color:'#9ca3af' }}>{filtradas.length} registros · Total: {formatR$(totalValor)}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background:'#1e3a8a', color:'white', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          + Nova Diária
        </button>
      </div>

      {msg && <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', marginBottom:12, color:'#166534', fontSize:13 }}>{msg}</div>}

      {/* Filtros */}
      <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 16px', marginBottom:16, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
        <select value={obraFiltro} onChange={e => { setObraFiltro(e.target.value); setEquipe('') }}
          style={{ border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', flex:1, minWidth:200 }}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <div style={{ display:'flex', gap:6 }}>
          {(['','ARMAÇÃO','CARPINTARIA'] as const).map(eq => (
            <button key={eq} onClick={() => setEquipe(eq)}
              style={{ padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                background: equipe===eq ? '#1e3a8a' : '#f3f4f6',
                color: equipe===eq ? 'white' : '#6b7280' }}>
              {eq || 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', background:'white', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
            <thead>
              <tr style={{ background:'#1e3a8a' }}>
                {['Data','Funcionário','Obra','Tipo','Qtd','Serviço','Desc. Prod.','Rec. Med.','Ações'].map(h => (
                  <th key={h} style={{ padding:'10px 12px', color:'white', fontSize:11, fontWeight:700, textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((d,i) => (
                <tr key={d.id} style={{ background: i%2===0?'white':'#f9fafb' }}>
                  <td style={{ padding:'10px 12px', fontSize:13, whiteSpace:'nowrap' }}>{new Date(d.data+'T12:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding:'10px 12px', fontSize:13 }}>{d.funcionarios?.nome}</td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'#6b7280' }}>{d.obras?.nome}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ fontSize:11, padding:'3px 8px', borderRadius:20, fontWeight:600,
                      background: d.tipo==='CONTA_MG'?'#eff6ff':'#fef3c7',
                      color: d.tipo==='CONTA_MG'?'#1e40af':'#92400e' }}>
                      {d.tipo==='CONTA_MG'?'Conta MG':'Conta Obra'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:13, textAlign:'center' }}>{d.quantidade}</td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'#6b7280', maxWidth:200 }}>{d.servico}</td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}>
                    <input type="checkbox" checked={d.descontada_producao} onChange={() => toggle(d.id,'descontada_producao',d.descontada_producao)} style={{ cursor:'pointer', accentColor:'#1e3a8a' }} />
                  </td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}>
                    <input type="checkbox" checked={d.recebida_medicao} onChange={() => toggle(d.id,'recebida_medicao',d.recebida_medicao)} style={{ cursor:'pointer', accentColor:'#059669' }} />
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <button onClick={() => deletar(d.id)}
                      style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #fecaca', background:'#fef2f2', color:'#dc2626', cursor:'pointer', fontSize:12 }}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={9} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhuma diária encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nova diária */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:480, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:15, fontWeight:700 }}>Nova Diária Extra</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#9ca3af' }}>×</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Obra', el: <select value={form.obra_id} onChange={e=>setForm(f=>({...f,obra_id:e.target.value}))} style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }}><option value="">Selecione...</option>{obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}</select> },
                { label:'Funcionário', el: <select value={form.funcionario_id} onChange={e=>setForm(f=>({...f,funcionario_id:e.target.value}))} style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }}><option value="">Selecione...</option>{funcs.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</select> },
                { label:'Data', el: <input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }} /> },
                { label:'Tipo', el: <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }}><option value="CONTA_MG">Conta MG</option><option value="CONTA_OBRA">Conta Obra</option></select> },
                { label:'Quantidade', el: <input type="number" value={form.quantidade} onChange={e=>setForm(f=>({...f,quantidade:e.target.value}))} style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }} step="0.5" /> },
                { label:'Serviço', el: <input value={form.servico} onChange={e=>setForm(f=>({...f,servico:e.target.value}))} style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }} placeholder="Descrição do serviço..." /> },
              ].map(({ label, el }) => (
                <div key={label}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>{label}</label>
                  {el}
                </div>
              ))}
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid #f3f4f6', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', cursor:'pointer', fontSize:13 }}>Cancelar</button>
              <button onClick={salvarNova} disabled={salvando} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#1e3a8a', color:'white', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
