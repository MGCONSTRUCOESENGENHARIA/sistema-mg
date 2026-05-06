'use client'
import { useState, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import { useStore } from '@/lib/store'
import { fmtKm, modelShort, kmInfo } from '@/lib/utils'

const PER_PAGE = 30

function EditModal({ k, onClose, onSave }: { k: any, onClose: () => void, onSave: (f: any) => void }) {
  const [form, setForm] = useState({ ...k })
  const set = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }))
  const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'Inter, sans-serif', background: '#fff' }
  const labelStyle = { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4, display: 'block' }
  const info = kmInfo(form.km_atual)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>✏️ Editar KM — {k.placa}</div>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', color: '#6b7280', cursor: 'pointer', width: 28, height: 28, borderRadius: 6, fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ background: info.bg, borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: info.color }}>{fmtKm(form.km_atual)}</div>
            <div>
              <div style={{ fontSize: 12, color: info.color, fontWeight: 600 }}>{info.label}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{modelShort(k.modelo)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>KM atual</label>
              <input type="number" value={form.km_atual} onChange={e => set('km_atual', parseInt(e.target.value)||0)} style={{ ...inputStyle, fontSize: 16, fontWeight: 600, color: info.color }} />
            </div>
            <div><label style={labelStyle}>Data do último KM</label><input type="date" value={form.data_km||''} onChange={e => set('data_km', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Data próximo KM</label><input type="date" value={form.proximo_km||''} onChange={e => set('proximo_km', e.target.value)} style={inputStyle} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Observações</label>
              <input value={form.obs||''} onChange={e => set('obs', e.target.value)} placeholder="Ex: SOLICITADO, aguardando peça..." style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 20px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button onClick={() => { onSave(form); onClose() }}
              style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: '#374151', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>💾 Salvar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const thStyle = { fontSize: 11, fontWeight: 600, color: '#9ca3af', padding: '10px 14px', textAlign: 'left' as const, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const }

export default function Km() {
  const { kmData, updateKm } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<any>(null)

  const maxKm = Math.max(...kmData.map(k => k.km_atual))
  const alto = kmData.filter(k => k.km_atual >= 150000).length
  const medio = kmData.filter(k => k.km_atual >= 80000 && k.km_atual < 150000).length
  const baixo = kmData.filter(k => k.km_atual < 80000).length

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let data = kmData.filter(k => !q || k.placa.toLowerCase().includes(q) || k.modelo.toLowerCase().includes(q))
    if (filter === 'alto') data = data.filter(k => k.km_atual >= 150000)
    else if (filter === 'medio') data = data.filter(k => k.km_atual >= 80000 && k.km_atual < 150000)
    else if (filter === 'baixo') data = data.filter(k => k.km_atual < 80000)
    else if (filter === 'obs') data = data.filter(k => k.obs)
    return [...data].sort((a, b) => b.km_atual - a.km_atual)
  }, [search, filter, kmData])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const p = Math.min(page, totalPages)
  const slice = filtered.slice((p-1)*PER_PAGE, p*PER_PAGE)

  // Vehicles with upcoming revision
  const hoje = new Date().toISOString().slice(0,10)
  const proximosRevisao = kmData.filter(k => k.proximo_km && k.proximo_km >= hoje).sort((a,b) => a.proximo_km!.localeCompare(b.proximo_km!)).slice(0,5)

  return (
    <AppLayout>
      {editing && <EditModal k={editing} onClose={() => setEditing(null)} onSave={fields => updateKm(editing.num, fields)} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { icon: '🔴', value: String(alto), label: 'KM alto (150k+)', sub: 'atenção necessária', bg: '#fee2e2', color: '#dc2626', filter: 'alto' },
          { icon: '🟡', value: String(medio), label: 'KM médio (80–150k)', sub: 'monitorar', bg: '#fef3c7', color: '#d97706', filter: 'medio' },
          { icon: '🟢', value: String(baixo), label: 'KM baixo (até 80k)', sub: 'situação normal', bg: '#dcfce7', color: '#16a34a', filter: 'baixo' },
        ].map((s, i) => (
          <div key={i} onClick={() => { setFilter(f => f===s.filter ? '' : s.filter); setPage(1) }}
            style={{ background: '#fff', borderRadius: 10, padding: 18, border: `1px solid ${filter===s.filter ? s.color+'50' : '#e5e7eb'}`, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 500, marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Proximas revisões */}
      {proximosRevisao.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>🔧 Próximas revisões agendadas</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {proximosRevisao.map((k, i) => (
              <div key={i} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{k.placa}</div>
                <div style={{ fontSize: 11, color: '#16a34a' }}>📅 {k.proximo_km}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{modelShort(k.modelo)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar por placa ou modelo…"
          style={{ flex: 1, padding: '9px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 13, outline: 'none' }} />
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }}
          style={{ padding: '9px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
          <option value="">Todos</option>
          <option value="alto">Alto (150k+)</option>
          <option value="medio">Médio (80k–150k)</option>
          <option value="baixo">Baixo (até 80k)</option>
          <option value="obs">Com observação</option>
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Controle de quilometragem</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{filtered.length} veículos</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Nº','Modelo','Placa','KM Atual','Nível','Último KM','Próximo KM','Obs',''].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {slice.map((k, i) => {
              const info = kmInfo(k.km_atual)
              const pct = Math.round((k.km_atual / maxKm) * 100)
              const proximoPassado = k.proximo_km && k.proximo_km < hoje
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' }}>{k.num}</td>
                  <td style={{ padding: '9px 14px', fontSize: 13, color: '#374151' }}>{modelShort(k.modelo)}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#111827' }}>{k.placa}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: info.color }}>{fmtKm(k.km_atual)}</td>
                  <td style={{ padding: '9px 14px', minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: info.color, borderRadius: 3 }} />
                      </div>
                      <span style={{ background: info.bg, color: info.color, padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, flexShrink: 0 }}>{info.label}</span>
                    </div>
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{k.data_km || '—'}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: proximoPassado ? '#dc2626' : '#16a34a', fontWeight: k.proximo_km ? 600 : 400 }}>
                    {k.proximo_km ? (proximoPassado ? '⚠ '+k.proximo_km : '📅 '+k.proximo_km) : '—'}
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: 12, color: k.obs ? '#d97706' : '#d1d5db', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.obs || '—'}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <button onClick={() => setEditing(k)}
                      style={{ padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
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
