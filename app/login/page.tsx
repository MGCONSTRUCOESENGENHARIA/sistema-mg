'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro('E-mail ou senha incorretos.'); setLoading(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: perfil } = await supabase.from('perfis').select('perfil').eq('id', user.id).single()
      const rotas: Record<string, string> = {
        gestor: '/app/dashboard', escritorio: '/app/dashboard',
        encarregado: '/app/presenca', funcionario: '/meu-contracheque',
      }
      router.push(rotas[perfil?.perfil || 'escritorio'])
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'#f5f6fa' }}>
      {/* Left panel */}
      <div style={{ flex:1, background:'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:48 }}>
        <div style={{ maxWidth:420, textAlign:'center' }}>
          <div style={{ width:72, height:72, borderRadius:20, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 32px' }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 20h20M4 20V8l8-6 8 6v12"/>
            </svg>
          </div>
          <h1 style={{ color:'white', fontSize:32, fontWeight:800, marginBottom:12, letterSpacing:'-0.5px' }}>MG Construções</h1>
          <p style={{ color:'rgba(255,255,255,.7)', fontSize:16, lineHeight:1.6, marginBottom:40 }}>
            Sistema de gestão de diárias, presenças e pagamentos para sua equipe de obras.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              { icon:'M9 11l3 3L22 4', text:'Controle de presenças e diárias' },
              { icon:'M1 4h22v16H1zM1 10h22', text:'Adiantamentos e pagamentos' },
              { icon:'M18 20V10M12 20V4M6 20v-6', text:'Rateio e relatórios por obra' },
            ].map((f, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, textAlign:'left' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon}/>
                  </svg>
                </div>
                <span style={{ color:'rgba(255,255,255,.85)', fontSize:14 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div style={{ width:480, display:'flex', alignItems:'center', justifyContent:'center', padding:48, background:'white' }}>
        <div style={{ width:'100%', maxWidth:380 }}>
          <div style={{ marginBottom:36 }}>
            <h2 style={{ fontSize:26, fontWeight:800, color:'#1f2937', marginBottom:6, letterSpacing:'-0.3px' }}>Bem-vindo de volta</h2>
            <p style={{ fontSize:14, color:'#9ca3af' }}>Entre com suas credenciais para acessar</p>
          </div>

          {erro && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'12px 16px', marginBottom:20, color:'#991b1b', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {erro}
            </div>
          )}

          <form onSubmit={entrar}>
            <div style={{ marginBottom:18 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'12px 14px', fontSize:14, outline:'none', transition:'border .15s', color:'#1f2937' }}
                onFocus={e => e.target.style.borderColor='#7c3aed'}
                onBlur={e => e.target.style.borderColor='#e5e7eb'}
              />
            </div>
            <div style={{ marginBottom:28 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>Senha</label>
              <input type="password" required value={senha} onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'12px 14px', fontSize:14, outline:'none', transition:'border .15s', color:'#1f2937' }}
                onFocus={e => e.target.style.borderColor='#7c3aed'}
                onBlur={e => e.target.style.borderColor='#e5e7eb'}
              />
            </div>
            <button type="submit" disabled={loading}
              style={{ width:'100%', background: loading ? '#a78bfa' : 'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'white', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', transition:'all .15s', letterSpacing:'.2px' }}>
              {loading ? 'Entrando...' : 'Entrar no sistema'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:24, fontSize:12, color:'#d1d5db' }}>
            MG Construções © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
