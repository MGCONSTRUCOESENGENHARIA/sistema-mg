'use client'
import { useState, useMemo, useRef } from 'react'
import AppLayout from '@/components/AppLayout'
import { useStore } from '@/lib/store'
import { modelShort, situacaoMap } from '@/lib/utils'

const SITUACOES = ['ALUGADO','DISPONÍVEL','RESERVADO','À VENDA','PT/ROUBO','VENDIDO','PREPARANDO']
const PER_PAGE = 30

function fmt(v: any) {
  if (!v && v !== 0) return '—'
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function calcRenovar(fim: string | null): number | null {
  if (!fim) return null
  const today = new Date()
  today.setHours(0,0,0,0)
  const end = new Date(fim + 'T00:00:00')
  return Math.round((end.getTime() - today.getTime()) / 86400000)
}

function RenovarBadge({ renovar }: { renovar: number | null }) {
  if (renovar === null) return <span style={{ color: '#d1d5db' }}>—</span>
  if (renovar < 0) return <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{renovar}d vencido</span>
  if (renovar === 0) return <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>Vence hoje</span>
  if (renovar <= 3) return <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>+{renovar}d</span>
  if (renovar <= 7) return <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>+{renovar}d</span>
  return <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>+{renovar}d</span>
}

function SitBadge({ s }: { s: string }) {
  const m = situacaoMap[s] || { color: '#6b7280', bg: '#f3f4f6' }
  return <span style={{ background: m.bg, color: m.color, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>{s}</span>
}

// Inline editable cell
function EditCell({ value, onChange, type = 'text', options, width }: any) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  const ref = useRef<any>(null)

  function commit() {
    setEditing(false)
    if (val !== value) onChange(val)
  }

  if (editing) {
    if (options) return (
      <select autoFocus value={val} onChange={e => { setVal(e.target.value); }} onBlur={() => { onChange(val); setEditing(false) }}
        style={{ width: width||120, padding: '3px 6px', border: '2px solid #374151', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fff' }}>
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
    return (
      <input ref={ref} autoFocus type={type} value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value); setEditing(false) } }}
        style={{ width: width||100, padding: '3px 6px', border: '2px solid #374151', borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: type === 'text' ? 'inherit' : 'monospace' }}
      />
    )
  }

  return (
    <div onClick={() => { setVal(value); setEditing(true) }}
      style={{ cursor: 'text', minWidth: width||60, padding: '2px 4px', borderRadius: 4, transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      title="Clique para editar">
      {value || <span style={{ color: '#d1d5db' }}>—</span>}
    </div>
  )
}

const th = (w?: number) => ({
  fontSize: 11, fontWeight: 600, color: '#9ca3af', padding: '10px 10px',
  textAlign: 'left' as const, background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap' as const, width: w, cursor: 'pointer', userSelect: 'none' as const
})
const td = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f9fafb', verticalAlign: 'middle' as const }

export default function Frota() {
  const { veiculos, updateVeiculo } = useStore()
  const [search, setSearch] = useState('')
  const [sitFilter, setSitFilter] = useState('')
  const [renovarFilter, setRenovarFilter] = useState('')
  const [sortKey, setSortKey] = useState<string>('num')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [page, setPage] = useState(1)
  const [newRow, setNewRow] = useState(false)
  const [newV, setNewV] = useState<any>({ num:'', modelo:'', placa:'', cor:'', ano:'', situacao:'DISPONÍVEL', cliente:'', cpf:'', km_contrato:0, valor_contrato:0, caucao:'', km_excedente:0, inicio_contrato:'', periodo:0, fim_contrato:'', obs:'' })

  function upd(num: number, key: string, val: any) {
    const fields: any = { [key]: val }
    // Recalculate renovar when fim_contrato changes
    if (key === 'fim_contrato') fields.renovar = calcRenovar(val)
    if (key === 'inicio_contrato' || key === 'periodo') {
      const v = veiculos.find(x => x.num === num)
      if (v) {
        const inicio = key === 'inicio_contrato' ? val : v.inicio_contrato
        const periodo = key === 'periodo' ? parseInt(val)||0 : v.periodo
        if (inicio && periodo) {
          const fim = new Date(inicio + 'T00:00:00')
          fim.setDate(fim.getDate() + periodo)
          fields.fim_contrato = fim.toISOString().slice(0,10)
          fields.renovar = calcRenovar(fields.fim_contrato)
        }
      }
    }
    updateVeiculo(num, fields)
  }

  function toggle(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const arrow = (key: string) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ·'

  const situacaoCount: Record<string,number> = {}
  veiculos.forEach(v => { situacaoCount[v.situacao] = (situacaoCount[v.situacao]||0)+1 })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let data = veiculos.filter(v => {
      if (q && !v.placa.toLowerCase().includes(q) && !v.modelo.toLowerCase().includes(q) && !(v.cliente||'').toLowerCase().includes(q)) return false
      if (sitFilter && v.situacao !== sitFilter) return false
      if (renovarFilter === 'vencido' && !(v.renovar !== null && v.renovar < 0)) return false
      if (renovarFilter === 'hoje' && v.renovar !== 0) return false
      if (renovarFilter === '3dias' && !(v.renovar !== null && v.renovar > 0 && v.renovar <= 3)) return false
      if (renovarFilter === '7dias' && !(v.renovar !== null && v.renovar > 0 && v.renovar <= 7)) return false
      if (renovarFilter === 'ok' && !(v.renovar !== null && v.renovar > 7)) return false
      if (renovarFilter === 'sem' && v.renovar !== null) return false
      return true
    })
    data = [...data].sort((a, b) => {
      let va = (a as any)[sortKey], vb = (b as any)[sortKey]
      if (va === null || va === undefined) va = sortDir === 'asc' ? Infinity : -Infinity
      if (vb === null || vb === undefined) vb = sortDir === 'asc' ? Infinity : -Infinity
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return data
  }, [search, sitFilter, renovarFilter, sortKey, sortDir, veiculos])

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
      {/* Pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {pillConfig.map(pill => {
          const sit = situacaoMap[pill.key] || { color: '#6b7280', bg: '#f3f4f6' }
          const active = sitFilter === pill.key
          return (
            <div key={pill.key} onClick={() => { setSitFilter(s => s===pill.key?'':pill.key); setPage(1) }}
              style={{ background: active ? sit.bg : '#fff', border: `1px solid ${active ? sit.color+'60':'#e5e7eb'}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: sit.color }}>{situacaoCount[pill.key]||0}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{pill.label}</div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="🔍 Buscar placa, modelo, cliente…"
          style={{ flex: 1, minWidth: 220, padding: '9px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }} />
        <select value={sitFilter} onChange={e => { setSitFilter(e.target.value); setPage(1) }}
          style={{ padding: '9px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', cursor: 'pointer' }}>
          <option value="">Todas as situações</option>
          {SITUACOES.map(s => <option key={s} value={s}>{s} ({situacaoCount[s]||0})</option>)}
        </select>
        <select value={renovarFilter} onChange={e => { setRenovarFilter(e.target.value); setPage(1) }}
          style={{ padding: '9px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', cursor: 'pointer' }}>
          <option value="">Todos os vencimentos</option>
          <option value="vencido">⛔ Vencidos</option>
          <option value="hoje">🔴 Vence hoje</option>
          <option value="3dias">🟡 Próximos 3 dias</option>
          <option value="7dias">🟡 Próximos 7 dias</option>
          <option value="ok">🟢 Em dia (+7 dias)</option>
          <option value="sem">⚪ Sem contrato</option>
        </select>
        <button onClick={() => { setSearch(''); setSitFilter(''); setRenovarFilter(''); setSortKey('num'); setSortDir('asc'); setPage(1) }}
          style={{ padding: '9px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
          ✕ Limpar
        </button>
        <button onClick={() => setNewRow(true)}
          style={{ padding: '9px 16px', background: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 600 }}>
          + Novo veículo
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Frota de veículos</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>✏️ Clique em qualquer célula para editar</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{filtered.length} veículos</span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
            <thead>
              <tr>
                {[
                  ['num','Nº',50], ['situacao','Situação',110], ['modelo','Modelo',160],
                  ['placa','Placa',95], ['cor','Cor',80], ['ano','Ano',60],
                  ['cliente','Cliente',180], ['cpf','CPF/CNPJ',130],
                  ['valor_contrato','R$/sem',90], ['caucao','Caução',90],
                  ['km_contrato','KM Cont.',85], ['km_excedente','KM Exc.',75],
                  ['inicio_contrato','Início',105], ['periodo','Período',75],
                  ['fim_contrato','Fim',105], ['renovar','Renovar',95],
                  ['obs','Obs',160],
                ].map(([key, label, w]) => (
                  <th key={key as string} style={th(w as number)} onClick={() => toggle(key as string)}>
                    {label}{arrow(key as string)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* New row */}
              {newRow && (
                <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #16a34a' }}>
                  <td style={td}><input value={newV.num} onChange={e => setNewV({...newV, num:e.target.value})} style={{ width: 45, padding:'3px 6px', border:'1px solid #e5e7eb', borderRadius:4, fontSize:12 }} placeholder="Nº" /></td>
                  <td style={td}>
                    <select value={newV.situacao} onChange={e => setNewV({...newV, situacao:e.target.value})} style={{ padding:'3px 6px', border:'1px solid #e5e7eb', borderRadius:4, fontSize:12 }}>
                      {SITUACOES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  {['modelo','placa','cor','ano','cliente','cpf'].map(k => (
                    <td key={k} style={td}><input value={newV[k]} onChange={e => setNewV({...newV,[k]:e.target.value})} style={{ width:'100%', padding:'3px 6px', border:'1px solid #e5e7eb', borderRadius:4, fontSize:12 }} placeholder={k} /></td>
                  ))}
                  {['valor_contrato','caucao','km_contrato','km_excedente'].map(k => (
                    <td key={k} style={td}><input type="number" value={newV[k]} onChange={e => setNewV({...newV,[k]:e.target.value})} style={{ width:80, padding:'3px 6px', border:'1px solid #e5e7eb', borderRadius:4, fontSize:12 }} /></td>
                  ))}
                  <td style={td}><input type="date" value={newV.inicio_contrato} onChange={e => setNewV({...newV, inicio_contrato:e.target.value})} style={{ padding:'3px 6px', border:'1px solid #e5e7eb', borderRadius:4, fontSize:12 }} /></td>
                  <td style={td}><input type="number" value={newV.periodo} onChange={e => setNewV({...newV, periodo:e.target.value})} style={{ width:60, padding:'3px 6px', border:'1px solid #e5e7eb', borderRadius:4, fontSize:12 }} /></td>
                  <td style={td}><input type="date" value={newV.fim_contrato} onChange={e => setNewV({...newV, fim_contrato:e.target.value})} style={{ padding:'3px 6px', border:'1px solid #e5e7eb', borderRadius:4, fontSize:12 }} /></td>
                  <td style={td}><span style={{ color:'#9ca3af', fontSize:12 }}>auto</span></td>
                  <td style={td}><input value={newV.obs} onChange={e => setNewV({...newV, obs:e.target.value})} style={{ width:140, padding:'3px 6px', border:'1px solid #e5e7eb', borderRadius:4, fontSize:12 }} placeholder="obs" /></td>
                  <td style={td} colSpan={2}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => {
                        const fim = newV.fim_contrato || null
                        const renovar = calcRenovar(fim)
                        updateVeiculo(parseInt(newV.num)||0, { ...newV, num:parseInt(newV.num)||0, renovar, valor_contrato:parseFloat(newV.valor_contrato)||0, km_contrato:parseInt(newV.km_contrato)||0, km_excedente:parseFloat(newV.km_excedente)||0, periodo:parseInt(newV.periodo)||0, ano:parseInt(newV.ano)||0 })
                        setNewRow(false)
                        setNewV({ num:'',modelo:'',placa:'',cor:'',ano:'',situacao:'DISPONÍVEL',cliente:'',cpf:'',km_contrato:0,valor_contrato:0,caucao:'',km_excedente:0,inicio_contrato:'',periodo:0,fim_contrato:'',obs:'' })
                      }} style={{ padding:'4px 10px', background:'#374151', color:'#fff', border:'none', borderRadius:6, fontSize:12, cursor:'pointer' }}>✓ Salvar</button>
                      <button onClick={() => setNewRow(false)} style={{ padding:'4px 10px', background:'#fff', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:6, fontSize:12, cursor:'pointer' }}>✕</button>
                    </div>
                  </td>
                </tr>
              )}

              {slice.map((v, i) => {
                const sit = situacaoMap[v.situacao] || { color:'#6b7280', bg:'#f3f4f6' }
                const renovar = calcRenovar(v.fim_contrato)
                return (
                  <tr key={i} style={{ borderBottom:'1px solid #f9fafb' }}
                    onMouseEnter={e => (e.currentTarget.style.background='#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    <td style={{ ...td, fontFamily:'monospace', fontSize:12, color:'#9ca3af' }}>{v.num}</td>
                    <td style={td}>
                      <EditCell value={v.situacao} options={SITUACOES} width={110}
                        onChange={(val: string) => upd(v.num, 'situacao', val)} />
                    </td>
                    <td style={td}>
                      <EditCell value={modelShort(v.modelo)} width={150}
                        onChange={(val: string) => upd(v.num, 'modelo', val)} />
                    </td>
                    <td style={{ ...td, fontFamily:'monospace', fontWeight:700 }}>
                      <EditCell value={v.placa} width={88}
                        onChange={(val: string) => upd(v.num, 'placa', val.toUpperCase())} />
                    </td>
                    <td style={td}>
                      <EditCell value={v.cor} width={70}
                        onChange={(val: string) => upd(v.num, 'cor', val)} />
                    </td>
                    <td style={{ ...td, fontFamily:'monospace', fontSize:12 }}>
                      <EditCell value={String(v.ano||'')} width={55}
                        onChange={(val: string) => upd(v.num, 'ano', parseInt(val)||0)} />
                    </td>
                    <td style={td}>
                      <EditCell value={v.cliente||''} width={170}
                        onChange={(val: string) => upd(v.num, 'cliente', val)} />
                    </td>
                    <td style={{ ...td, fontFamily:'monospace', fontSize:12 }}>
                      <EditCell value={v.cpf||''} width={120}
                        onChange={(val: string) => upd(v.num, 'cpf', val)} />
                    </td>
                    <td style={td}>
                      <EditCell value={v.valor_contrato ? String(v.valor_contrato) : ''} type="number" width={80}
                        onChange={(val: string) => upd(v.num, 'valor_contrato', parseFloat(val)||0)} />
                    </td>
                    <td style={td}>
                      <EditCell value={v.caucao||''} width={80}
                        onChange={(val: string) => upd(v.num, 'caucao', val)} />
                    </td>
                    <td style={{ ...td, fontFamily:'monospace', fontSize:12 }}>
                      <EditCell value={v.km_contrato ? String(v.km_contrato) : ''} type="number" width={75}
                        onChange={(val: string) => upd(v.num, 'km_contrato', parseInt(val)||0)} />
                    </td>
                    <td style={{ ...td, fontFamily:'monospace', fontSize:12 }}>
                      <EditCell value={v.km_excedente ? String(v.km_excedente) : ''} type="number" width={65}
                        onChange={(val: string) => upd(v.num, 'km_excedente', parseFloat(val)||0)} />
                    </td>
                    <td style={{ ...td, fontFamily:'monospace', fontSize:12 }}>
                      <EditCell value={v.inicio_contrato||''} type="date" width={115}
                        onChange={(val: string) => upd(v.num, 'inicio_contrato', val)} />
                    </td>
                    <td style={{ ...td, fontFamily:'monospace', fontSize:12 }}>
                      <EditCell value={v.periodo ? String(v.periodo) : ''} type="number" width={55}
                        onChange={(val: string) => upd(v.num, 'periodo', parseInt(val)||0)} />
                    </td>
                    <td style={{ ...td, fontFamily:'monospace', fontSize:12 }}>
                      <EditCell value={v.fim_contrato||''} type="date" width={115}
                        onChange={(val: string) => upd(v.num, 'fim_contrato', val)} />
                    </td>
                    <td style={td}><RenovarBadge renovar={renovar} /></td>
                    <td style={{ ...td, fontSize:12, color: v.obs ? '#d97706' : '#d1d5db', maxWidth:160 }}>
                      <EditCell value={v.obs||''} width={150}
                        onChange={(val: string) => upd(v.num, 'obs', val)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12, color:'#9ca3af' }}>
          <span>{(p-1)*PER_PAGE+1}–{Math.min(p*PER_PAGE, filtered.length)} de {filtered.length}</span>
          <div style={{ display:'flex', gap:4 }}>
            {p > 1 && <button onClick={() => setPage(p-1)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:12, cursor:'pointer' }}>‹ Anterior</button>}
            {Array.from({length: Math.min(5, totalPages)}, (_,i) => {
              const pg = Math.max(1, Math.min(p-2, totalPages-4)) + i
              return pg <= totalPages ? <button key={pg} onClick={() => setPage(pg)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:pg===p?'#374151':'#fff', color:pg===p?'#fff':'#374151', fontSize:12, cursor:'pointer' }}>{pg}</button> : null
            })}
            {p < totalPages && <button onClick={() => setPage(p+1)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:12, cursor:'pointer' }}>Próxima ›</button>}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
