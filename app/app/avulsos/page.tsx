'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'

type Tipo = 'Vale' | 'Empréstimo' | 'Desconto' | 'Adiantamento'
type Quando = 'Adiantamento' | 'pagamento_final'

interface Desconto {
  id: string; funcionario_id: string; tipo: Tipo; valor_total: number
  observacao: string; data_lancamento: string; funcionarios?: any
  parcelas?: Parcela[]
}
interface Parcela {
  id: string; desconto_id: string; numero: number; valor: number
  quando: Quando; mes_ano: string; descontado: boolean; obs?: string
}
interface Func { id: string; nome: string; equipe: string }

const TIPOS: Tipo[] = ['Vale', 'Adiantamento', 'Empréstimo', 'Desconto']
const COR_TIPO: Record<string, { bg: string; color: string; border: string; label: string }> = {
  'Vale':        { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe', label: 'Vale' },
  'Adiantamento':{ bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', label: 'Adiantamento' },
  'Empréstimo':  { bg: '#fef3c7', color: '#92400e', border: '#fde68a', label: 'Empréstimo' },
  'Desconto':    { bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8', label: 'Desconto' },
}

function meses() {
  const result = []
  const now = new Date()
  for (let i = -2; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  return result
}

function nomeMes(m: string) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo-1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function AvulsosPage() {
  const [funcs, setFuncs] = useState<Func[]>([])
  const [descontos, setDescontos] = useState<Desconto[]>([])
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<string>('Todos')
  const [funcFiltro, setFuncFiltro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)

  const [form, setForm] = useState({
    funcionario_id: '', tipo: 'Vale' as Tipo,
    valor_total: '', observacao: '', data_lancamento: new Date().toISOString().slice(0,10),
    parcelas: [{ valor: '', quando: 'pagamento_final' as Quando, mes_ano: new Date().toISOString().slice(0,7), obs: '' }]
  })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: fs }, { data: ds }] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,equipe').eq('ativo', true).order('nome'),
      supabase.from('avulsos').select('id, competencia_id, funcionario_id, data, tipo, valor, observacao, quando_descontar, valor_total, data_lancamento, funcionarios(nome, equipe)').order('criado_em', { ascending: false }),
    ])
    // Buscar parcelas
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
    setDescontos((ds || []).map((d: any) => ({ ...d, parcelas: parcMap[d.id] || [] })))
    setLoading(false)
  }

  function addParcela() {
    setForm(f => ({ ...f, parcelas: [...f.parcelas, { valor: '', quando: 'pagamento_final', mes_ano: new Date().toISOString().slice(0,7), obs: '' }] }))
  }

  function removeParcela(i: number) {
    setForm(f => ({ ...f, parcelas: f.parcelas.filter((_,j) => j !== i) }))
  }

  function updateParcela(i: number, field: string, val: string) {
    setForm(f => ({ ...f, parcelas: f.parcelas.map((p,j) => j === i ? { ...p, [field]: val } : p) }))
  }

  async function salvar() {
    if (!form.funcionario_id || !form.valor_total) { setMsg('⚠️ Preencha funcionário e valor.'); setTimeout(() => setMsg(''), 3000); return }
    setSalvando(true)
    // Buscar ou criar competência do mês atual
    const mes = form.data_lancamento.slice(0, 7)
    let { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status: 'ABERTA' }).select().single()
      comp = nova
    }

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
    if (error || !descArr?.length) { setMsg('⚠️ Erro ao salvar: ' + error?.message); setSalvando(false); return }
    const descId = descArr[0].id
    // Salvar parcelas
    for (let i = 0; i < form.parcelas.length; i++) {
      const p = form.parcelas[i]
      if (!p.valor) continue
      await supabase.from('avulso_parcelas').insert({
        desconto_id: descId, numero: i + 1,
        valor: parseFloat(p.valor), quando: p.quando,
        mes_ano: p.mes_ano, descontado: false, obs: p.obs,
      })
    }
    setMsg('✅ Desconto salvo!')
    setTimeout(() => setMsg(''), 3000)
    setShowForm(false)
    setForm({ funcionario_id: '', tipo: 'Vale', valor_total: '', observacao: '', data_lancamento: new Date().toISOString().slice(0,10), parcelas: [{ valor: '', quando: 'pagamento_final', mes_ano: new Date().toISOString().slice(0,7), obs: '' }] })
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

  // Filtrar
  const filtrados = descontos.filter(d => {
    if (abaAtiva !== 'Todos' && d.tipo !== abaAtiva) return false
    if (funcFiltro && d.funcionario_id !== funcFiltro) return false
    return true
  })

  // Agrupar por funcionário
  const porFunc: Record<string, Desconto[]> = {}
  filtrados.forEach(d => {
    const fid = d.funcionario_id
    if (!porFunc[fid]) porFunc[fid] = []
    porFunc[fid].push(d)
  })

  const totalPendente = descontos.reduce((s, d) => s + (d.parcelas?.filter(p => !p.descontado).reduce((a, p) => a + p.valor, 0) || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>Descontos e Vales</h1>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>Total pendente: <strong style={{ color: '#dc2626' }}>{formatR$(totalPendente)}</strong></p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          + Novo Desconto
        </button>
      </div>

      {msg && <div style={{ background: msg.includes('✅') ? '#f0fdf4' : '#fffbeb', border: `1px solid ${msg.includes('✅') ? '#bbf7d0' : '#fde68a'}`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 13, color: msg.includes('✅') ? '#166534' : '#92400e' }}>{msg}</div>}

      {/* Modal novo desconto */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Novo Desconto</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>×</button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Funcionário */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Funcionário *</label>
                <select value={form.funcionario_id} onChange={e => setForm(f => ({ ...f, funcionario_id: e.target.value }))}
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}>
                  <option value="">Selecione...</option>
                  <optgroup label="ARMAÇÃO">{funcs.filter(f => f.equipe === 'ARMAÇÃO').map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</optgroup>
                  <optgroup label="CARPINTARIA">{funcs.filter(f => f.equipe === 'CARPINTARIA').map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</optgroup>
                </select>
              </div>
              {/* Tipo */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Tipo *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TIPOS.map(t => {
                    const cor = COR_TIPO[t]
                    const ativo = form.tipo === t
                    return (
                      <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))}
                        style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${ativo ? cor.border : '#e5e7eb'}`, background: ativo ? cor.bg : 'white', color: ativo ? cor.color : '#9ca3af', cursor: 'pointer', fontSize: 12, fontWeight: ativo ? 700 : 400 }}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Valor e data */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Valor Total (R$) *</label>
                  <input type="number" step="0.01" value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data do lançamento</label>
                  <input type="date" value={form.data_lancamento} onChange={e => setForm(f => ({ ...f, data_lancamento: e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Observação</label>
                <input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                  placeholder="Ex: Vale pago dia 01/04..."
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
              </div>

              {/* Parcelas */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Parcelas de desconto</label>
                  <button onClick={addParcela} style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#374151' }}>+ Parcela</button>
                </div>
                {form.parcelas.map((p, i) => (
                  <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 8, border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', minWidth: 60 }}>Parcela {i+1}</span>
                      {form.parcelas.length > 1 && <button onClick={() => removeParcela(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, marginLeft: 'auto' }}>×</button>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Valor (R$)</label>
                        <input type="number" step="0.01" value={p.valor} onChange={e => updateParcela(i, 'valor', e.target.value)}
                          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', fontSize: 12, outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Descontar em</label>
                        <select value={p.quando} onChange={e => updateParcela(i, 'quando', e.target.value)}
                          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', fontSize: 12, outline: 'none' }}>
                          <option value="adiantamento">Adiantamento</option>
                          <option value="pagamento_final">Pagamento Final</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Mês</label>
                        <select value={p.mes_ano} onChange={e => updateParcela(i, 'mes_ano', e.target.value)}
                          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', fontSize: 12, outline: 'none' }}>
                          {meses().map(m => <option key={m} value={m}>{nomeMes(m)}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <input value={p.obs} onChange={e => updateParcela(i, 'obs', e.target.value)} placeholder="Obs da parcela..."
                        style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', fontSize: 11, outline: 'none' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          {(['Todos', ...TIPOS] as const).map(t => {
            const cor = t !== 'Todos' ? COR_TIPO[t as Tipo] : null
            const ativo = abaAtiva === t
            return (
              <button key={t} onClick={() => setAbaAtiva(t as any)}
                style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${ativo && cor ? cor.border : ativo ? '#7c3aed' : '#e5e7eb'}`, background: ativo && cor ? cor.bg : ativo ? '#f5f3ff' : 'white', color: ativo && cor ? cor.color : ativo ? '#7c3aed' : '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: ativo ? 700 : 400 }}>
                {t}
              </button>
            )
          })}
        </div>
        <select value={funcFiltro} onChange={e => setFuncFiltro(e.target.value)}
          style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 13, outline: 'none', minWidth: 220 }}>
          <option value="">Todos os funcionários</option>
          {funcs.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      {/* Lista por funcionário */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : Object.keys(porFunc).length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <p style={{ color: '#9ca3af' }}>Nenhum desconto cadastrado.</p>
        </div>
      ) : Object.entries(porFunc).map(([funcId, items]) => {
        const funcInfo = (items[0].funcionarios as any) || funcs.find(f => f.id === items[0].funcionario_id)
        const pendente = items.reduce((s, d) => s + (d.parcelas?.filter(p => !p.descontado).reduce((a, p) => a + p.valor, 0) || 0), 0)
        const isOpen = expandido === funcId

        return (
          <div key={funcId} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
            {/* Header funcionário */}
            <div onClick={() => setExpandido(isOpen ? null : funcId)}
              style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: isOpen ? '#fafafa' : 'white' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>{funcInfo?.nome}</span>
                <span style={{ fontSize: 12, color: funcInfo?.equipe === 'ARMAÇÃO' ? '#7c3aed' : '#0891b2', marginLeft: 8, fontWeight: 600 }}>{funcInfo?.equipe}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{items.length} desconto(s)</span>
                {pendente > 0 && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>Pendente: {formatR$(pendente)}</span>}
                <span style={{ color: '#9ca3af', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Tabela de descontos */}
            {isOpen && (
              <div style={{ borderTop: '1px solid #f3f4f6' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Data', 'Tipo', 'Observação', 'Valor Total', 'Parcelas', ''].map((h, i) => (
                        <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((d, di) => {
                      const cor = COR_TIPO[d.tipo]
                      const totalParc = d.parcelas?.reduce((s, p) => s + p.valor, 0) || 0
                      const descontadas = d.parcelas?.filter(p => p.descontado).length || 0
                      const total = d.parcelas?.length || 0
                      return (
                        <>
                          <tr key={d.id} style={{ background: di % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>{new Date(d.data_lancamento + 'T12:00').toLocaleDateString('pt-BR')}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ background: cor.bg, color: cor.color, border: `1px solid ${cor.border}`, fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20 }}>{d.tipo}</span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 13, color: '#374151' }}>{d.observacao || '—'}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1f2937', fontSize: 13 }}>{formatR$(d.valor_total)}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 12, color: descontadas === total ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                {descontadas}/{total} descontadas
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <button onClick={() => excluir(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16 }}>×</button>
                            </td>
                          </tr>
                          {/* Parcelas */}
                          {d.parcelas?.map((p, pi) => (
                            <tr key={p.id} style={{ background: p.descontado ? '#f0fdf4' : '#fffbeb', borderBottom: '1px solid #f3f4f6' }}>
                              <td colSpan={1} style={{ padding: '6px 14px 6px 28px', fontSize: 11, color: '#9ca3af' }}>└ Parcela {p.numero}</td>
                              <td style={{ padding: '6px 14px', fontSize: 11 }}>
                                <span style={{ background: p.quando === 'Adiantamento' ? '#eff6ff' : '#f5f3ff', color: p.quando === 'Adiantamento' ? '#1e40af' : '#6d28d9', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>
                                  {p.quando === 'Adiantamento' ? 'Adiantamento' : 'Pgto Final'}
                                </span>
                                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{nomeMes(p.mes_ano)}</span>
                              </td>
                              <td style={{ padding: '6px 14px', fontSize: 11, color: '#6b7280' }}>{p.obs || ''}</td>
                              <td style={{ padding: '6px 14px', fontWeight: 700, fontSize: 12, color: p.descontado ? '#059669' : '#dc2626' }}>{formatR$(p.valor)}</td>
                              <td colSpan={2} style={{ padding: '6px 14px' }}>
                                <button onClick={() => toggleDescontado(p.id, p.descontado)}
                                  style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: p.descontado ? '#d1fae5' : '#fee2e2', color: p.descontado ? '#065f46' : '#dc2626' }}>
                                  {p.descontado ? '✅ Descontado' : '⏳ Pendente'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
