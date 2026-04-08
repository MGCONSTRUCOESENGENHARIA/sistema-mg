'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$ } from '@/lib/utils'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({ funcs: 0, obras: 0, presencas: 0, alertas: 0, totalValor: 0 })
  const [loading, setLoading] = useState(true)
  const mes = mesAtual()

  useEffect(() => {
    async function load() {
      try {
        const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
        const [{ count: f }, { count: o }] = await Promise.all([
          supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('ativo', true),
          supabase.from('obras').select('*', { count: 'exact', head: true }).eq('status', 'ATIVA'),
        ])
        let presencas: any[] = []
        if (comp?.id) {
          const { data: presData } = await supabase.from('presencas').select('fracao, fracao2, funcionario_id').eq('competencia_id', comp.id)
          presencas = presData || []
        }
        const { count: totalFOP } = await supabase.from('funcionario_obra_passagem').select('*', { count: 'exact', head: true })
        const alertas = Math.max(0, (f || 0) * (o || 0) - (totalFOP || 0))
        let totalValor = 0
        if (presencas.length > 0) {
          const ids = [...new Set(presencas.map((p: any) => p.funcionario_id))]
          const { data: funcsData } = await supabase.from('funcionarios').select('id, valor_diaria').in('id', ids)
          const diariaPorId: Record<string, number> = {}
          ;(funcsData || []).forEach((f: any) => { diariaPorId[f.id] = f.valor_diaria || 0 })
          presencas.forEach((p: any) => { totalValor += ((p.fracao || 0) + (p.fracao2 || 0)) * (diariaPorId[p.funcionario_id] || 0) })
        }
        setStats({ funcs: f || 0, obras: o || 0, presencas: presencas.length, alertas, totalValor })
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const statCards = [
    { label: 'Funcionários ativos', val: stats.funcs, icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z', color: '#7c3aed', bg: '#ede9fe' },
    { label: 'Obras ativas', val: stats.obras, icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10', color: '#0891b2', bg: '#e0f2fe' },
    { label: 'Lançamentos no mês', val: stats.presencas, icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', color: '#059669', bg: '#d1fae5' },
    { label: 'Passagens faltando', val: stats.alertas, icon: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', color: stats.alertas > 0 ? '#dc2626' : '#059669', bg: stats.alertas > 0 ? '#fee2e2' : '#d1fae5' },
  ]

  const fluxo = [
    { n: 1, label: 'Abrir mês', desc: 'Criar competência', href: '/app/competencias', color: '#7c3aed' },
    { n: 2, label: 'Matriz passagens', desc: 'Antes de lançar', href: '/app/passagens', color: '#4f46e5' },
    { n: 3, label: 'Lançar presenças', desc: 'Apontamento diário', href: '/app/presenca', color: '#0891b2' },
    { n: 4, label: 'Registrar avulsos', desc: 'Vales e descontos', href: '/app/avulsos', color: '#059669' },
    { n: 5, label: 'Adiantamento', desc: 'Dia 20 · 1ª quinzena', href: '/app/adiantamento', color: '#d97706' },
    { n: 6, label: 'Passagem & Café', desc: 'Transportes e café', href: '/app/passagem-cafe', color: '#dc2626' },
    { n: 7, label: 'Pagamento final', desc: 'Dia 05 · fechamento', href: '/app/pagamento', color: '#7c3aed' },
    { n: 8, label: 'Rateio por obra', desc: 'Custo distribuído', href: '/app/rateio', color: '#4f46e5' },
    { n: 9, label: 'Fechar mês', desc: 'Trava edições', href: '/app/competencias', color: '#6b7280' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#1f2937', marginBottom:4 }}>Olá, bem-vindo! 👋</h1>
        <p style={{ fontSize:14, color:'#9ca3af' }}>{nomeMes(mes)} {mes.split('-')[0]} · Acompanhe o resumo do mês</p>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        {statCards.map((s, i) => (
          <div key={i} style={{ background:'white', borderRadius:14, border:'1px solid #f3f4f6', padding:'20px 22px', display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={s.icon}/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:28, fontWeight:800, color:'#1f2937', lineHeight:1 }}>{loading ? '—' : s.val}</div>
              <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Total diárias */}
      {!loading && stats.totalValor > 0 && (
        <div style={{ background:'linear-gradient(135deg,#7c3aed,#4f46e5)', borderRadius:14, padding:'20px 24px', marginBottom:28, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.7)', marginBottom:4 }}>Total em diárias lançadas em {nomeMes(mes)}</div>
            <div style={{ fontSize:32, fontWeight:800, color:'white' }}>{formatR$(stats.totalValor)}</div>
          </div>
          <Link href="/app/relatorios">
            <div style={{ background:'rgba(255,255,255,.2)', color:'white', borderRadius:10, padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              Ver relatório →
            </div>
          </Link>
        </div>
      )}

      {/* Fluxo do mês */}
      <div style={{ background:'white', borderRadius:14, border:'1px solid #f3f4f6', padding:'24px' }}>
        <div style={{ marginBottom:20 }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:'#1f2937', marginBottom:4 }}>Fluxo do mês</h2>
          <p style={{ fontSize:13, color:'#9ca3af' }}>Siga essa ordem para processar o mês corretamente</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {fluxo.map(f => (
            <Link key={f.n} href={f.href}>
              <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:10, border:'1px solid #f3f4f6', cursor:'pointer', transition:'all .15s', background:'white' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#ede9fe'; (e.currentTarget as HTMLElement).style.background = '#faf9ff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#f3f4f6'; (e.currentTarget as HTMLElement).style.background = 'white' }}>
                <div style={{ width:32, height:32, borderRadius:8, background:f.color+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:13, fontWeight:800, color:f.color }}>{f.n}</span>
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{f.label}</div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>{f.desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
