'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setSenha] = useState('')
  const [senha, setS] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error || !data.user) { setErro('Email ou senha incorretos.'); setLoading(false); return }

    const { data: perfil } = await supabase.from('perfis').select('perfil').eq('id', data.user.id).single()
    const rotas: Record<string, string> = {
      gestor: '/app/dashboard', escritorio: '/app/dashboard',
      encarregado: '/app/presenca', funcionario: '/app/meu-contracheque',
    }
    router.push(rotas[perfil?.perfil ?? 'escritorio'])
  }

  return (
    <div className="min-h-screen bg-[#1a3a5c] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl">⚒</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Sistema MG</h1>
          <p className="text-white/50 text-sm mt-1">Controle de Diárias e Pagamentos</p>
        </div>

        <div className="bg-white rounded-2xl p-7 shadow-xl">
          {erro && <div className="alert-err mb-4">{erro}</div>}
          <form onSubmit={entrar} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="seu@email.com"
                value={email} onChange={e => setSenha(e.target.value)} required />
            </div>
            <div>
              <label className="label">Senha</label>
              <input type="password" className="input" placeholder="••••••••"
                value={senha} onChange={e => setS(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-1">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
