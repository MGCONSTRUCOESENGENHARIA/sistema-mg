'use client'
import { useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { PECAS, PNEUS } from '@/lib/data'

function stockInfo(n: number) {
  if (n === 0) return { color: '#dc2626', bg: '#fee2e2', label: 'Zerado', urgent: true }
  if (n <= 2) return { color: '#d97706', bg: '#fef3c7', label: 'Baixo', urgent: false }
  return { color: '#16a34a', bg: '#dcfce7', label: 'Normal', urgent: false }
}

function StockCard({ item }: { item: any }) {
  const info = stockInfo(item.estoque_atual)
  return (
    <div style={{ background: '#fff', border: `1px solid ${info.urgent ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.4, marginBottom: 14, minHeight: 40 }}>{item.descricao}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 700, color: info.color, lineHeight: 1 }}>{item.estoque_atual}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Inicial: {item.estoque_inicial} un</div>
        </div>
        <span style={{ background: info.bg, color: info.color, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
          {info.urgent ? '⚠ Repor urgente' : info.label}
        </span>
      </div>
    </div>
  )
}

export default function Estoque() {
  const [tab, setTab] = useState<'pecas' | 'pneus'>('pecas')
  const items = tab === 'pecas' ? PECAS : PNEUS
  const zerado = items.filter(p => p.estoque_atual === 0).length
  const baixo = items.filter(p => p.estoque_atual > 0 && p.estoque_atual <= 2).length
  const normal = items.filter(p => p.estoque_atual > 2).length

  return (
    <AppLayout>
      {zerado > 0 && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 18px', marginBottom: 24, fontSize: 13, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 10 }}>
          ⚠️ <strong>{zerado} {tab === 'pecas' ? 'peças' : 'pneus'}</strong> com estoque zerado — reposição urgente necessária
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { icon: '🔴', value: String(zerado), label: 'Zerado', sub: 'repor urgente', bg: '#fee2e2', color: '#dc2626' },
          { icon: '🟡', value: String(baixo), label: 'Estoque baixo', sub: '1 a 2 unidades', bg: '#fef3c7', color: '#d97706' },
          { icon: '🟢', value: String(normal), label: 'Normal', sub: '3 ou mais unidades', bg: '#dcfce7', color: '#16a34a' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, padding: 20, border: '1px solid #e5e7eb', display: 'flex', gap: 14, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 500, marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: '#f3f4f6', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        {(['pecas', 'pneus'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '7px 20px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#374151' : '#9ca3af', fontFamily: 'Inter, sans-serif', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {t === 'pecas' ? '🔩 Peças' : '🛞 Pneus'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {items.map((item, i) => <StockCard key={i} item={item} />)}
      </div>
    </AppLayout>
  )
}
