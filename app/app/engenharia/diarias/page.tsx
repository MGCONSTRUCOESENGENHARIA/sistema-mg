'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'

interface DiáriaExtra {
  id: string; obra_id: string; funcionario_id: string
  data: string; tipo: string; quantidade: number; valor_diaria: number
  servico: string; descontada_producao: boolean; recebida_medicao: boolean; observacao: string
  obras?: any; funcionarios?: any
}

export default function DiariasExtrasPage() {
  const [obras, setObras] = useState<any[]>([])
  const [diarias, setDiarias] = useState<DiáriaExtra[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [obraFiltro, setObraFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'TODOS' | 'CONTA_MG' | 'CONTA_OBRA'>('TODOS')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ obra_id: '', funcionario_id: '', data: new Date().toISOString().slice(0,10), tipo: 'CONTA_MG', quantidade: '1', servico: '', observacao: '' })
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: os }, { data: ds }, { data: fs }] = await Promise.all([
      supabase.from('obras').select('id,nome,codigo').eq('status','ATIVA').order('nome'),
      supabase.from('diarias_extras').select('*, obras(nome,codigo), funcionarios(nome,valor_diaria)').order('data', { ascending: false }),
      supabase.from('funcionarios').select('id,nome,equipe').eq('ativo',true).order('nome'),
    ])
    setObras(os || [])
    setDiarias(ds || [])
    setFuncs(fs || [])
    setLoading(false)
  }

  async function salvarNova() {
    if (!form.obra_id || !form.funcionario_id || !form.data) return
    setSalvando(true)
    await supabase.from('diarias_extras').insert({
      obra_id: form.obra_id, funcionario_id: form.funcionario_id,
      data: form.data, tipo: form.tipo,
      quantidade: parseFloat(form.quantidade) || 1,
      servico: form.servico, observacao: form.observacao,
      descontada_producao: false, recebida_medicao: false,
    })
    setShowForm(false)
    setForm({ obra_id: '', funcionario_id: '', data: new Date().toISOString().slice(0,10), tipo: 'CONTA_MG', quantidade: '1', servico: '', observacao: '' })
    await carregar()
    setSalvando(false)
    setMsg('✅ Diária extra registrada!')
    setTimeout(() => setMsg(''), 3000)
  }

  async function toggleStatus(id: string, field: 'descontada_producao' | 'recebida_medicao', val: boolean) {
    await supabase.from('diarias_extras').update({ [field]: !val }).eq('id', id)
    await carregar()
  }

  async function remover(id: string) {
    if (!confirm('Remover este lançamento?')) return
    await supabase.from('diarias_extras').delete().eq('id', id)
    await carregar()
  }

  const filtradas = diarias.filter(d => {
    if (obraFiltro && d.obra_id !== obraFiltro) return false
    if (tipoFiltro !== 'TODOS' && d.tipo !== tipoFiltro) return false
    return true
  })

  // Agrupar por obra
  const porObra: Record<string, DiáriaExtra[]> = {}
  filtradas.forEach(d => {
    const obraId = d.obra_id
    if (!porObra[obraId]) porObra[obraId] = []
    porObra[obraId].push(d)
  })

  const corTipo = { CONTA_MG: { bg: '#eff6ff', color: '#1e40af', label: 'Conta MG' }, CONTA_OBRA: { bg: '#fef3c7', color: '#92400e', label: 'Conta Obra' } }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>Diárias Extras</h1>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>Diárias por conta da MG e por conta da Obra — desconto na produção e cobrança na medição</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          + Novo Lançamento
        </button>
      </div>

      {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 14, color: '#166534', fontSize: 13 }}>{msg}</div>}

      {/* Modal novo */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 500 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>Nova Diária Extra</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>×</button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Tipo */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Tipo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['CONTA_MG', 'CONTA_OBRA'] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${form.tipo === t ? corTipo[t].color : '#e5e7eb'}`, background: form.tipo === t ? corTipo[t].bg : 'white', color: form.tipo === t ? corTipo[t].color : '#9ca3af', cursor: 'pointer', fontSize: 13, fontWeight: form.tipo === t ? 700 : 400 }}>
                      {t === 'CONTA_MG' ? '🏢 Conta MG' : '🏗 Conta Obra'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Obra *</label>
                  <select value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}>
                    <option value="">Selecione...</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data *</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Funcionário *</label>
                <select value={form.funcionario_id} onChange={e => setForm(f => ({ ...f, funcionario_id: e.target.value }))}
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}>
                  <option value="">Selecione...</option>
                  <optgroup label="ARMAÇÃO">{funcs.filter(f => f.equipe === 'ARMAÇÃO').map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</optgroup>
                  <optgroup label="CARPINTARIA">{funcs.filter(f => f.equipe === 'CARPINTARIA').map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</optgroup>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Quantidade</label>
                  <input type="number" step="0.5" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Serviço executado</label>
                  <input value={form.servico} onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
                    placeholder="Ex: Pilares, vigas..."
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Observação</label>
                <input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={salvarNova} disabled={salvando} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1e3a8a', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {salvando ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}
          style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', minWidth: 200 }}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['TODOS', 'CONTA_MG', 'CONTA_OBRA'] as const).map(t => (
            <button key={t} onClick={() => setTipoFiltro(t)}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                borderColor: tipoFiltro === t ? '#1e3a8a' : '#e5e7eb',
                background: tipoFiltro === t ? '#1e3a8a' : 'white',
                color: tipoFiltro === t ? 'white' : '#6b7280' }}>
              {t === 'TODOS' ? 'Todos' : t === 'CONTA_MG' ? '🏢 Conta MG' : '🏗 Conta Obra'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{filtradas.length} lançamentos</span>
      </div>

      {/* Lista por obra */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : Object.keys(porObra).length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Nenhuma diária extra registrada. Use o Lançamento Rápido ou clique em "+ Novo Lançamento".</p>
        </div>
      ) : Object.entries(porObra).map(([obraId, items]) => {
        const obraInfo = (items[0].obras as any)
        const totalMG = items.filter(d => d.tipo === 'CONTA_MG').length
        const totalObra = items.filter(d => d.tipo === 'CONTA_OBRA').length
        return (
          <div key={obraId} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            {/* Header obra */}
            <div style={{ background: '#1e3a8a', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{obraInfo?.nome}</span>
                <span style={{ color: '#93c5fd', fontSize: 11, marginLeft: 8 }}>{obraInfo?.codigo}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {totalMG > 0 && <span style={{ background: '#eff6ff', color: '#1e40af', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>🏢 MG: {totalMG}</span>}
                {totalObra > 0 && <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>🏗 Obra: {totalObra}</span>}
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Data', 'Funcionário', 'Tipo', 'Qtd', 'Serviço', 'Desc. Produção', 'Receb. Medição', ''].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((d, fi) => {
                  const cor = corTipo[d.tipo as keyof typeof corTipo]
                  return (
                    <tr key={d.id} style={{ background: fi % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 14px', fontSize: 13 }}>{new Date(d.data + 'T12:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{(d.funcionarios as any)?.nome}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ background: cor?.bg, color: cor?.color, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>{cor?.label}</span>
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 700, color: '#1e3a8a' }}>{d.quantidade}</td>
                      <td style={{ padding: '8px 14px', fontSize: 12, color: '#6b7280' }}>{d.servico || '—'}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        <button onClick={() => toggleStatus(d.id, 'descontada_producao', d.descontada_producao)}
                          style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: d.descontada_producao ? '#d1fae5' : '#f3f4f6', color: d.descontada_producao ? '#065f46' : '#6b7280' }}>
                          {d.descontada_producao ? '✅ Sim' : '⬜ Não'}
                        </button>
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        {d.tipo === 'CONTA_OBRA' ? (
                          <button onClick={() => toggleStatus(d.id, 'recebida_medicao', d.recebida_medicao)}
                            style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: d.recebida_medicao ? '#d1fae5' : '#f3f4f6', color: d.recebida_medicao ? '#065f46' : '#6b7280' }}>
                            {d.recebida_medicao ? '✅ Sim' : '⬜ Não'}
                          </button>
                        ) : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        <button onClick={() => remover(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16 }}>×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
