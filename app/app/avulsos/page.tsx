'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'

type Tipo = 'Vale' | 'Adiantamento' | 'Empréstimo' | 'Desconto'
type Quando = 'adiantamento' | 'pagamento_final'

interface Desconto {
  id: string; funcionario_id: string; tipo: string; valor_total: number
  observacao: string; data_lancamento: string; funcionarios?: any
  parcelas?: Parcela[]
}
interface Parcela {
  id: string; desconto_id: string; numero: number; valor: number
  quando: string; mes_ano: string; descontado: boolean; obs?: string
}
interface Func { id: string; nome: string; equipe: string }

const TIPOS: Tipo[] = ['Vale', 'Adiantamento', 'Empréstimo', 'Desconto']
const COR: Record<string, { bg: string; color: string; border: string }> = {
  'Vale':        { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  'Adiantamento':{ bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  'Empréstimo':  { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'Desconto':    { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' },
}

function meses() {
  const result = []
  const now = new Date()
  for (let i = -1; i <= 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  return result
}

function nomeMes(m: string) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  return new Date(+y, +mo-1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function AvulsosPage() {
  const [funcs, setFuncs] = useState<Func[]>([])
  const [descontos, setDescontos] = useState<Desconto[]>([])
  const [loading, setLoading] = useState(true)
  const [tipoAtivo, setTipoAtivo] = useState<Tipo | 'Todos'>('Todos')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  // Form
  const [form, setForm] = useState({
    funcionario_id: '', tipo: 'Vale' as Tipo,
    valor_total: '', num_parcelas: '1',
    observacao: '', data_lancamento: new Date().toISOString().slice(0,10),
  })
  const [parcelas, setParcelas] = useState([
    { quando: 'pagamento_final', mes_ano: new Date().toISOString().slice(0,7), obs: '' }
  ])

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: fs }, { data: ds }] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,equipe').eq('ativo', true).order('nome'),
      supabase.from('avulsos').select('id,funcionario_id,tipo,valor,valor_total,observacao,data_lancamento,funcionarios(nome,equipe)').order('criado_em', { ascending: false }),
    ])
    const ids = (ds || []).map((d: any) => d.id)
    let parcMap: Record<string, Parcela[]> = {}
    if (ids.length) {
      const { data: ps } = await supabase.from('avulso_parcelas').select('*').in('desconto_id', ids).order('numero')
      ;(ps || []).forEach((p: any) => {
        if (!parcMap[p.desconto_id]) parcMap[p.desconto_id] = []
        parcMap[p.desconto_id].push(p)
      })
    }
    setFuncs(fs || [])
    setDescontos((ds || []).map((d: any) => ({
      ...d,
      valor_total: d.valor_total || d.valor || 0,
      funcionarios: d.funcionarios || fs?.find((f: any) => f.id === d.funcionario_id),
      parcelas: parcMap[d.id] || []
    })))
    setLoading(false)
  }

  function atualizarParcelas(numStr: string, valorStr: string) {
    const num = parseInt(numStr) || 1
    const valor = parseFloat(valorStr) || 0
    const valParcela = num > 0 ? (valor / num).toFixed(2) : '0'
    const mesBase = new Date()
    const novas = Array.from({ length: num }, (_, i) => {
      const d = new Date(mesBase.getFullYear(), mesBase.getMonth() + i, 1)
      return {
        quando: 'pagamento_final',
        mes_ano: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
        obs: '',
        valor: valParcela,
      }
    })
    setParcelas(novas as any)
  }

  async function salvar() {
    if (!form.funcionario_id || !form.valor_total) {
      setMsg('⚠️ Preencha funcionário e valor.'); setTimeout(() => setMsg(''), 3000); return
    }
    setSalvando(true)
    const mes = form.data_lancamento.slice(0, 7)
    let { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status: 'ABERTA' }).select().single()
      comp = nova
    }
    const tipoDb = form.tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const { error, data: descArr } = await supabase.from('avulsos').insert({
      competencia_id: comp!.id,
      funcionario_id: form.funcionario_id,
      tipo: form.tipo,
      data: form.data_lancamento,
      valor: parseFloat(form.valor_total),
      valor_total: parseFloat(form.valor_total),
      observacao: form.observacao,
      data_lancamento: form.data_lancamento,
    }).select('id')
    if (error || !descArr?.length) {
      setMsg('⚠️ Erro ao salvar: ' + error?.message)
      setSalvando(false); return
    }
    const descId = descArr[0].id
    for (let i = 0; i < parcelas.length; i++) {
      const p = parcelas[i] as any
      await supabase.from('avulso_parcelas').insert({
        desconto_id: descId, numero: i + 1,
        valor: parseFloat(p.valor) || parseFloat(form.valor_total) / parcelas.length,
        quando: p.quando, mes_ano: p.mes_ano, descontado: false, obs: p.obs || '',
      })
    }
    setMsg('✅ Desconto salvo!')
    setTimeout(() => setMsg(''), 3000)
    setShowForm(false)
    setForm({ funcionario_id: '', tipo: 'Vale', valor_total: '', num_parcelas: '1', observacao: '', data_lancamento: new Date().toISOString().slice(0,10) })
    setParcelas([{ quando: 'pagamento_final', mes_ano: new Date().toISOString().slice(0,7), obs: '' }])
    await carregar()
    setSalvando(false)
  }

  async function toggleDescontado(parcId: string, val: boolean) {
    await supabase.from('avulso_parcelas').update({ descontado: !val }).eq('id', parcId)
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este desconto e todas as parcelas?')) return
    await supabase.from('avulso_parcelas').delete().eq('desconto_id', id)
    await supabase.from('avulsos').delete().eq('id', id)
    await carregar()
  }

  const tiposFiltrados = tipoAtivo === 'Todos' ? TIPOS : [tipoAtivo]
  const totalPendente = descontos.reduce((s, d) => s + (d.parcelas?.filter(p => !p.descontado).reduce((a, p) => a + (p.valor||0), 0) || 0), 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1f2937', marginBottom:4 }}>Descontos e Vales</h1>
          <p style={{ fontSize:13, color:'#9ca3af' }}>Total pendente: <strong style={{ color:'#dc2626' }}>{formatR$(totalPendente)}</strong></p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background:'#7c3aed', color:'white', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          + Novo Desconto
        </button>
      </div>

      {msg && <div style={{ background:msg.includes('✅')?'#f0fdf4':'#fffbeb', border:`1px solid ${msg.includes('✅')?'#bbf7d0':'#fde68a'}`, borderRadius:10, padding:'10px 16px', marginBottom:14, fontSize:13, color:msg.includes('✅')?'#166534':'#92400e' }}>{msg}</div>}

      {/* Abas de tipo */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {(['Todos', ...TIPOS] as const).map(t => {
          const cor = t !== 'Todos' ? COR[t] : null
          const ativo = tipoAtivo === t
          return (
            <button key={t} onClick={() => setTipoAtivo(t as any)}
              style={{ padding:'8px 18px', borderRadius:20, border:`1.5px solid ${ativo && cor ? cor.border : ativo ? '#7c3aed' : '#e5e7eb'}`, background:ativo && cor ? cor.bg : ativo ? '#f5f3ff' : 'white', color:ativo && cor ? cor.color : ativo ? '#7c3aed' : '#6b7280', cursor:'pointer', fontSize:13, fontWeight:ativo?700:400 }}>
              {t}
            </button>
          )
        })}
      </div>

      {/* Lista por tipo → funcionário */}
      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>Carregando...</div>
      ) : tiposFiltrados.map(tipo => {
        const descsDoTipo = descontos.filter(d => d.tipo === tipo)
        if (descsDoTipo.length === 0) return null

        // Agrupar por funcionário
        const porFunc: Record<string, Desconto[]> = {}
        descsDoTipo.forEach(d => {
          if (!porFunc[d.funcionario_id]) porFunc[d.funcionario_id] = []
          porFunc[d.funcionario_id].push(d)
        })
        const cor = COR[tipo]
        const totalTipo = descsDoTipo.reduce((s, d) => s + (d.parcelas?.filter(p => !p.descontado).reduce((a, p) => a + (p.valor||0), 0) || 0), 0)

        return (
          <div key={tipo} style={{ marginBottom:20 }}>
            {/* Header do tipo */}
            <div style={{ background: cor.bg, border:`1px solid ${cor.border}`, borderRadius:'12px 12px 0 0', padding:'12px 18px', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontWeight:800, fontSize:16, color:cor.color }}>{tipo}</span>
              <span style={{ fontSize:12, color:cor.color, opacity:.7 }}>{Object.keys(porFunc).length} funcionário(s)</span>
              <span style={{ marginLeft:'auto', fontWeight:700, color:cor.color }}>{formatR$(totalTipo)} pendente</span>
            </div>

            {/* Funcionários */}
            <div style={{ border:`1px solid ${cor.border}`, borderTop:'none', borderRadius:'0 0 12px 12px', overflow:'hidden' }}>
              {Object.entries(porFunc).map(([funcId, items], fi) => {
                const funcInfo = (items[0].funcionarios as any) || funcs.find(f => f.id === funcId)
                const pendente = items.reduce((s, d) => s + (d.parcelas?.filter(p => !p.descontado).reduce((a, p) => a + (p.valor||0), 0) || 0), 0)
                const chave = `${tipo}-${funcId}`
                const isOpen = expandido === chave
                const totalDescs = items.reduce((s, d) => s + (d.parcelas?.length || 0), 0)
                const descontadas = items.reduce((s, d) => s + (d.parcelas?.filter(p => p.descontado).length || 0), 0)

                return (
                  <div key={funcId} style={{ borderBottom: fi < Object.keys(porFunc).length-1 ? `1px solid ${cor.border}` : 'none' }}>
                    {/* Row funcionário */}
                    <div onClick={() => setExpandido(isOpen ? null : chave)}
                      style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', background:isOpen?'#fafafa':'white', transition:'background .1s' }}>
                      <div style={{ flex:1 }}>
                        <span style={{ fontWeight:700, fontSize:14, color:'#1f2937' }}>{funcInfo?.nome || '—'}</span>
                        <span style={{ fontSize:11, color:funcInfo?.equipe==='ARMAÇÃO'?'#7c3aed':'#0891b2', marginLeft:8, fontWeight:600 }}>{funcInfo?.equipe}</span>
                      </div>
                      <span style={{ fontSize:12, color:'#9ca3af' }}>{descontadas}/{totalDescs} descontadas</span>
                      {pendente > 0 && <span style={{ background:'#fee2e2', color:'#dc2626', fontSize:12, fontWeight:700, padding:'3px 12px', borderRadius:20 }}>{formatR$(pendente)}</span>}
                      <span style={{ color:'#9ca3af', fontSize:16 }}>{isOpen?'▲':'▼'}</span>
                    </div>

                    {/* Parcelas expandidas */}
                    {isOpen && (
                      <div style={{ background:'#f9fafb', borderTop:`1px solid ${cor.border}` }}>
                        {items.map((d, di) => (
                          <div key={d.id} style={{ padding:'12px 18px', borderBottom: di < items.length-1 ? '1px solid #f3f4f6' : 'none' }}>
                            {/* Info do desconto */}
                            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                              <span style={{ fontWeight:700, color:'#1f2937', fontSize:13 }}>{formatR$(d.valor_total)}</span>
                              {d.observacao && <span style={{ fontSize:12, color:'#6b7280' }}>— {d.observacao}</span>}
                              <span style={{ fontSize:11, color:'#9ca3af', marginLeft:'auto' }}>
                                {d.data_lancamento ? new Date(d.data_lancamento+'T12:00').toLocaleDateString('pt-BR') : ''}
                              </span>
                              <button onClick={() => excluir(d.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:16, padding:0 }}>×</button>
                            </div>
                            {/* Parcelas */}
                            {d.parcelas?.map((p, pi) => (
                              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', background:p.descontado?'#f0fdf4':'#fffbeb', borderRadius:8, marginBottom:4, border:`1px solid ${p.descontado?'#bbf7d0':'#fde68a'}` }}>
                                <span style={{ fontSize:11, color:'#9ca3af', minWidth:60 }}>Parcela {p.numero}/{d.parcelas?.length}</span>
                                <span style={{ background:p.quando==='adiantamento'?'#eff6ff':'#f5f3ff', color:p.quando==='adiantamento'?'#1e40af':'#6d28d9', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>
                                  {p.quando==='adiantamento'?'Adiantamento':'Pgto Final'}
                                </span>
                                <span style={{ fontSize:11, color:'#6b7280' }}>{nomeMes(p.mes_ano)}</span>
                                {p.obs && <span style={{ fontSize:11, color:'#9ca3af' }}>{p.obs}</span>}
                                <span style={{ marginLeft:'auto', fontWeight:700, fontSize:13, color:p.descontado?'#059669':'#dc2626' }}>{formatR$(p.valor)}</span>
                                <button onClick={() => toggleDescontado(p.id, p.descontado)}
                                  style={{ padding:'4px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, background:p.descontado?'#d1fae5':'#fee2e2', color:p.descontado?'#065f46':'#dc2626', whiteSpace:'nowrap' }}>
                                  {p.descontado?'✅ Descontado':'⏳ Pendente'}
                                </button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {!loading && descontos.length === 0 && (
        <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:48, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>💰</div>
          <p style={{ color:'#9ca3af' }}>Nenhum desconto cadastrado.</p>
        </div>
      )}

      {/* Modal novo desconto */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}>
          <div style={{ background:'white', borderRadius:16, width:'100%', maxWidth:560, maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:15, fontWeight:700, color:'#1f2937' }}>Novo Desconto</h2>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#9ca3af' }}>×</button>
            </div>
            <div style={{ padding:22, display:'flex', flexDirection:'column', gap:14 }}>

              {/* Funcionário */}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Funcionário *</label>
                <select value={form.funcionario_id} onChange={e => setForm(f => ({...f, funcionario_id:e.target.value}))}
                  style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }}>
                  <option value="">Selecione...</option>
                  <optgroup label="ARMAÇÃO">{funcs.filter(f=>f.equipe==='ARMAÇÃO').map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</optgroup>
                  <optgroup label="CARPINTARIA">{funcs.filter(f=>f.equipe==='CARPINTARIA').map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}</optgroup>
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:6 }}>Tipo *</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {TIPOS.map(t => {
                    const cor = COR[t]
                    const ativo = form.tipo === t
                    return (
                      <button key={t} onClick={() => setForm(f => ({...f, tipo:t}))}
                        style={{ padding:'7px 16px', borderRadius:8, border:`1.5px solid ${ativo?cor.border:'#e5e7eb'}`, background:ativo?cor.bg:'white', color:ativo?cor.color:'#9ca3af', cursor:'pointer', fontSize:13, fontWeight:ativo?700:400 }}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Valor + parcelas */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Valor Total (R$) *</label>
                  <input type="number" step="0.01" value={form.valor_total}
                    onChange={e => { setForm(f=>({...f,valor_total:e.target.value})); atualizarParcelas(form.num_parcelas, e.target.value) }}
                    style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Nº de Parcelas</label>
                  <input type="number" min="1" max="24" value={form.num_parcelas}
                    onChange={e => { setForm(f=>({...f,num_parcelas:e.target.value})); atualizarParcelas(e.target.value, form.valor_total) }}
                    style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Data</label>
                  <input type="date" value={form.data_lancamento} onChange={e => setForm(f=>({...f,data_lancamento:e.target.value}))}
                    style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }} />
                </div>
              </div>

              {/* Observação */}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#6b7280', display:'block', marginBottom:4 }}>Observação</label>
                <input value={form.observacao} onChange={e => setForm(f=>({...f,observacao:e.target.value}))}
                  placeholder="Ex: Vale pago dia 01/04..."
                  style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'8px 10px', fontSize:13, outline:'none' }} />
              </div>

              {/* Parcelas geradas */}
              {parcelas.length > 0 && (
                <div>
                  <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:8 }}>Parcelas geradas automaticamente</label>
                  {parcelas.map((p: any, i) => (
                    <div key={i} style={{ background:'#f9fafb', borderRadius:8, padding:'10px 12px', marginBottom:6, border:'1px solid #e5e7eb', display:'grid', gridTemplateColumns:'auto 1fr 1fr auto', gap:8, alignItems:'center' }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#7c3aed' }}>#{i+1}</span>
                      <div>
                        <label style={{ fontSize:10, color:'#9ca3af', display:'block', marginBottom:2 }}>Descontar em</label>
                        <select value={p.quando} onChange={e => setParcelas(prev => prev.map((x,j) => j===i?{...x,quando:e.target.value}:x))}
                          style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:6, padding:'5px 6px', fontSize:11, outline:'none' }}>
                          <option value="adiantamento">Adiantamento</option>
                          <option value="pagamento_final">Pagamento Final</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize:10, color:'#9ca3af', display:'block', marginBottom:2 }}>Mês</label>
                        <select value={p.mes_ano} onChange={e => setParcelas(prev => prev.map((x,j) => j===i?{...x,mes_ano:e.target.value}:x))}
                          style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:6, padding:'5px 6px', fontSize:11, outline:'none' }}>
                          {meses().map(m => <option key={m} value={m}>{nomeMes(m)}</option>)}
                        </select>
                      </div>
                      <span style={{ fontWeight:700, color:'#1f2937', fontSize:13, whiteSpace:'nowrap' }}>{formatR$(parseFloat(p.valor)||0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid #f3f4f6', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', color:'#6b7280', cursor:'pointer', fontSize:13 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#7c3aed', color:'white', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
