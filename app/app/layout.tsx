'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase, Perfil } from '@/lib/supabase'
import { mesAtual, nomeMes } from '@/lib/utils'

const MENUS = [
  { label: 'Principal', items: [
    { href: '/app/dashboard',    label: 'Dashboard' },
    { href: '/app/competencias', label: 'Competências' },
  ]},
  { label: 'Cadastro', items: [
    { href: '/app/funcionarios', label: 'Funcionários' },
    { href: '/app/obras',        label: 'Obras' },
    { href: '/app/passagens',    label: 'Matriz de Passagens' },
    { href: '/app/planejamento',  label: 'Planejamento de Obras' },
  ]},
  { label: 'Lançamentos', items: [
    { href: '/app/presenca/rapido', label: 'Lançamento Rápido' },
    { href: '/app/presenca',        label: 'Grade de Presença' },
    { href: '/app/avulsos',         label: 'Descontos / Vales' },
    { href: '/app/folhas',          label: 'Folhas de Ponto' },
  ]},
  { label: 'Financeiro', items: [
    { href: '/app/passagem-cafe?q=1', label: 'Passagem & Café — Dia 16' },
    { href: '/app/adiantamento',      label: 'Adiantamento — Dia 20' },
    { href: '/app/passagem-cafe?q=2', label: 'Passagem & Café — Dia 01' },
    { href: '/app/pagamento',         label: 'Salário / Pagamento Final' },
    { href: '/app/rateio',            label: 'Rateio por Obra' },
  ]},
  { label: 'Engenharia', items: [
    { href: '/app/engenharia',         label: 'Produção por Obra' },
    { href: '/app/engenharia/diarias', label: 'Diárias Extras' },
  ]},
  { label: 'Análise', items: [
    { href: '/app/relatorios', label: 'Relatórios' },
    { href: '/app/historico',  label: 'Histórico' },
  ]},
]

const LOGO = "data:image/png;base64,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"

