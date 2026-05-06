import Topbar from '@/components/Topbar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      <Topbar />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px' }}>
        {children}
      </div>
    </div>
  )
}
