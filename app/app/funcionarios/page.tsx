'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'

interface Func {
  id: string; nome: string; equipe: string; funcao: string
  valor_diaria: number; salario_base: number; ativo: boolean
  empresa: string; telefone?: string
}

const EMPRESAS: Record<string, { cor: string; bg: string; sigla: string }> = {
  'MG Construções e Aço Ltda':        { cor: '#1e40af', bg: '#dbeafe', sigla: 'AÇO' },
  'MG Construções e Formas Ltda':     { cor: '#6d28d9', bg: '#ede9fe', sigla: 'FORMAS' },
  'MG Construções e Engenharia Ltda': { cor: '#065f46', bg: '#d1fae5', sigla: 'ENG' },
  'NÃO REGISTRADO':                   { cor: '#92400e', bg: '#fef3c7', sigla: 'N/R' },
}

export default function FuncionariosPage() {
  const [funcs, setFuncs] = useState<Func[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [equipe, setEquipe] = useState<'TODOS'|'ARMAÇÃO'|'CARPINTARIA'>('TODOS')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [ordemDiaria, setOrdemDiaria] = useState<''|'asc'|'desc'>('')
  const [modal, setModal] = useState<Func | null>(null)
  const [novoForm, setNovoForm] = useState(false)
  const [form, setForm] = useState({ nome:'', equipe:'ARMAÇÃO', funcao:'', valor_diaria:'', salario_base:'', empresa:'', telefone:'' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('funcionarios').select('*').eq('ativo', true).order('nome')
    setFuncs(data || [])
    setLoading(false)
  }

  async function salvarNovo() {
    if (!form.nome || !form.equipe) return
    setSalvando(true)
    await supabase.from('funcionarios').insert({
      nome: form.nome.toUpperCase(), equipe: form.equipe,
      funcao: form.funcao, valor_diaria: parseFloat(form.valor_diaria)||0,
      salario_base: parseFloat(form.salario_base)||0,
      empresa: form.empresa || 'NÃO REGISTRADO',
      telefone: form.telefone, ativo: true,
    })
    setMsg('✅ Funcionário cadastrado!')
    setTimeout(() => setMsg(''), 3000)
    setNovoForm(false)
    setForm({ nome:'', equipe:'ARMAÇÃO', funcao:'', valor_diaria:'', salario_base:'', empresa:'', telefone:'' })
    await carregar()
    setSalvando(false)
  }

  async function salvarEdicao() {
    if (!modal) return
    setSalvando(true)
    await supabase.from('funcionarios').update({
      nome: modal.nome, funcao: modal.funcao,
      valor_diaria: modal.valor_diaria, salario_base: modal.salario_base,
      empresa: modal.empresa,
    }).eq('id', modal.id)
    setModal(null)
    await carregar()
    setSalvando(false)
  }

  async function inativar(id: string) {
    if (!confirm('Inativar este funcionário?')) return
    await supabase.from('funcionarios').update({ ativo: false }).eq('id', id)
    await carregar()
  }

  // Filtrar e ordenar
  let lista = funcs.filter(f => {
    if (equipe !== 'TODOS' && f.equipe !== equipe) return false
    if (empresaFiltro && f.empresa !== empresaFiltro) return false
    if (busca && !f.nome.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })
  if (ordemDiaria === 'asc') lista = [...lista].sort((a,b) => a.valor_diaria - b.valor_diaria)
  if (ordemDiaria === 'desc') lista = [...lista].sort((a,b) => b.valor_diaria - a.valor_diaria)

  const totalArm = funcs.filter(f => f.equipe === 'ARMAÇÃO').length
  const totalCarp = funcs.filter(f => f.equipe === 'CARPINTARIA').length

  const btnEq = (eq: typeof equipe) => ({
    padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: equipe === eq ? '#7c3aed' : '#f3f4f6',
    color: equipe === eq ? 'white' : '#6b7280',
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1f2937', marginBottom:4 }}>Funcionários</h1>
          <p style={{ fontSize:13, color:'#9ca3af' }}>{totalArm} armação · {totalCarp} carpintaria · {funcs.length} total</p>
        </div>
        <button onClick={() => setNovoForm(true)}
          style={{ background:'#7c3aed', color:'white', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          + Novo Funcionário
        </button>
      </div>

      {msg && <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'10px 16px', marginBottom:14, color:'#166534', fontSize:13 }}>{msg}</div>}

      {/* Filtros */}
      <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 18px', marginBottom:16 }}>
        {/* Busca */}
        <div style={{ position:'relative', marginBottom:12 }}>
          <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Buscar pelo nome..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 12px 8px 36px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
        </div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          {/* Equipe */}
          <div style={{ display:'flex', gap:4 }}>
            {(['TODOS','ARMAÇÃO','CARPINTARIA'] as const).map(eq => (
              <button key={eq} style={btnEq(eq)} onClick={() => setEquipe(eq)}>{eq === 'TODOS' ? 'Todos' : eq}</button>
            ))}
          </div>

          {/* Empresa */}
          <select value={empresaFiltro} onChange={e => setEmpresaFiltro(e.target.value)}
            style={{ border:'1.5px solid #e5e7eb', borderRadius:8, padding:'6px 10px', fontSize:13, color:'#374151', outline:'none' }}>
            <option value="">Todas as empresas</option>
            {Object.keys(EMPRESAS).map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          {/* Ordem diária */}
          <select value={ordemDiaria} onChange={e => setOrdemDiaria(e.target.value as any)}
            style={{ border:'1.5px solid #e5e7eb', borderRadius:8, padding:'6px 10px', fontSize:13, color:'#374151', outline:'none' }}>
            <option value="">Ordenar por diária</option>
            <option value="desc">Maior diária primeiro</option>
            <option value="asc">Menor diária primeiro</option>
          </select>

          <span style={{ marginLeft:'auto', fontSize:12, color:'#9ca3af' }}>{lista.length} funcionários</span>
        </div>
      </div>

      {/* Tabela */}
      <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'2px solid #f3f4f6' }}>
              {['Nome','Empresa','Equipe','Função','Diária','Salário Base','Status','Ações'].map((h,i) => (
                <th key={i} style={{ padding:'12px 16px', textAlign: i >= 4 && i <= 5 ? 'right' : i === 6 || i === 7 ? 'center' : 'left', fontSize:12, fontWeight:700, color:'#7c3aed', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding:48, textAlign:'center', color:'#9ca3af' }}>Carregando...</td></tr>
            ) : lista.map((f, fi) => {
              const emp = EMPRESAS[f.empresa] || EMPRESAS['NÃO REGISTRADO']
              return (
                <tr key={f.id} style={{ borderBottom:'1px solid #f9fafb', transition:'background .1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='#fafafa'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='white'}>
                  <td style={{ padding:'12px 16px', fontWeight:600, color:'#1f2937', fontSize:13 }}>{f.nome}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ background: emp.bg, color: emp.cor, fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, whiteSpace:'nowrap' }}>
                      {emp.sigla}
                    </span>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ color: f.equipe==='ARMAÇÃO'?'#7c3aed':'#0891b2', fontSize:12, fontWeight:600 }}>{f.equipe}</span>
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:'#6b7280' }}>{f.funcao || '—'}</td>
                  <td style={{ padding:'12px 16px', textAlign:'right', fontWeight:600, fontSize:13, color:'#1f2937' }}>{formatR$(f.valor_diaria)}</td>
                  <td style={{ padding:'12px 16px', textAlign:'right', fontSize:13, color:'#6b7280' }}>{formatR$(f.salario_base)}</td>
                  <td style={{ padding:'12px 16px', textAlign:'center' }}>
                    <span style={{ background:'#d1fae5', color:'#065f46', fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20 }}>Ativo</span>
                  </td>
                  <td style={{ padding:'12px 16px', textAlign:'center' }}>
                    <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
                      <button onClick={() => setModal({...f})}
                        style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #e5e7eb', background:'white', color:'#374151', cursor:'pointer', fontSize:12, fontWeight:500 }}>
                        Editar
                      </button>
                      <button onClick={() => inativar(f.id)}
                        style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #fecaca', background:'white', color:'#dc2626', cursor:'pointer', fontSize:12, fontWeight:500 }}>
                        Inativar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && lista.length === 0 && (
              <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhum funcionário encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal editar */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:480, overflow:'hidden' }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:15, fontWeight:700, color:'#1f2937' }}>Editar Funcionário</h2>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:20 }}>×</button>
            </div>
            <div style={{ padding:22, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Nome', key:'nome', type:'text' },
                { label:'Função', key:'funcao', type:'text' },
                { label:'Valor da Diária (R$)', key:'valor_diaria', type:'number' },
                { label:'Salário Base (R$)', key:'salario_base', type:'number' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>{field.label}</label>
                  <input type={field.type} value={(modal as any)[field.key]} onChange={e => setModal(m => m ? {...m, [field.key]: field.type==='number' ? parseFloat(e.target.value)||0 : e.target.value} : m)}
                    style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Empresa</label>
                <select value={modal.empresa} onChange={e => setModal(m => m ? {...m, empresa: e.target.value} : m)}
                  style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }}>
                  {Object.keys(EMPRESAS).map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid #f3f4f6', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', color:'#6b7280', cursor:'pointer', fontSize:13 }}>Cancelar</button>
              <button onClick={salvarEdicao} disabled={salvando} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#7c3aed', color:'white', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo */}
      {novoForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:480, overflow:'hidden' }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:15, fontWeight:700, color:'#1f2937' }}>Novo Funcionário</h2>
              <button onClick={() => setNovoForm(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:20 }}>×</button>
            </div>
            <div style={{ padding:22, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Nome *</label>
                  <input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))}
                    style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Equipe *</label>
                  <select value={form.equipe} onChange={e => setForm(f => ({...f, equipe: e.target.value}))}
                    style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }}>
                    <option>ARMAÇÃO</option><option>CARPINTARIA</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Função</label>
                <input value={form.funcao} onChange={e => setForm(f => ({...f, funcao: e.target.value}))}
                  style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Diária (R$)</label>
                  <input type="number" value={form.valor_diaria} onChange={e => setForm(f => ({...f, valor_diaria: e.target.value}))}
                    style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Salário Base (R$)</label>
                  <input type="number" value={form.salario_base} onChange={e => setForm(f => ({...f, salario_base: e.target.value}))}
                    style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Empresa</label>
                <select value={form.empresa} onChange={e => setForm(f => ({...f, empresa: e.target.value}))}
                  style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }}>
                  <option value="">Selecione...</option>
                  {Object.keys(EMPRESAS).map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid #f3f4f6', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setNovoForm(false)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', color:'#6b7280', cursor:'pointer', fontSize:13 }}>Cancelar</button>
              <button onClick={salvarNovo} disabled={salvando} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#7c3aed', color:'white', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                {salvando ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