// Toast global
export function showToast(msg: string, tipo: 'success' | 'error' = 'success') {
  const el = document.createElement('div')
  el.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;color:white;background:${tipo==='success'?'#059669':'#dc2626'};box-shadow:0 8px 24px rgba(0,0,0,.2);animation:slideIn .3s ease;`
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => { el.style.animation='slideOut .3s ease'; setTimeout(() => el.remove(), 300) }, 3000)
}

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
        setMenuAberto(null); setUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const paginaAtual = MENUS.flatMap(m => m.items).find(item => pathname.startsWith(item.href.split('?')[0]))

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f6fa' }}>
      <style>{`
        @keyframes shimmer { 0%{opacity:.4} 50%{opacity:1} 100%{opacity:.4} }
        @keyframes slideIn { from{transform:translateX(100px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes slideOut { from{transform:translateX(0);opacity:1} to{transform:translateX(100px);opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes modalBg { from{opacity:0} to{opacity:1} }
        @keyframes modalSlide { from{opacity:0;transform:scale(.95) translateY(-10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        tr:hover td { background: #f8faff !important; transition: background .15s; }
        ::-webkit-scrollbar { width:6px; height:6px }
        ::-webkit-scrollbar-track { background:#f1f5f9 }
        ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px }
      `}</style>
      <div style={{ textAlign:'center' }}>
        <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:16 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width:10, height:10, borderRadius:'50%', background:'#1e3a8a', animation:`shimmer 1.2s ${i*0.2}s infinite` }} />
          ))}
        </div>
        <div style={{ color:'#9ca3af', fontSize:13 }}>Carregando...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f5f6fa', display:'flex', flexDirection:'column' }}>
      <style>{`
        @keyframes shimmer { 0%{opacity:.4} 50%{opacity:1} 100%{opacity:.4} }
        @keyframes slideIn { from{transform:translateX(100px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes slideOut { from{transform:translateX(0);opacity:1} to{transform:translateX(100px);opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        tbody tr:hover td { background: rgba(239,246,255,0.7) !important; transition: background .12s; }
        ::-webkit-scrollbar { width:6px; height:6px }
        ::-webkit-scrollbar-track { background:#f1f5f9 }
        ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px }
        ::-webkit-scrollbar-thumb:hover { background:#94a3b8 }
        @keyframes modalBg { from{opacity:0} to{opacity:1} }
        @keyframes modalSlide { from{opacity:0;transform:scale(.95) translateY(-10px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>

      <header ref={menuRef} style={{ background:'#1e3a8a', position:'sticky', top:0, zIndex:50, boxShadow:'0 2px 12px rgba(0,0,0,.25)' }}>
        <div style={{ display:'flex', alignItems:'center', height:56, padding:'0 20px', gap:0 }}>

          {/* Logo */}
          <Link href="/app/dashboard">
            <div style={{ display:'flex', alignItems:'center', marginRight:28, cursor:'pointer', padding:'4px 0' }}>
              <span style={{ color:'white', fontWeight:800, fontSize:15, letterSpacing:'-0.3px' }}>MG Construções</span>
            </div>
          </Link>

          {/* Menus */}
          <nav style={{ display:'flex', alignItems:'center', flex:1, gap:2 }}>
            {MENUS.map(menu => {
              const aberto = menuAberto === menu.label
              const ativo = menu.items.some(item => pathname.startsWith(item.href.split('?')[0]))
              return (
                <div key={menu.label} style={{ position:'relative' }}>
                  <button onClick={() => setMenuAberto(aberto ? null : menu.label)}
                    style={{
                      display:'flex', alignItems:'center', gap:5, padding:'0 14px', height:56,
                      background: aberto ? 'rgba(255,255,255,.15)' : 'transparent',
                      color: ativo || aberto ? 'white' : 'rgba(255,255,255,.75)',
                      border:'none', cursor:'pointer', fontSize:13.5, fontWeight: ativo ? 700 : 400,
                      transition:'all .15s', whiteSpace:'nowrap',
                      borderBottom: ativo ? '3px solid #60a5fa' : '3px solid transparent',
                      borderTop: '3px solid transparent',
                    }}>
                    {menu.label}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      style={{ transform: aberto ? 'rotate(180deg)' : 'rotate(0)', transition:'transform .2s', opacity:.7 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {aberto && (
                    <div style={{
                      position:'absolute', top:'100%', left:0, background:'white',
                      borderRadius:'0 0 12px 12px', boxShadow:'0 12px 32px rgba(0,0,0,.15)',
                      minWidth:230, overflow:'hidden', border:'1px solid #e5e7eb', borderTop:'none',
                    }}>
                      {menu.items.map((item, i) => {
                        const ativoItem = pathname.startsWith(item.href.split('?')[0])
                        return (
                          <Link key={i} href={item.href} onClick={() => setMenuAberto(null)}>
                            <div style={{
                              padding:'11px 18px', fontSize:13, cursor:'pointer',
                              background: ativoItem ? '#eff6ff' : 'white',
                              color: ativoItem ? '#1e3a8a' : '#374151',
                              fontWeight: ativoItem ? 700 : 400,
                              borderLeft: ativoItem ? '3px solid #1e3a8a' : '3px solid transparent',
                              transition:'all .1s',
                            }}
                              onMouseEnter={e => { if (!ativoItem) { (e.currentTarget as HTMLElement).style.background='#f9fafb'; (e.currentTarget as HTMLElement).style.borderLeft='3px solid #e5e7eb' } }}
                              onMouseLeave={e => { if (!ativoItem) { (e.currentTarget as HTMLElement).style.background='white'; (e.currentTarget as HTMLElement).style.borderLeft='3px solid transparent' } }}>
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
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.1)', borderRadius:8, padding:'5px 12px', border:'1px solid rgba(255,255,255,.1)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="2">
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

            {/* Avatar com nome */}
            <div style={{ position:'relative' }}>
              <button onClick={() => setUserMenu(u => !u)}
                style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)', borderRadius:8, padding:'5px 12px', cursor:'pointer', color:'white', transition:'background .15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.1)'}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#3b82f6,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
                  {perfil?.nome?.charAt(0).toUpperCase()}
                </div>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:12, fontWeight:700, lineHeight:1.2 }}>{perfil?.nome?.split(' ')[0]}</div>
                  <div style={{ fontSize:10, opacity:.6, textTransform:'capitalize' }}>{perfil?.perfil}</div>
                </div>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity:.6 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {userMenu && (
                <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'white', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,.15)', border:'1px solid #e5e7eb', overflow:'hidden', minWidth:180, zIndex:100 }}>
                  <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6', background:'#f9fafb' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1f2937' }}>{perfil?.nome}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', textTransform:'capitalize', marginTop:2 }}>{perfil?.perfil}</div>
                  </div>
                  <button onClick={sair} style={{ width:'100%', padding:'11px 16px', background:'white', border:'none', color:'#ef4444', fontSize:13, cursor:'pointer', textAlign:'left', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                    Sair da conta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Breadcrumb */}
        <div style={{ background:'rgba(0,0,0,.18)', padding:'5px 22px', display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
          <Link href="/app/dashboard">
            <span style={{ color:'rgba(255,255,255,.5)', cursor:'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,.8)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,.5)'}>Home</span>
          </Link>
          <span style={{ color:'rgba(255,255,255,.25)' }}>›</span>
          <span style={{ color:'rgba(255,255,255,.9)', fontWeight:600 }}>{paginaAtual?.label || 'Dashboard'}</span>
        </div>
      </header>

      <main style={{ flex:1, padding:28 }}>
        {children}
      </main>
    </div>
  )
}
