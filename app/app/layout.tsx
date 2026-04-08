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

const LOGO_SRC = "data:image/png;base64,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"

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
      <header ref={menuRef} style={{ background:'#1e3a8a', position:'sticky', top:0, zIndex:50, boxShadow:'0 2px 8px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', alignItems:'center', height:52, padding:'0 20px', gap:0 }}>

          <Link href="/app/dashboard">
            <div style={{ display:'flex', alignItems:'center', marginRight:24, cursor:'pointer' }}>
              <img src={LOGO_SRC} alt="MG Construções" style={{ height:38, width:'auto', objectFit:'contain' }} />
            </div>
          </Link>

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
                            }}>
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

          <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:'auto' }}>
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

        <div style={{ background:'rgba(0,0,0,.15)', padding:'6px 20px', display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
          <span style={{ color:'rgba(255,255,255,.5)' }}>Home</span>
          <span style={{ color:'rgba(255,255,255,.3)' }}>/</span>
          <span style={{ color:'rgba(255,255,255,.9)', fontWeight:500 }}>{paginaAtual?.label || 'Dashboard'}</span>
        </div>
      </header>

      <main style={{ flex:1, padding:28 }}>
        {children}
      </main>
    </div>
  )
}
