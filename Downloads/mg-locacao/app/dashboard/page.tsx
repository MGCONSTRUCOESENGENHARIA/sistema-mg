'use client'
import AppLayout from '@/components/AppLayout'
import { useStore } from '@/lib/store'
import { fmt, fmtKm, modelShort, shortName, kmInfo } from '@/lib/utils'
import { PECAS, PNEUS } from '@/lib/data'

const chartColors = ['#374151','#6b7280','#9ca3af','#4b5563','#1f2937','#d1d5db','#111827','#6b7280','#374151','#9ca3af']
const criticos = [...PECAS, ...PNEUS].filter((p: any) => p.estoque_atual <= 1)

export default function Dashboard() {
  const { veiculos, vencimentos, kmData } = useStore()

  const atrasados = vencimentos.filter(v => v.dias < 0).sort((a, b) => a.dias - b.dias)
  const hoje = vencimentos.filter(v => v.dias === 0)
  const proximos7 = vencimentos.filter(v => v.dias >= 0 && v.dias <= 7).sort((a, b) => a.dias - b.dias)
  const totalDevido = vencimentos.reduce((s, v) => s + (v.devido > 0 ? v.devido : 0), 0)
  const totalMensalidade = vencimentos.reduce((s, v) => s + v.valor, 0)
  const kmAlto = kmData.filter(k => k.km_atual >= 150000).sort((a, b) => b.km_atual - a.km_atual)
  const alugados = veiculos.filter(v => v.situacao === 'ALUGADO').length

  const modCount: Record<string, number> = {}
  veiculos.forEach(v => { const m = modelShort(v.modelo).split(' ')[0]; modCount[m] = (modCount[m]||0)+1 })
  const modSorted = Object.entries(modCount).sort((a,b) => b[1]-a[1]).slice(0,10)
  const maxMod = Math.max(...modSorted.map(x => x[1]))

  const dateStr = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })

  function AlertRow({ left, leftSub, right, rightColor }: any) {
    return (
      <div style={{ padding: '9px 16px', borderBottom: '1px solid #f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: '#374151', fontWeight: 500, maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{left}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{leftSub}</div>
        </div>
        <div style={{ color: rightColor, fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{right}</div>
      </div>
    )
  }

  function DiasBadge({ dias }: { dias: number }) {
    if (dias < 0) return <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{dias}d</span>
    if (dias === 0) return <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>Hoje</span>
    if (dias <= 3) return <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>+{dias}d</span>
    return <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>+{dias}d</span>
  }

  const thStyle = { fontSize: 11, fontWeight: 600, color: '#9ca3af', padding: '10px 16px', textAlign: 'left' as const, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const }

  return (
    <AppLayout>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>Olá, bem-vindo! 👋</h1>
        <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{dateStr} · Acompanhe o resumo da frota</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { icon: '🚗', value: String(alugados), label: `de ${veiculos.length} veículos cadastrados`, bg: '#f3f4f6', color: '#374151' },
          { icon: '💰', value: fmt(totalMensalidade), label: `${vencimentos.length} contratos ativos`, bg: '#dcfce7', color: '#16a34a' },
          { icon: '⚠️', value: fmt(totalDevido), label: `${atrasados.length} clientes em atraso`, bg: '#fee2e2', color: '#dc2626' },
          { icon: '📅', value: String(hoje.length), label: `Hoje · +${vencimentos.filter(v=>v.dias>0&&v.dias<=3).length} em 3 dias`, bg: '#fef3c7', color: '#d97706' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, padding: 22, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 46, height: 46, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>Alertas do dia</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
        {[
          { title: 'Cobranças em atraso', icon: '🔴', count: atrasados.length, countColor: '#dc2626', countBg: '#fee2e2',
            rows: atrasados.map((v,i) => <AlertRow key={i} left={shortName(v.cliente)} leftSub={`${v.placa} · ${v.dias}d atraso${v.obs_cobranca ? ' · '+v.obs_cobranca : ''}`} right={fmt(v.devido)} rightColor="#dc2626" />) },
          { title: 'Vencem hoje', icon: '🟡', count: hoje.length, countColor: '#d97706', countBg: '#fef3c7',
            rows: hoje.map((v,i) => <AlertRow key={i} left={shortName(v.cliente)} leftSub={v.placa} right={fmt(v.valor)} rightColor="#d97706" />) },
          { title: 'KM alto (150k+)', icon: '🔧', count: kmAlto.length, countColor: '#d97706', countBg: '#fef3c7',
            rows: kmAlto.map((k,i) => <AlertRow key={i} left={modelShort(k.modelo)} leftSub={k.placa} right={fmtKm(k.km_atual)} rightColor="#d97706" />) },
          { title: 'Estoque crítico', icon: '📦', count: criticos.length, countColor: '#dc2626', countBg: '#fee2e2',
            rows: criticos.map((p:any,i:number) => <AlertRow key={i} left={p.descricao} leftSub="" right={p.estoque_atual===0?'Zerado':`${p.estoque_atual} un`} rightColor={p.estoque_atual===0?'#dc2626':'#d97706'} />) },
        ].map((card, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}><span>{card.icon}</span>{card.title}</div>
              <span style={{ background: card.countBg, color: card.countColor, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{card.count}</span>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>{card.rows}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>Composição da frota</div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 22, marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 100, marginBottom: 8 }}>
          {modSorted.map(([label, val], i) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 10, color: '#374151', fontWeight: 600 }}>{val}</div>
              <div style={{ width: '100%', background: chartColors[i], borderRadius: '3px 3px 0 0', height: `${Math.max(6,(val/maxMod)*80)}px` }} title={`${label}: ${val}`} />
              <div style={{ fontSize: 9, color: '#9ca3af' }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
          {modSorted.map(([label, val], i) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: chartColors[i], display: 'inline-block' }} />{label} ({val})
            </span>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12, paddingBottom: 10, borderBottom: '2px solid #e5e7eb' }}>Próximos vencimentos (7 dias)</div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Contratos a vencer</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{proximos7.length} contratos</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Nº','Placa','Cliente','Vencimento','Dias','Valor','Obs','Status'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {proximos7.map((v, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' }}>{v.num}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#111827' }}>{v.placa}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>{shortName(v.cliente)}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{v.vencimento||'—'}</td>
                <td style={{ padding: '10px 16px' }}><DiasBadge dias={v.dias} /></td>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#374151' }}>{fmt(v.valor)}</td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: '#d97706' }}>{v.obs_cobranca || ''}</td>
                <td style={{ padding: '10px 16px' }}>
                  {v.dias < 0 ? <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>Atrasado</span>
                    : v.dias === 0 ? <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>Hoje</span>
                    : <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>A vencer</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
