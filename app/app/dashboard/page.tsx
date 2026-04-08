'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, formatR$ } from '@/lib/utils'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const hoje = new Date().toISOString().slice(0,10)
  const mes = mesAtual()
  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [
      { count: totalFuncs },
      { count: totalObras },
      { data: comp },
    ] = await Promise.all([
      supabase.from('funcionarios').select('*', { count:'exact', head:true }).eq('ativo', true),
      supabase.from('obras').select('*', { count:'exact', head:true }).eq('status', 'ATIVA'),
      supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle(),
    ])

    let presencasHoje: any[] = []
    let faltasHoje = 0
    let presentesHoje = 0
    let totalFolha = 0
    let totalAvulsos = 0
    let folhasNaoLancadas = 0

    if (comp?.id) {
      const [{ data: pres }, { data: pags }, { data: avs }] = await Promise.all([
        supabase.from('presencas').select('tipo, funcionarios(nome, equipe, valor_diaria)').eq('competencia_id', comp.id).eq('data', hoje),
        supabase.from('pagamentos').select('total_pagamento').eq('competencia_id', comp.id),
        supabase.from('avulso_parcelas').select('valor').eq('mes_ano', mes).eq('descontado', false),
      ])
      presencasHoje = pres || []
      faltasHoje = presencasHoje.filter(p => p.tipo === 'FALTA').length
      presentesHoje = presencasHoje.filter(p => p.tipo === 'NORMAL' || p.tipo === 'SABADO_EXTRA').length
      totalFolha = (pags||[]).reduce((s: number, p: any) => s + (p.total_pagamento||0), 0)
      totalAvulsos = (avs||[]).reduce((s: number, a: any) => s + (a.valor||0), 0)
    }

    // Folhas não lançadas hoje
    const { count: folhasHoje } = await supabase.from('folhas_ponto').select('*', { count:'exact', head:true }).eq('data', hoje)

    // Últimos lançamentos
    const { data: ultimos } = await supabase.from('presencas')
      .select('data, tipo, funcionarios(nome), obras:obra_id(nome)')
      .eq('data', hoje)
      .order('criado_em', { ascending: false })
      .limit(8)

    // Descontos pendentes
    const { count: descPendentes } = await supabase.from('avulso_parcelas')
      .select('*', { count:'exact', head:true })
      .eq('mes_ano', mes).eq('descontado', false)

    setStats({
      totalFuncs, totalObras,
      presentesHoje, faltasHoje,
      semMarcacao: (totalFuncs||0) - presentesHoje - faltasHoje,
      totalFolha, totalAvulsos,
      folhasHoje: folhasHoje||0,
      descPendentes: descPendentes||0,
      ultimos: ultimos||[],
    })
    setLoading(false)
  }

  const Skeleton = ({ w = '100%', h = 20 }: any) => (
    <div style={{ width:w, height:h, background:'linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)', backgroundSize:'200% 100%', borderRadius:6, animation:'shimmer 1.5s infinite' }} />
  )

  const Card = ({ label, value, sub, color, bg, icon, href }: any) => (
    <Link href={href||'#'} style={{ textDecoration:'none' }}>
      <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:20, cursor:href?'pointer':'default', transition:'all .2s', position:'relative', overflow:'hidden' }}
        onMouseEnter={e => href && ((e.currentTarget as HTMLElement).style.transform='translateY(-2px)', (e.currentTarget as HTMLElement).style.boxShadow='0 8px 24px rgba(0,0,0,.1)')}
        onMouseLeave={e => href && ((e.currentTarget as HTMLElement).style.transform='', (e.currentTarget as HTMLElement).style.boxShadow='')}>
        <div style={{ position:'absolute', right:16, top:16, width:40, height:40, borderRadius:10, background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{icon}</div>
        <div style={{ fontSize:12, color:'#9ca3af', marginBottom:6, fontWeight:500 }}>{label}</div>
        <div style={{ fontSize:28, fontWeight:800, color, lineHeight:1, marginBottom:4 }}>{loading ? <Skeleton h={32} w={80} /> : value}</div>
        {sub && <div style={{ fontSize:12, color:'#9ca3af' }}>{loading ? <Skeleton h={14} w={100} /> : sub}</div>}
      </div>
    </Link>
  )

  return (
    <div>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom:24, animation:'fadeIn .4s ease' }}>
        <h1 style={{ fontSize:24, fontWeight:800, color:'#1f2937', marginBottom:4 }}>Bom dia! 👋</h1>
        <p style={{ fontSize:14, color:'#9ca3af', textTransform:'capitalize' }}>{dataHoje}</p>
      </div>

      {/* Cards principais */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:20, animation:'fadeIn .5s ease' }}>
        <Card label="Funcionários Ativos" value={stats?.totalFuncs||0} sub="Total cadastrado" color="#1e3a8a" bg="#eff6ff" icon="👷" href="/app/funcionarios" />
        <Card label="Obras Ativas" value={stats?.totalObras||0} sub="Em andamento" color="#059669" bg="#f0fdf4" icon="🏗" href="/app/obras" />
        <Card label="Presentes Hoje" value={stats?.presentesHoje||0} sub={`${stats?.faltasHoje||0} falta(s) hoje`} color="#166534" bg="#dcfce7" icon="✅" href="/app/presenca/rapido" />
        <Card label="Sem Marcação" value={stats?.semMarcacao||0} sub="Hoje" color="#92400e" bg="#fef3c7" icon="⚠️" href="/app/presenca/rapido" />
        <Card label="Descontos Pendentes" value={stats?.descPendentes||0} sub={`${formatR$(stats?.totalAvulsos||0)} a descontar`} color="#dc2626" bg="#fef2f2" icon="💸" href="/app/avulsos" />
        <Card label="Folhas Hoje" value={stats?.folhasHoje||0} sub="Registradas" color="#7c3aed" bg="#f5f3ff" icon="📋" href="/app/folhas" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, animation:'fadeIn .6s ease' }}>
        {/* Lançamentos rápidos */}
        <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontSize:14, fontWeight:700, color:'#1f2937' }}>⚡ Acesso Rápido</h2>
          </div>
          <div style={{ padding:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { href:'/app/presenca/rapido', label:'Lançamento Rápido', icon:'✅', color:'#059669', bg:'#f0fdf4' },
              { href:'/app/presenca', label:'Grade de Presença', icon:'📊', color:'#1e3a8a', bg:'#eff6ff' },
              { href:'/app/avulsos', label:'Descontos/Vales', icon:'💰', color:'#92400e', bg:'#fef3c7' },
              { href:'/app/folhas', label:'Folhas de Ponto', icon:'📷', color:'#7c3aed', bg:'#f5f3ff' },
              { href:'/app/adiantamento', label:'Adiantamento', icon:'💵', color:'#065f46', bg:'#f0fdf4' },
              { href:'/app/pagamento', label:'Pagamento Final', icon:'💳', color:'#1e40af', bg:'#eff6ff' },
              { href:'/app/engenharia', label:'Produção', icon:'🏗', color:'#92400e', bg:'#fef3c7' },
              { href:'/app/relatorios', label:'Relatórios', icon:'📈', color:'#6d28d9', bg:'#f5f3ff' },
            ].map((item, i) => (
              <Link key={i} href={item.href} style={{ textDecoration:'none' }}>
                <div style={{ background:item.bg, borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'all .15s', display:'flex', alignItems:'center', gap:10 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform='scale(1.02)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform=''}>
                  <span style={{ fontSize:20 }}>{item.icon}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:item.color, lineHeight:1.3 }}>{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Últimos lançamentos */}
        <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontSize:14, fontWeight:700, color:'#1f2937' }}>📝 Lançamentos de Hoje</h2>
            <Link href="/app/presenca" style={{ fontSize:12, color:'#1e3a8a', textDecoration:'none', fontWeight:600 }}>Ver todos →</Link>
          </div>
          <div style={{ maxHeight:320, overflowY:'auto' }}>
            {loading ? (
              <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} h={40} />)}
              </div>
            ) : stats?.ultimos?.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                <p style={{ fontSize:13 }}>Nenhum lançamento hoje ainda</p>
                <Link href="/app/presenca/rapido">
                  <button style={{ marginTop:12, padding:'8px 16px', borderRadius:8, border:'none', background:'#1e3a8a', color:'white', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                    Lançar agora
                  </button>
                </Link>
              </div>
            ) : stats?.ultimos?.map((p: any, i: number) => (
              <div key={i} style={{ padding:'10px 18px', borderBottom:'1px solid #f9fafb', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: p.tipo==='FALTA'?'#dc2626':p.tipo==='NORMAL'?'#059669':'#9ca3af', flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{(p.funcionarios as any)?.nome}</div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>{(p.obras as any)?.nome || p.tipo}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20,
                  background: p.tipo==='FALTA'?'#fef2f2':p.tipo==='NORMAL'?'#f0fdf4':'#f9fafb',
                  color: p.tipo==='FALTA'?'#dc2626':p.tipo==='NORMAL'?'#059669':'#6b7280' }}>
                  {p.tipo==='NORMAL'?'Presente':p.tipo}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
