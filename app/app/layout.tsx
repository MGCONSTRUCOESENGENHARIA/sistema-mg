'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase, Perfil } from '@/lib/supabase'
import { mesAtual, nomeMes } from '@/lib/utils'

const MENUS = [
  {
    label: 'Principal',
    items: [
      { href: '/app/dashboard',    label: 'Dashboard' },
      { href: '/app/competencias', label: 'Competências' },
    ]
  },
  {
    label: 'Cadastro',
    items: [
      { href: '/app/funcionarios', label: 'Funcionários' },
      { href: '/app/obras',        label: 'Obras' },
      { href: '/app/passagens',    label: 'Matriz de Passagens' },
    ]
  },
  {
    label: 'Lançamentos',
    items: [
      { href: '/app/presenca/rapido', label: 'Lançamento Rápido' },
      { href: '/app/presenca', label: 'Grade de Presença' },
      { href: '/app/avulsos',  label: 'Descontos / Vales' },
      { href: '/app/folhas',    label: 'Folhas de Ponto' },
    ]
  },
  {
    label: 'Financeiro',
    items: [
      { href: '/app/passagem-cafe?q=1', label: 'Passagem & Café — Dia 16' },
      { href: '/app/adiantamento',      label: 'Adiantamento — Dia 20' },
      { href: '/app/passagem-cafe?q=2', label: 'Passagem & Café — Dia 01' },
      { href: '/app/pagamento',         label: 'Salário / Pagamento Final' },
      { href: '/app/rateio',            label: 'Rateio por Obra' },
    ]
  },
  {
    label: 'Engenharia',
    items: [
      { href: '/app/engenharia', label: 'Produção por Obra' },
      { href: '/app/engenharia/diarias', label: 'Diárias Extras' },
    ]
  },
  {
    label: 'Análise',
    items: [
      { href: '/app/relatorios', label: 'Relatórios' },
      { href: '/app/historico',  label: 'Histórico' },
    ]
  },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [compAtiva, setCompAtiva] = useState(mesAtual())
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const [userMenu, setUserMenu] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('perfis').select('*').eq('id', user.id).single()
        .then(({ data }) => { setPerfil(data); setLoading(false) })
    })
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(null)
        setUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Página atual
  const paginaAtual = MENUS.flatMap(m => m.items).find(item => pathname.startsWith(item.href.split('?')[0]))

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f6fa' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid #1e3a8a', borderTopColor:'transparent', margin:'0 auto 12px', animation:'spin .8s linear infinite' }} />
        <div style={{ color:'#9ca3af', fontSize:13 }}>Carregando...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f5f6fa', display:'flex', flexDirection:'column' }}>
      {/* TOPBAR */}
      <header ref={menuRef} style={{ background:'#1e3a8a', position:'sticky', top:0, zIndex:50, boxShadow:'0 2px 8px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', height:52, padding:'0 20px', gap:0 }}>

          {/* Logo */}
          <Link href="/app/dashboard">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginRight:24, cursor:'pointer' }}>
              <div style={{ width:32, height:32, borderRadius:8, background:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 20h20M4 20V8l8-6 8 6v12"/>
                </svg>
              </div>
              <span style={{ color:'white', fontWeight:800, fontSize:15, letterSpacing:'-0.3px', whiteSpace:'nowrap' }}>MG Construções</span>
            </div>
          </Link>

          {/* Menus */}
          <nav style={{ display:'flex', alignItems:'center', flex:1, gap:2 }}>
            {MENUS.map(menu => {
              const aberto = menuAberto === menu.label
              const ativo = menu.items.some(item => pathname.startsWith(item.href.split('?')[0]))
              return (
                <div key={menu.label} style={{ position:'relative' }}>
                  <button
                    onClick={() => setMenuAberto(aberto ? null : menu.label)}
                    style={{
                      display:'flex', alignItems:'center', gap:6, padding:'0 14px', height:52,
                      background: aberto ? 'rgba(255,255,255,.15)' : ativo ? 'rgba(255,255,255,.1)' : 'transparent',
                      color: ativo || aberto ? 'white' : 'rgba(255,255,255,.8)',
                      border:'none', cursor:'pointer', fontSize:14, fontWeight: ativo ? 600 : 400,
                      transition:'all .15s', whiteSpace:'nowrap',
                      borderBottom: ativo ? '3px solid #60a5fa' : '3px solid transparent',
                    }}
                  >
                    {menu.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: aberto ? 'rotate(180deg)' : 'rotate(0)', transition:'transform .2s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {aberto && (
                    <div style={{
                      position:'absolute', top:'100%', left:0, background:'white',
                      borderRadius:'0 0 10px 10px', boxShadow:'0 8px 24px rgba(0,0,0,.15)',
                      minWidth:220, overflow:'hidden', border:'1px solid #e5e7eb', borderTop:'none',
                    }}>
                      {menu.items.map((item, i) => {
                        const ativoItem = pathname.startsWith(item.href.split('?')[0])
                        return (
                          <Link key={i} href={item.href} onClick={() => setMenuAberto(null)}>
                            <div style={{
                              padding:'11px 18px', fontSize:13, cursor:'pointer', transition:'all .1s',
                              background: ativoItem ? '#eff6ff' : 'white',
                              color: ativoItem ? '#1e3a8a' : '#374151',
                              fontWeight: ativoItem ? 600 : 400,
                              borderLeft: ativoItem ? '3px solid #1e3a8a' : '3px solid transparent',
                            }}
                              onMouseEnter={e => { if (!ativoItem) { (e.currentTarget as HTMLElement).style.background='#f9fafb' } }}
                              onMouseLeave={e => { if (!ativoItem) { (e.currentTarget as HTMLElement).style.background='white' } }}>
                              {item.label}
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Direita */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:'auto' }}>
            {/* Competência */}
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.1)', borderRadius:8, padding:'5px 12px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <select value={compAtiva} onChange={e => setCompAtiva(e.target.value)}
                style={{ background:'transparent', border:'none', color:'white', fontSize:13, fontWeight:600, outline:'none', cursor:'pointer' }}>
                {[-2,-1,0,1,2].map(i => {
                  const d = new Date(); d.setMonth(d.getMonth()+i)
                  const v = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
                  return <option key={v} value={v} style={{ color:'#1f2937', background:'white' }}>{nomeMes(v)} {d.getFullYear()}</option>
                })}
              </select>
            </div>

            {/* Avatar */}
            <div style={{ position:'relative' }}>
              <button onClick={() => setUserMenu(u => !u)}
                style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.1)', border:'none', borderRadius:8, padding:'5px 12px', cursor:'pointer', color:'white' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                  {perfil?.nome?.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize:13, fontWeight:500 }}>{perfil?.nome?.split(' ')[0]}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {userMenu && (
                <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'white', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.15)', border:'1px solid #e5e7eb', overflow:'hidden', minWidth:160 }}>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6' }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{perfil?.nome}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', textTransform:'capitalize' }}>{perfil?.perfil}</div>
                  </div>
                  <button onClick={sair} style={{ width:'100%', padding:'10px 16px', background:'white', border:'none', color:'#ef4444', fontSize:13, cursor:'pointer', textAlign:'left', fontWeight:500 }}>
                    Sair da conta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Breadcrumb */}
        <div style={{ background:'rgba(0,0,0,.15)', padding:'6px 20px', display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
          <span style={{ color:'rgba(255,255,255,.5)' }}>Home</span>
          <span style={{ color:'rgba(255,255,255,.3)' }}>/</span>
          <span style={{ color:'rgba(255,255,255,.9)', fontWeight:500 }}>{paginaAtual?.label || 'Dashboard'}</span>
        </div>
      </header>

      {/* CONTENT */}
      <main style={{ flex:1, padding:28 }}>
        {children}
      </main>
    </div>
  )
}
