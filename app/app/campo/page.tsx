'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CampoLogin() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/campo/lancar')
    })
  }, [])

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) { setErro('E-mail ou senha incorretos.'); setLoading(false); return }
    router.push('/campo/lancar')
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#1e3a8a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:360 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:64, height:64, borderRadius:16, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:28 }}>🏗</div>
          <h1 style={{ color:'white', fontSize:22, fontWeight:700, marginBottom:4 }}>MG Campo</h1>
          <p style={{ color:'rgba(255,255,255,.6)', fontSize:14 }}>Lançamento de diárias extras</p>
        </div>
        <form onSubmit={entrar} style={{ background:'white', borderRadius:16, padding:24 }}>
          {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#991b1b', fontSize:13 }}>{erro}</div>}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>E-mail</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
              style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'11px 14px', fontSize:14, outline:'none' }}
              onFocus={e => e.target.style.borderColor='#1e3a8a'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:6 }}>Senha</label>
            <input type="password" required value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••"
              style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'11px 14px', fontSize:14, outline:'none' }}
              onFocus={e => e.target.style.borderColor='#1e3a8a'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
          </div>
          <button type="submit" disabled={loading}
            style={{ width:'100%', background:loading?'#9ca3af':'#1e3a8a', color:'white', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:700, cursor:loading?'not-allowed':'pointer' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
