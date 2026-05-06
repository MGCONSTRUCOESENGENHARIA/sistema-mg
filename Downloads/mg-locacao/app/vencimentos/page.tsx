'use client'
import { useState, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import { useStore } from '@/lib/store'
import { fmt, shortName } from '@/lib/utils'

const PER_PAGE = 30

function DiasBadge({ dias }: { dias: number }) {
  if (dias < 0) return <span style={{ background: '#fee2e2', color: '#dc2626', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{dias}d</span>
  if (dias === 0) return <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>Hoje</span>
  if (dias <= 3) return <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>+{dias}d</span>
  return <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>+{dias}d</span>
}

function EditModal({ v, onClose, onSave }: { v: any, onClose: () => void, onSave: (f: any) => void }) {
  const [form, setForm] = useState({ ...v })
  const set = (k: string, val: any) => setForm((f: any) => ({ ...f, [k]: val }))
  const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'Inter, sans-serif', background: '#fff' }
  const labelStyle = { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4, display: 'block' }

  // Recalculate dynamically
  const multa = form.multa || 0
  const juros = form.juros || 0
  const atualizado = form.valor + multa + juros
  const devido = atualizado - (form.pago || 0)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>✏️ Editar cobrança — {v.placa}</div>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', color: '#6b7280', cursor: 'pointer', width: 28, height: 28, borderRadius: 6, fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{v.cliente}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{v.modelo} · {v.placa}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Data anterior</label><input type="date" value={form.anterior||''} onChange={e => set('anterior', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Prazo (dias)</label><input type="number" value={form.prazo} onChange={e => set('prazo', parseInt(e.target.value)||7)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Vencimento</label><input type="date" value={form.vencimento||''} onChange={e => set('vencimento', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Dias (negativo = atrasado)</label><input type="number" value={form.dias} onChange={e => set('dias', parseInt(e.target.value)||0)} style={inputStyle} /></div>

            <div style={{ gridColumn: '1/-1', borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>VALORES</div>
            </div>

            <div><label style={labelStyle}>Valor base (R$)</label><input type="number" value={form.valor} onChange={e => set('valor', parseFloat(e.target.value)||0)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Multa (R$)</label><input type="number" value={form.multa} onChange={e => set('multa', parseFloat(e.target.value)||0)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Juros (R$)</label><input type="number" value={form.juros} onChange={e => set('juros', parseFloat(e.target.value)||0)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Pago (R$)</label><input type="number" value={form.pago} onChange={e => set('pago', parseFloat(e.target.value)||0)} style={{ ...inputStyle, borderColor: '#16a34a' }} /></div>

            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Observação de cobrança</label>
              <input value={form.obs_cobranca||''} onChange={e => set('obs_cobranca', e.target.value)} placeholder="Ex: cobrar sexta, aguardando depósito..." style={inputStyle} />
            </div>
          </div>

          {/* Preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16, background: '#f9fafb', borderRadius: 8, padding: 14 }}>
            <div><div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, marginBottom: 3 }}>Atualizado</div><div style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>{fmt(atualizado)}</div></div>
            <div><div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, marginBottom: 3 }}>Pago</div><div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>{fmt(form.pago)}</div></div>
            <div><div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, marginBottom: 3 }}>Devido</div><div style={{ fontSize: 16, fontWeight: 700, color: devido > 0 ? '#dc2626' : '#16a34a' }}>{fmt(devido)}</div></div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 20px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button onClick={() => { onSave({ ...form, atualizado, devido }); onClose() }}
              style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: '#374151', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>💾 Salvar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const thStyle = { fontSize: 11, fontWeight: 600, color: '#9ca3af', padding: '10px 14px', textAlign: 'left' as const, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const }

export default function Vencimentos() {
  const { vencimentos, updateVencimento } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<any>(null)

  const atrasados = vencimentos.filter(v => v.dias < 0)
  const hoje = vencimentos.filter(v => v.dias === 0)
  const totalDevido = vencimentos.reduce((s, v) => s + (v.devido > 0 ? v.devido : 0), 0)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let data = vencimentos.filter(v => !q || v.placa.toLowerCase().includes(q) || (v.cliente||'').toLowerCase().includes(q))
    if (filter === 'atrasado') data = data.filter(v => v.dias < 0)
    else if (filter === 'hoje') data = data.filter(v => v.dias === 0)
    else if (filter === 'proximos') data = data.filter(v => v.dias > 0 && v.dias <= 7)
    else if (filter === 'ok') data = data.filter(v => v.dias > 7)
    return [...data].sort((a, b) => a.dias - b.dias)
  }, [search, filter, vencimentos])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const p = Math.min(page, totalPages)
  const slice = filtered.slice((p-1)*PER_PAGE, p*PER_PAGE)

  return (
    <AppLayout>
      {editing && <EditModal v={editing} onClose={() => setEditing(null)} onSave={fields => updateVencimento(editing.num, fields)} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 26 }}>
        {[
          { icon: '🔴', value: String(atrasados.length), label: 'Em atraso', sub: fmt(atrasados.reduce((s,v)=>s+(v.devido>0?v.devido:0),0))+' em aberto', bg: '#fee2e2', color: '#dc2626' },
          { icon: '🟡', value: String(hoje.length), label: 'Vencem hoje', sub: fmt(hoje.reduce((s,v)=>s+v.valor,0))+' a cobrar', bg: '#fef3c7', color: '#d97706' },
          { icon: '💳', value: fmt(totalDevido), label: 'Total devido', sub: 'saldo em aberto', bg: '#f3f4f6', color: '#374151' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e5e7eb', display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 500, marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar por placa ou cliente…"
          style={{ flex: 1, padding: '9px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 13, outline: 'none' }} />
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }}
          style={{ padding: '9px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
          <option value="">Todos</option>
          <option value="atrasado">Atrasados</option>
          <option value="hoje">Vencem hoje</option>
          <option value="proximos">Próximos 7 dias</option>
          <option value="ok">Em dia</option>
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Controle de vencimentos</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{filtered.length} contratos</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Nº','Placa','Cliente','Vencimento','Dias','Valor','Multa','Juros','Atualizado','Pago','Devido','Obs',''].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {slice.map((v, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' }}>{v.num}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#111827' }}>{v.placa}</td>
                  <td style={{ padding: '9px 14px', fontSize: 13, color: '#374151' }}>{shortName(v.cliente)}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{v.vencimento||'—'}</td>
                  <td style={{ padding: '9px 14px' }}><DiasBadge dias={v.dias} /></td>
                  <td style={{ padding: '9px 14px', fontSize: 13, color: '#374151' }}>{fmt(v.valor)}</td>
                  <td style={{ padding: '9px 14px', fontSize: 13, color: v.multa > 0 ? '#dc2626' : '#d1d5db' }}>{v.multa ? fmt(v.multa) : '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: 13, color: v.juros > 0 ? '#d97706' : '#d1d5db' }}>{v.juros ? fmt(v.juros) : '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: 13, color: '#374151' }}>{fmt(v.atualizado)}</td>
                  <td style={{ padding: '9px 14px', fontSize: 13, color: v.pago > 0 ? '#16a34a' : '#d1d5db' }}>{v.pago ? fmt(v.pago) : '—'}</td>
                  <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: v.devido > 0 ? '#dc2626' : '#16a34a' }}>{fmt(v.devido)}</td>
                  <td style={{ padding: '9px 14px', fontSize: 12, color: '#d97706', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.obs_cobranca || ''}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <button onClick={() => setEditing(v)}
                      style={{ padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#9ca3af' }}>
          <span>{(p-1)*PER_PAGE+1}–{Math.min(p*PER_PAGE, filtered.length)} de {filtered.length}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {p > 1 && <button onClick={() => setPage(p-1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>‹</button>}
            {Array.from({length: Math.min(5, totalPages)}, (_,i) => { const pg=Math.max(1,Math.min(p-2,totalPages-4))+i; return pg<=totalPages ? <button key={pg} onClick={() => setPage(pg)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: pg===p ? '#374151' : '#fff', color: pg===p ? '#fff' : '#374151', fontSize: 12, cursor: 'pointer' }}>{pg}</button> : null })}
            {p < totalPages && <button onClick={() => setPage(p+1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>›</button>}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
