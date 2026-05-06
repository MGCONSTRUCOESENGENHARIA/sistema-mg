'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const GRAY = '#4b5563'
const GRAY_DARK = '#374151'
const GRAY_LIGHT = '#f3f4f6'

const menus = [
  {
    label: 'Principal',
    href: '/dashboard',
    children: [
      { label: 'Dashboard', href: '/dashboard' },
    ]
  },
  {
    label: 'Operação',
    href: '/frota',
    children: [
      { label: 'Frota', href: '/frota' },
      { label: 'Vencimentos', href: '/vencimentos' },
    ]
  },
  {
    label: 'KM & Revisões',
    href: '/km',
    children: [
      { label: 'Controle de KM', href: '/km' },
    ]
  },
  {
    label: 'Estoque',
    href: '/estoque',
    children: [
      { label: 'Peças & Pneus', href: '/estoque' },
    ]
  },
]

export default function Topbar() {
  const path = usePathname()
  const [open, setOpen] = useState<string | null>(null)

  const pageLabels: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/frota': 'Frota',
    '/vencimentos': 'Vencimentos',
    '/km': 'KM & Revisões',
    '/estoque': 'Estoque',
  }
  const pageLabel = pageLabels[path] || ''

  const today = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const todayFormatted = today.charAt(0).toUpperCase() + today.slice(1)

  return (
    <>
      {/* Main topbar */}
      <div style={{
        background: GRAY_DARK,
        borderBottom: `3px solid ${GRAY}`,
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 52 }}>
          {/* Logo */}
          <Link href="/dashboard" style={{ textDecoration: 'none', marginRight: 32 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
              MG Locação
            </span>
          </Link>

          {/* Nav menus */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            {menus.map(menu => {
              const isActive = menu.children.some(c => c.href === path)
              const isOpen = open === menu.label
              return (
                <div key={menu.label} style={{ position: 'relative' }}
                  onMouseEnter={() => setOpen(menu.label)}
                  onMouseLeave={() => setOpen(null)}>
                  <button style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '6px 12px', borderRadius: 4,
                    background: isActive ? 'rgba(255,255,255,0.15)' : isOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    color: '#fff', fontSize: 13, fontWeight: isActive ? 600 : 400,
                    fontFamily: 'Inter, sans-serif',
                    borderBottom: isActive ? '2px solid #fff' : '2px solid transparent',
                    transition: 'all 0.15s'
                  }}>
                    {menu.label}
                    <ChevronDown size={13} style={{ opacity: 0.7 }} />
                  </button>
                  {isOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0,
                      background: '#fff', borderRadius: 6, minWidth: 180,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      border: '1px solid #e5e7eb', overflow: 'hidden', zIndex: 200
                    }}>
                      {menu.children.map(child => (
                        <Link key={child.href} href={child.href} style={{
                          display: 'block', padding: '9px 16px', fontSize: 13,
                          color: path === child.href ? GRAY_DARK : '#374151',
                          background: path === child.href ? GRAY_LIGHT : 'transparent',
                          fontWeight: path === child.href ? 600 : 400,
                          textDecoration: 'none', transition: 'background 0.1s'
                        }}
                          onMouseEnter={e => { if (path !== child.href) (e.target as HTMLElement).style.background = '#f9fafb' }}
                          onMouseLeave={e => { if (path !== child.href) (e.target as HTMLElement).style.background = 'transparent' }}>
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Date pill */}
          <div style={{
            background: 'rgba(255,255,255,0.15)', borderRadius: 20,
            padding: '4px 12px', fontSize: 12, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span>📅</span>
            <span>{todayFormatted}</span>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '8px 24px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af' }}>
          <Link href="/dashboard" style={{ color: '#9ca3af', textDecoration: 'none' }}>Home</Link>
          {pageLabel && pageLabel !== 'Dashboard' && (
            <>
              <span>›</span>
              <span style={{ color: '#374151', fontWeight: 500 }}>{pageLabel}</span>
            </>
          )}
          {pageLabel === 'Dashboard' && <><span>›</span><span style={{ color: '#374151', fontWeight: 500 }}>Dashboard</span></>}
        </div>
      </div>
    </>
  )
}
