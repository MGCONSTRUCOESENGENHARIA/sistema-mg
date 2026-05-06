'use client'
import { useState, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import { useStore } from '@/lib/store'
import { fmt, fmtKm, modelShort, shortName, situacaoMap } from '@/lib/utils'

const PER_PAGE = 25
const SITUACOES = ['ALUGADO','DISPONÍVEL','RESERVADO','À VENDA','PT/ROUBO','VENDIDO','PREPARANDO']

function Badge({ text, color, bg }: any) {
  return <span style={{ background: bg, color, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>{text}</span>
}

function Field({ label, children }: any) {
  return (
    <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

function EditModal({ v, onClose, onSave }: { v: any, onClose: () => void, onSave: (fields: any) => void }) {
  const sit = situacaoMap[v.situacao] || { color: '#6b7280', bg: '#f3f4f6' }
  const [form, setForm] = useState({ ...v })
  const set = (k: string, val: any) => setForm((f: any) => ({ ...f, [k]: val }))

  const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'Inter, sans-serif', background: '#fff' }
  const labelStyle = { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4, display: 'block' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>✏️ Editar — {v.placa}</div>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', color: '#6b7280', cursor: 'pointer', width: 28, height: 28, borderRadius: 6, fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={labelStyle}>Situação</label>
              <select value={form.situacao} onChange={e => set('situacao', e.target.value)} style={inputStyle}>
                {SITUACOES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Placa</label><input value={form.placa} onChange={e => set('placa', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Modelo</label><input value={form.modelo} onChange={e => set('modelo', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Ano</label><input type="number" value={form.ano} onChange={e => set('ano', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Cor</label><input value={form.cor} onChange={e => set('cor', e.target.value)} style={inputStyle} /></div>
            <div style={{ gridColumn: '1/-1', borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>CONTRATO</div>
            </div>
            <div><label style={labelStyle}>Cliente</label><input value={form.cliente} onChange={e => set('cliente', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>CPF / CNPJ</label><input value={form.cpf} onChange={e => set('cpf', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Valor/semana (R$)</label><input type="number" value={form.valor_contrato} onChange={e => set('valor_contrato', parseFloat(e.target.value)||0)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Caução</label><input value={form.caucao} onChange={e => set('caucao', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Início contrato</label><input type="date" value={form.inicio_contrato||''} onChange={e => set('inicio_contrato', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Fim contrato</label><input type="date" value={form.fim_contrato||''} onChange={e => set('fim_contrato', e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>KM contratado</label><input type="number" value={form.km_contrato} onChange={e => set('km_contrato', parseInt(e.target.value)||0)} style={inputStyle} /></div>
            <div><label style={labelStyle}>KM excedente (R$/km)</label><input value={form.km_excedente} onChange={e => set('km_excedente', e.target.value)} style={inputStyle} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Observações</label><textarea value={form.obs} onChange={e => set('obs', e.target.value)} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 20px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
            <button onClick={() => { onSave(form); onClose() }} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: '#374151', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>💾 Salvar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const thStyle = { fontSize: 11, fontWeight: 600, color: '#9ca3af', padding: '10px 14px', textAlign: 'left' as const, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const }

export default function Frota() {
  const { veiculos, updateVeiculo } = useStore()
  const [search, setSearch] = useState('')
  const [situacao, setSituacao] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<any>(null)

  const situacaoCount: Record<string,number> = {}
  veiculos.forEach(v => { situacaoCount[v.situacao] = (situacaoCount[v.situacao]||0)+1 })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return veiculos.filter(v =>
      (!q || v.placa.toLowerCase().includes(q) || v.modelo.toLowerCase().includes(q) || (v.cliente||'').toLowerCase().includes(q)) &&
      (!situacao || v.situacao === situacao)
    )
  }, [search, situacao, veiculos])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const p = Math.min(page, totalPages)
  const slice = filtered.slice((p-1)*PER_PAGE, p*PER_PAGE)

  const pillConfig = [
    { key:'ALUGADO', label:'Alugados' }, { key:'DISPONÍVEL', label:'Disponíveis' },
    { key:'RESERVADO', label:'Reservados' }, { key:'À VENDA', label:'À Venda' },
    { key:'PT/ROUBO', label:'PT/Roubo' }, { key:'VENDIDO', label:'Vendidos' },
  ]

  return (
    <AppLayout>
      {editing && <EditModal v={editing} onClose={() => setEditing(null)} onSave={fields => updateVeiculo(editing.num, fields)} />}

      {/* Pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
        {pillConfig.map(pill => {
          const sit = situacaoMap[pill.key] || { color: '#6b7280', bg: '#f3f4f6' }
          const active = situacao === pill.key
          return (
            <div key={pill.key} onClick={() => { setSituacao(s => s===pill.key ? '' : pill.key); setPage(1) }}
              style={{ background: active ? sit.bg : '#fff', border: `1px solid ${active ? sit.color+'60' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: sit.color }}>{situacaoCount[pill.key]||0}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{pill.label}</div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar placa, modelo ou cliente…"
          style={{ flex: 1, padding: '9px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 13, outline: 'none' }} />
        <select value={situacao} onChange={e => { setSituacao(e.target.value); setPage(1) }}
          style={{ padding: '9px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
          <option value="">Todas as situações</option>
          {SITUACOES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Frota de veículos</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{filtered.length} veículos</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Nº','Modelo','Placa','Ano','Situação','Cliente','R$/sem','Início','Fim','Renovar','Obs',''].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr></thead>
            <tbody>
              {slice.map((v, i) => {
                const sit = situacaoMap[v.situacao] || { color: '#6b7280', bg: '#f3f4f6' }
                const renovarDias = v.renovar
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' }}>{v.num}</td>
                    <td style={{ padding: '9px 14px', fontSize: 13, color: '#374151' }}>{modelShort(v.modelo)}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#111827' }}>{v.placa}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{v.ano}</td>
                    <td style={{ padding: '9px 14px' }}><Badge text={v.situacao} color={sit.color} bg={sit.bg} /></td>
                    <td style={{ padding: '9px 14px', fontSize: 13, color: '#374151' }}>{shortName(v.cliente) || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ padding: '9px 14px', fontSize: 13, color: '#374151' }}>{v.valor_contrato ? fmt(v.valor_contrato) : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{v.inicio_contrato || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{v.fim_contrato || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ padding: '9px 14px' }}>
                      {renovarDias > 0
                        ? <Badge text={`+${renovarDias}d`} color="#4b5563" bg="#f3f4f6" />
                        : renovarDias < -1000 ? <span style={{ color: '#d1d5db' }}>—</span>
                        : <Badge text="Vencido" color="#dc2626" bg="#fee2e2" />}
                    </td>
                    <td style={{ padding: '9px 14px', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: v.obs ? '#d97706' : '#d1d5db' }}>{v.obs || '—'}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <button onClick={() => setEditing(v)}
                        style={{ padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
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
