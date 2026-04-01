'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase, Perfil } from '@/lib/supabase'
import { mesAtual, nomeMes } from '@/lib/utils'

const NAV = [
  { section: 'Principal' },
  { href: '/app/dashboard',    label: 'Dashboard',            icon: <IconDash /> },
  { href: '/app/competencias', label: 'Competências',         icon: <IconCal /> },

  { section: 'Cadastro' },
  { href: '/app/funcionarios', label: 'Funcionários',         icon: <IconUser /> },
  { href: '/app/obras',        label: 'Obras',                icon: <IconObra /> },
  { href: '/app/passagens',    label: 'Matriz de Passagens',  icon: <IconPass /> },

  { section: 'Lançamentos' },
  { href: '/app/presenca',     label: 'Presença',             icon: <IconPres /> },
  { href: '/app/avulsos',      label: 'Avulsos / Vales',      icon: <IconAv /> },

  { section: 'Financeiro' },
  { href: '/app/adiantamento', label: 'Adiantamento',         icon: <IconMoney /> },
  { href: '/app/passagem-cafe',label: 'Passagem & Café',      icon: <IconBus /> },
  { href: '/app/pagamento',    label: 'Pagamento Final',      icon: <IconPag /> },
  { href: '/app/rateio',       label: 'Rateio por Obra',      icon: <IconRat /> },

  { section: 'Análise' },
  { href: '/app/relatorios',   label: 'Relatórios',           icon: <IconRel /> },
  { href: '/app/historico',    label: 'Histórico',            icon: <IconHist /> },
]

function IconDash()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> }
function IconCal()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function IconUser()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function IconObra()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function IconPass()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> }
function IconPres()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> }
function IconAv()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> }
function IconMoney() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> }
function IconBus()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> }
function IconPag()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> }
function IconRat()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
function IconRel()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }
function IconHist()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg> }
function IconBell()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> }
function IconSearch() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function IconChevron() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg> }

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [compAtiva, setCompAtiva] = useState(mesAtual())
  const [collapsed, setCollapsed] = useState(false)
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

  // Título da página atual
  const paginaAtual = NAV.find(n => 'href' in n && pathname.startsWith(n.href!)) as any
  const titulo = paginaAtual?.label || 'Sistema MG'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #4f46e5', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ color: '#64748b', fontSize: 13 }}>Carregando...</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const sideW = collapsed ? 64 : 220

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* ── SIDEBAR ── */}
      <aside style={{
        width: sideW, background: '#0f172a', display: 'flex', flexDirection: 'column',
        position: 'fixed', height: '100%', zIndex: 30, transition: 'width .2s',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            {!collapsed && (
              <div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>MG Construções</div>
                <div style={{ color: '#475569', fontSize: 10, marginTop: 1 }}>Gestão de Obras</div>
              </div>
            )}
          </div>
        </div>

        {/* Competência */}
        {!collapsed && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
            <div style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Competência ativa</div>
            <select value={compAtiva} onChange={e => setCompAtiva(e.target.value)}
              style={{ width: '100%', background: '#1e293b', color: 'white', fontSize: 12, borderRadius: 8, padding: '6px 10px', border: '1px solid #334155', outline: 'none' }}>
              {[-2,-1,0,1,2].map(i => {
                const d = new Date(); d.setMonth(d.getMonth() + i)
                const v = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
                return <option key={v} value={v}>{nomeMes(v)} {d.getFullYear()}</option>
              })}
            </select>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
          {NAV.map((item, i) => {
            if ('section' in item) {
              if (collapsed) return <div key={i} style={{ borderTop: '1px solid #1e293b', margin: '6px 0' }} />
              return <div key={i} style={{ padding: '14px 6px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#334155' }}>{item.section}</div>
            }
            const ativo = pathname.startsWith(item.href!)
            return (
              <Link key={item.href} href={item.href!}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px' : '9px 10px',
                  borderRadius: 8, marginBottom: 2, transition: 'all .15s', cursor: 'pointer',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: ativo ? '#4f46e5' : 'transparent',
                  color: ativo ? 'white' : '#64748b',
                }}
                  onMouseEnter={e => { if (!ativo) (e.currentTarget as HTMLElement).style.background = '#1e293b'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0' }}
                  onMouseLeave={e => { if (!ativo) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748b' } }}>
                  <span style={{ flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed && <span style={{ fontSize: 13, fontWeight: ativo ? 600 : 400, whiteSpace: 'nowrap' }}>{item.label}</span>}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', flexShrink: 0 }}>
          {collapsed ? (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={sair}>
              {perfil?.nome?.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {perfil?.nome?.charAt(0).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{perfil?.nome}</div>
                  <div style={{ color: '#475569', fontSize: 10, textTransform: 'capitalize' }}>{perfil?.perfil}</div>
                </div>
              </div>
              <button onClick={sair} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#64748b', borderRadius: 6, padding: '6px 10px', fontSize: 11, cursor: 'pointer', transition: 'all .15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e2e8f0' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748b' }}>
                Sair da conta
              </button>
            </div>
          )}
        </div>

        {/* Toggle collapse */}
        <button onClick={() => setCollapsed(c => !c)}
          style={{ position: 'absolute', top: 20, right: -12, width: 24, height: 24, borderRadius: '50%', background: '#4f46e5', border: '2px solid #0f172a', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform .2s' }}>
          <IconChevron />
        </button>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, marginLeft: sideW, minHeight: '100vh', background: '#f8fafc', transition: 'margin-left .2s', display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>MG Construções</span>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{titulo}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span style={{ fontWeight: 600, color: '#475569' }}>{nomeMes(compAtiva)}</span>
              <span style={{ color: '#94a3b8' }}>{compAtiva.split('-')[0]}</span>
            </div>
            <div style={{ background: '#eef2ff', color: '#4f46e5', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>
              {new Date().toLocaleDateString('pt-BR')}
            </div>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>
              {perfil?.nome?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ padding: 24, flex: 1 }}>
          {children}
        </div>
      </main>
    </div>
  )
}
