'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase, Perfil } from '@/lib/supabase'
import { mesAtual, nomeMes } from '@/lib/utils'

const NAV = [
  { section: 'Principal' },
  { href: '/app/dashboard',   icon: '◈',  label: 'Dashboard' },
  { href: '/app/competencias',icon: '📅', label: 'Competências' },

  { section: 'Cadastro' },
  { href: '/app/funcionarios',icon: '👷', label: 'Funcionários' },
  { href: '/app/obras',       icon: '🏗️', label: 'Obras' },
  { href: '/app/passagens',   icon: '🔑', label: 'Matriz de Passagens' },

  { section: 'Lançamentos' },
  { href: '/app/presenca',    icon: '📋', label: 'Presença' },
  { href: '/app/avulsos',     icon: '💸', label: 'Avulsos / Vales' },

  { section: 'Financeiro' },
  { href: '/app/adiantamento',icon: '💰', label: 'Adiantamento — Dia 20' },
  { href: '/app/passagem-cafe',icon:'🚌', label: 'Passagem & Café' },
  { href: '/app/pagamento',   icon: '💳', label: 'Pagamento Final — Dia 5' },
  { href: '/app/rateio',      icon: '📊', label: 'Rateio por Obra' },

  { section: 'Análise' },
  { href: '/app/relatorios',  icon: '📈', label: 'Relatórios' },
  { href: '/app/historico',   icon: '🕐', label: 'Histórico' },
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

  if (loading) return (
    <div className="min-h-screen bg-[#1a3a5c] flex items-center justify-center">
      <div className="text-white/60 text-sm">Carregando...</div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* ── SIDEBAR ── */}
      <aside className="w-56 bg-[#1a3a5c] flex flex-col fixed h-full z-20 overflow-y-auto">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚒</span>
            <div>
              <div className="text-white font-bold text-sm leading-none">Sistema MG</div>
              <div className="text-white/40 text-[10px] mt-0.5">Diárias & Pagamentos</div>
            </div>
          </div>
        </div>

        {/* Competência ativa */}
        <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div className="text-white/40 text-[10px] uppercase font-bold mb-1.5">Competência</div>
          <select
            value={compAtiva}
            onChange={e => setCompAtiva(e.target.value)}
            className="w-full bg-white/10 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/20 focus:outline-none focus:border-white/40"
          >
            {[-2,-1,0,1].map(i => {
              const d = new Date(); d.setMonth(d.getMonth() + i)
              const v = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
              return <option key={v} value={v}>{nomeMes(v)} {d.getFullYear()}</option>
            })}
          </select>
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-3 py-2">
          {NAV.map((item, i) => {
            if ('section' in item) return (
              <div key={i} className="nav-section">{item.section}</div>
            )
            const ativo = pathname.startsWith(item.href!)
            return (
              <Link key={item.href} href={item.href!}>
                <div className={`nav-link ${ativo ? 'active' : ''}`}>
                  <span className="text-base w-5 text-center">{item.icon}</span>
                  <span className="text-[13px]">{item.label}</span>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Usuário */}
        <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {perfil?.nome?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-white text-xs font-semibold truncate">{perfil?.nome}</div>
              <div className="text-white/40 text-[10px] capitalize">{perfil?.perfil}</div>
            </div>
          </div>
          <button onClick={sair} className="w-full text-white/40 hover:text-white/70 text-[11px] py-1 transition-colors text-center">
            Sair da conta
          </button>
        </div>
      </aside>

      {/* ── CONTEÚDO ── */}
      <main className="flex-1 ml-56 min-h-screen bg-[#f0f2f5]">
        {/* Topbar */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="text-sm text-gray-500">
            <span className="font-semibold text-[#1a3a5c]">{nomeMes(compAtiva)}</span>
            {' / '}{compAtiva.split('-')[0]}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="badge-blue">{perfil?.equipe || 'Todas equipes'}</span>
            <span>{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
