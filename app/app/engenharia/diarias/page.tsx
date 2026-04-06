'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
  // edição inline: guarda o valor em edição por campo+id
  const [editando, setEditando] = useState<Record<string, string>>({})
  const [salvandoInline, setSalvandoInline] = useState<Record<string, boolean>>({})

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: os }, { data: ds }, { data: fs }] = await Promise.all([
      supabase.from('obras').select('id,nome,codigo').eq('status','ATIVA').order('nome'),
      supabase.from('diarias_extras').select('*, obras(nome,codigo), funcionarios(nome)').order('data', { ascending: false }),
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

  async function salvarCampo(id: string, field: string, value: any) {
    const key = `${id}_${field}`
    setSalvandoInline(p => ({ ...p, [key]: true }))
    await supabase.from('diarias_extras').update({ [field]: value }).eq('id', id)
    setSalvandoInline(p => ({ ...p, [key]: false }))
    setEditando(p => { const n = { ...p }; delete n[key]; return n })
    await carregar()
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

  const porObra: Record<string, DiáriaExtra[]> = {}
  filtradas.forEach(d => {
    if (!porObra[d.obra_id]) porObra[d.obra_id] = []
    porObra[d.obra_id].push(d)
  })

  const corTipo = {
    CONTA_MG:   { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', label: '🏢 Conta MG' },
    CONTA_OBRA: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: '🏗 Conta Obra' },
  }

  // totais para o header
  const totalMGGeral = filtradas.filter(d => d.tipo === 'CONTA_MG').length
  const totalObraGeral = filtradas.filter(d => d.tipo === 'CONTA_OBRA').length

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>Diárias Extras</h1>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>Diárias por conta da MG e por conta da Obra — desconto na produção e cobrança na medição</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          + Novo Lançamento
        </button>
      </div>

      {msg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 14, color: '#166534', fontSize: 13 }}>
          {msg}
        </div>
      )}

      {/* Cards resumo */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total lançamentos', val: filtradas.length, color: '#1e3a8a', bg: '#eff6ff' },
          { label: 'Conta MG', val: totalMGGeral, color: '#1e40af', bg: '#dbeafe' },
          { label: 'Conta Obra', val: totalObraGeral, color: '#92400e', bg: '#fef3c7' },
          { label: 'Pendentes desconto', val: filtradas.filter(d => !d.descontada_producao).length, color: '#dc2626', bg: '#fef2f2' },
        ].map((c, i) => (
          <div key={i} style={{ background: c.bg, border: `1px solid ${c.color}33`, borderRadius: 10, padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.val}</span>
            <span style={{ fontSize: 11, color: c.color, opacity: .8 }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Modal novo lançamento */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937' }}>Nova Diária Extra</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Tipo *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['CONTA_MG', 'CONTA_OBRA'] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t }))}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: `2px solid ${form.tipo === t ? corTipo[t].border : '#e5e7eb'}`, background: form.tipo === t ? corTipo[t].bg : 'white', color: form.tipo === t ? corTipo[t].color : '#9ca3af', cursor: 'pointer', fontSize: 13, fontWeight: form.tipo === t ? 700 : 400, transition: 'all .15s' }}>
                      {corTipo[t].label}
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
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Quantidade</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 0.5].map(v => (
                      <button key={v} onClick={() => setForm(f => ({ ...f, quantidade: String(v) }))}
                        style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${form.quantidade === String(v) ? '#1e3a8a' : '#e5e7eb'}`, background: form.quantidade === String(v) ? '#eff6ff' : 'white', color: form.quantidade === String(v) ? '#1e3a8a' : '#9ca3af', cursor: 'pointer', fontSize: 13, fontWeight: form.quantidade === String(v) ? 700 : 400 }}>
                        {v === 1 ? '1' : '½'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Serviço executado</label>
                  <input value={form.servico} onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
                    placeholder="Ex: Descarga de aço, pilares..."
                    style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Observação</label>
                <input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                  placeholder="Opcional..."
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={salvarNova} disabled={salvando || !form.obra_id || !form.funcionario_id}
                style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#1e3a8a', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: (!form.obra_id || !form.funcionario_id) ? .5 : 1 }}>
                {salvando ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}
          style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', minWidth: 200 }}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['TODOS', 'CONTA_MG', 'CONTA_OBRA'] as const).map(t => (
            <button key={t} onClick={() => setTipoFiltro(t)}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all .15s',
                borderColor: tipoFiltro === t ? '#1e3a8a' : '#e5e7eb',
                background: tipoFiltro === t ? '#1e3a8a' : 'white',
                color: tipoFiltro === t ? 'white' : '#6b7280' }}>
              {t === 'TODOS' ? 'Todos' : corTipo[t].label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{filtradas.length} lançamento{filtradas.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Lista agrupada por obra */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : Object.keys(porObra).length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 56, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
          <p style={{ color: '#9ca3af', fontSize: 14, fontWeight: 500 }}>Nenhuma diária extra registrada.</p>
          <p style={{ color: '#d1d5db', fontSize: 12, marginTop: 4 }}>Use o Lançamento Rápido ou clique em "+ Novo Lançamento".</p>
        </div>
      ) : Object.entries(porObra).map(([obraId, items]) => {
        const obraInfo = items[0].obras as any
        const mgItems = items.filter(d => d.tipo === 'CONTA_MG')
        const obraItems = items.filter(d => d.tipo === 'CONTA_OBRA')
        const pendDesc = items.filter(d => !d.descontada_producao).length

        return (
          <div key={obraId} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 18, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
            {/* Header da obra */}
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>{obraInfo?.nome}</div>
                {obraInfo?.codigo && <div style={{ color: '#93c5fd', fontSize: 11, marginTop: 2 }}>{obraInfo.codigo}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {mgItems.length > 0 && (
                  <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                    🏢 MG: {mgItems.length}
                  </span>
                )}
                {obraItems.length > 0 && (
                  <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                    🏗 Obra: {obraItems.length}
                  </span>
                )}
                {pendDesc > 0 && (
                  <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                    ⚠️ {pendDesc} pendente{pendDesc !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Tabela */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                    {['Data', 'Funcionário', 'Tipo', 'Qtd', 'Serviço Executado', 'Desc. Produção', 'Receb. Medição', ''].map((h, i) => (
                      <th key={i} style={{
                        padding: '9px 14px',
                        textAlign: i >= 5 ? 'center' : 'left',
                        fontSize: 11, fontWeight: 700, color: '#6b7280',
                        textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap',
                        width: i === 0 ? 90 : i === 1 ? 180 : i === 2 ? 120 : i === 3 ? 80 : i === 4 ? '100%' : i === 7 ? 40 : 130,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((d, fi) => {
                    const cor = corTipo[d.tipo as keyof typeof corTipo]
                    const keyQtd = `${d.id}_quantidade`
                    const keySvc = `${d.id}_servico`
                    return (
                      <tr key={d.id} style={{ background: fi % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9', transition: 'background .1s' }}>
                        {/* Data */}
                        <td style={{ padding: '10px 14px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {new Date(d.data + 'T12:00').toLocaleDateString('pt-BR')}
                        </td>
                        {/* Funcionário */}
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                          {(d.funcionarios as any)?.nome}
                        </td>
                        {/* Tipo */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: cor?.bg, color: cor?.color, border: `1px solid ${cor?.border}`, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                            {cor?.label}
                          </span>
                        </td>
                        {/* Qtd editável */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[1, 0.5].map(v => (
                              <button
                                key={v}
                                onClick={async () => {
                                  if (d.quantidade !== v) await salvarCampo(d.id, 'quantidade', v)
                                }}
                                style={{
                                  width: 36, height: 28,
                                  borderRadius: 6,
                                  border: `2px solid ${d.quantidade === v ? '#1e3a8a' : '#e5e7eb'}`,
                                  background: d.quantidade === v ? '#eff6ff' : 'white',
                                  color: d.quantidade === v ? '#1e3a8a' : '#9ca3af',
                                  cursor: 'pointer', fontSize: 12, fontWeight: d.quantidade === v ? 700 : 400,
                                  transition: 'all .1s',
                                  opacity: salvandoInline[keyQtd] ? .5 : 1,
                                }}>
                                {v === 1 ? '1' : '½'}
                              </button>
                            ))}
                          </div>
                        </td>
                        {/* Serviço editável */}
                        <td style={{ padding: '10px 14px', minWidth: 320 }}>
                          <input
                            type="text"
                            value={editando[keySvc] !== undefined ? editando[keySvc] : (d.servico || '')}
                            placeholder="Descreva o serviço..."
                            onChange={e => setEditando(p => ({ ...p, [keySvc]: e.target.value }))}
                            onBlur={async e => {
                              const novo = e.target.value
                              if (novo !== (d.servico || '')) await salvarCampo(d.id, 'servico', novo)
                              else setEditando(p => { const n = { ...p }; delete n[keySvc]; return n })
                            }}
                            onFocus={e => setEditando(p => ({ ...p, [keySvc]: d.servico || '' }))}
                            style={{
                              width: '100%',
                              border: editando[keySvc] !== undefined ? '1.5px solid #3b82f6' : '1.5px solid transparent',
                              borderRadius: 6, padding: '5px 8px', fontSize: 12,
                              outline: 'none', background: editando[keySvc] !== undefined ? 'white' : 'transparent',
                              color: d.servico ? '#1f2937' : '#9ca3af',
                              transition: 'all .15s', cursor: 'text',
                            }}
                          />
                        </td>
                        {/* Desc. Produção */}
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleStatus(d.id, 'descontada_producao', d.descontada_producao)}
                            style={{
                              padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                              background: d.descontada_producao ? '#d1fae5' : '#f3f4f6',
                              color: d.descontada_producao ? '#065f46' : '#6b7280',
                              transition: 'all .15s',
                            }}>
                            {d.descontada_producao ? '✅ Sim' : '⬜ Não'}
                          </button>
                        </td>
                        {/* Receb. Medição */}
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {d.tipo === 'CONTA_OBRA' ? (
                            <button
                              onClick={() => toggleStatus(d.id, 'recebida_medicao', d.recebida_medicao)}
                              style={{
                                padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                background: d.recebida_medicao ? '#d1fae5' : '#f3f4f6',
                                color: d.recebida_medicao ? '#065f46' : '#6b7280',
                                transition: 'all .15s',
                              }}>
                              {d.recebida_medicao ? '✅ Sim' : '⬜ Não'}
                            </button>
                          ) : (
                            <span style={{ color: '#d1d5db', fontSize: 13 }}>—</span>
                          )}
                        </td>
                        {/* Remover */}
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button
                            onClick={() => remover(d.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e5e7eb', fontSize: 18, lineHeight: 1, transition: 'color .15s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#e5e7eb'}>
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
