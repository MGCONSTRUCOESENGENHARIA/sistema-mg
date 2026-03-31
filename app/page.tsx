'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('perfis').select('perfil').eq('id', user.id).single().then(({ data }) => {
        const rotas: Record<string, string> = {
          gestor: '/app/dashboard', escritorio: '/app/dashboard',
          encarregado: '/app/presenca', funcionario: '/meu-contracheque',
        }
        router.push(rotas[data?.perfil || 'escritorio'])
      })
    })
  }, [])
  return (
    <div className="min-h-screen bg-[#1a3a5c] flex items-center justify-center">
      <div className="text-white/60 text-sm">Redirecionando...</div>
    </div>
  )
}
