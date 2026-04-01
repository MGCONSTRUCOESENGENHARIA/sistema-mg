'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase, Perfil } from '@/lib/supabase'
import { mesAtual, nomeMes } from '@/lib/utils'

const NAV = [
  { section: 'Principal' },
  { href: '/app/dashboard',    label: 'Dashboard',           icon: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z' },
  { href: '/app/competencias', label: 'Competências',        icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z' },
  { section: 'Cadastro' },
  { href: '/app/funcionarios', label: 'Funcionários',        icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm7.5-1a3.5 3.5 0 000-7M23 21v-2a4 4 0 00-3-3.87' },
  { href: '/app/obras',        label: 'Obras',               icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10' },
  { href: '/app/passagens',    label: 'Matriz de Passagens', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { section: 'Lançamentos' },
  { href: '/app/presenca',     label: 'Presença',            icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11' },
  { href: '/app/avulsos',      label: 'Avulsos / Vales',     icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  { section: 'Financeiro' },
  { href: '/app/adiantamento', label: 'Adiantamento',        icon: 'M2 7h20M2 11h20M2 15h10M16 17h6M19 14v6' },
  { href: '/app/passagem-cafe',label: 'Passagem & Café',     icon: 'M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm11 0a2.5 2.5 0 100-5 2.5 2.5 0 000 5z' },
  { href: '/app/pagamento',    label: 'Pagamento Final',     icon: 'M1 4h22v16H1zM1 10h22' },
  { href: '/app/rateio',       label: 'Rateio por Obra',     icon: 'M18 20V10M12 20V4M6 20v-6' },
  { section: 'Análise' },
  { href: '/app/relatorios',   label: 'Relatórios',          icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  { href: '/app/historico',    label: 'Histórico',           icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [compAtiva, setCompAtiva] = useState(mesAtual())
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('perfis').select('*').eq('id', user.id).single()
        .then(({ data }) => { setPerfil(data); setLoading(false) })
    })
  }, [])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const paginaAtual = NAV.find(n => 'href' in n && pathname.startsWith(n.href!)) as any

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f6fa' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #7c3aed', borderTopColor:'transparent', margin:'0 auto 12px', animation:'spin .8s linear infinite' }} />
        <div style={{ color:'#9ca3af', fontSize:13 }}>Carregando...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f5f6fa' }}>
      {/* SIDEBAR */}
      <aside style={{ width:260, background:'white', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', position:'fixed', height:'100%', zIndex:30, overflowY:'auto' }}>
        {/* Logo */}
        <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#7c3aed,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20h20M4 20V8l8-6 8 6v12"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:16, color:'#1f2937', letterSpacing:'-0.3px' }}>MG Construções</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>Gestão de Obras</div>
            </div>
          </div>
        </div>

        {/* Competência */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', background:'#faf9ff' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Competência</div>
          <select value={compAtiva} onChange={e => setCompAtiva(e.target.value)}
            style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'7px 10px', fontSize:13, color:'#1f2937', background:'white', outline:'none' }}>
            {[-2,-1,0,1,2].map(i => {
              const d = new Date(); d.setMonth(d.getMonth()+i)
              const v = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
              return <option key={v} value={v}>{nomeMes(v)} {d.getFullYear()}</option>
            })}
          </select>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'8px 12px' }}>
          {NAV.map((item, i) => {
            if ('section' in item) return (
              <div key={i} style={{ padding:'16px 8px 4px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'#d1d5db' }}>
                {item.section}
              </div>
            )
            const ativo = pathname.startsWith(item.href!)
            return (
              <Link key={item.href} href={item.href!}>
                <div style={{
                  display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
                  borderRadius:8, marginBottom:2, cursor:'pointer', transition:'all .15s',
                  background: ativo ? '#ede9fe' : 'transparent',
                  color: ativo ? '#7c3aed' : '#6b7280',
                  fontWeight: ativo ? 600 : 400, fontSize:14,
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={(item as any).icon} />
                  </svg>
                  {item.label}
                  {ativo && <div style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:'#7c3aed' }} />}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding:'16px 20px', borderTop:'1px solid #f3f4f6' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#7c3aed,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:14, fontWeight:700, flexShrink:0 }}>
              {perfil?.nome?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:13, color:'#1f2937', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{perfil?.nome}</div>
              <div style={{ fontSize:11, color:'#9ca3af', textTransform:'capitalize' }}>{perfil?.perfil}</div>
            </div>
          </div>
          <button onClick={sair} style={{ width:'100%', border:'1.5px solid #e5e7eb', background:'white', color:'#6b7280', borderRadius:8, padding:'7px', fontSize:12, cursor:'pointer', transition:'all .15s', fontWeight:500 }}>
            Sair da conta
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex:1, marginLeft:260, minHeight:'100vh', background:'#f5f6fa', display:'flex', flexDirection:'column' }}>
        {/* Topbar */}
        <div style={{ background:'white', borderBottom:'1px solid #e5e7eb', padding:'0 28px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:20 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:20, color:'#1f2937' }}>{paginaAtual?.label || 'Dashboard'}</div>
            <div style={{ fontSize:12, color:'#9ca3af', display:'flex', alignItems:'center', gap:4 }}>
              <span>Home</span>
              <span>/</span>
              <span style={{ color:'#7c3aed' }}>{paginaAtual?.label || 'Dashboard'}</span>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ background:'#f5f6fa', border:'1px solid #e5e7eb', borderRadius:8, padding:'6px 14px', fontSize:13, color:'#6b7280', display:'flex', alignItems:'center', gap:6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span style={{ color:'#7c3aed', fontWeight:600 }}>{nomeMes(compAtiva)}</span>
              <span>{compAtiva.split('-')[0]}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#7c3aed,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:13, fontWeight:700 }}>
                {perfil?.nome?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding:28, flex:1 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
