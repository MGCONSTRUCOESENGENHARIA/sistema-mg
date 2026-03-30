'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$ } from '@/lib/utils'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({ funcs: 0, obras: 0, presencas: 0, alertas: 0, totalValor: 0 })
  const [loading, setLoading] = useState(true)
  const mes = mesAtual()

  useEffect(() => {
    async function load() {
      const [{ count: f }, { count: o }, { data: pres }, { data: fop }] = await Promise.all([
        supabase.from('funcionarios').select('*', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('obras').select('*', { count: 'exact', head: true }).eq('status', 'ATIVA'),
        supabase.from('presencas').select('fracao,fracao2,funcionarios(valor_diaria)').eq('mes_referencia' as any, mes),
        supabase.from('funcionario_obra_passagem').select('id', { count: 'exact', head: true }),
      ])

      // Contar passagens faltando
      const { count: totalFuncObra } = await supabase
        .from('funcionarios').select('*', { count: 'exact', head: true }).eq('ativo', true)
      const { count: totalFOP } = await supabase
        .from('funcionario_obra_passagem').select('*', { count: 'exact', head: true })
      const { count: totalObras } = await supabase
        .from('obras').select('*', { count: 'exact', head: true }).eq('status', 'ATIVA')

      const alertas = Math.max(0, ((totalFuncObra || 0) * (totalObras || 0)) - (totalFOP || 0))

      let totalValor = 0
      pres?.forEach((p: any) => {
        const soma = (p.fracao || 0) + (p.fracao2 || 0)
        totalValor += soma * (p.funcionarios?.valor_diaria || 0)
      })

      setStats({ funcs: f || 0, obras: o || 0, presencas: pres?.length || 0, alertas, totalValor })
      setLoading(false)
    }
    load()
  }, [])

  const fluxo = [
    { n: 1, label: 'Abrir mês', desc: 'Criar competência', href: '/app/competencias', icon: '📅' },
    { n: 2, label: 'Matriz de passagens', desc: 'Obrigatório antes de lançar', href: '/app/passagens', icon: '🔑' },
    { n: 3, label: 'Lançar presenças', desc: 'Apontamento diário', href: '/app/presenca', icon: '📋' },
    { n: 4, label: 'Registrar avulsos', desc: 'Vales e empréstimos', href: '/app/avulsos', icon: '💸' },
    { n: 5, label: 'Adiantamento', desc: 'Dia 20 — 1ª quinzena', href: '/app/adiantamento', icon: '💰' },
    { n: 6, label: 'Passagem & Café', desc: 'Calcular transportes', href: '/app/passagem-cafe', icon: '🚌' },
    { n: 7, label: 'Pagamento final', desc: 'Dia 05 — fechamento', href: '/app/pagamento', icon: '💳' },
    { n: 8, label: 'Rateio por obra', desc: 'Custo por obra', href: '/app/rateio', icon: '📊' },
    { n: 9, label: 'Fechar mês', desc: 'Trava edições', href: '/app/competencias', icon: '🔒' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a5c]">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">{nomeMes(mes)} {mes.split('-')[0]}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat">
          <div className="text-3xl">👷</div>
          <div className="stat-val">{loading ? '...' : stats.funcs}</div>
          <div className="stat-label">Funcionários ativos</div>
        </div>
        <div className="stat">
          <div className="text-3xl">🏗️</div>
          <div className="stat-val">{loading ? '...' : stats.obras}</div>
          <div className="stat-label">Obras ativas</div>
        </div>
        <div className="stat">
          <div className="text-3xl">📋</div>
          <div className="stat-val">{loading ? '...' : stats.presencas}</div>
          <div className="stat-label">Lançamentos no mês</div>
        </div>
        <div className={`stat ${stats.alertas > 0 ? 'border-red-300 bg-red-50' : ''}`}>
          <div className="text-3xl">{stats.alertas > 0 ? '⚠️' : '✅'}</div>
          <div className={`stat-val ${stats.alertas > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {loading ? '...' : stats.alertas}
          </div>
          <div className="stat-label">Passagens faltando</div>
          {stats.alertas > 0 && (
            <Link href="/app/passagens" className="text-xs text-red-600 underline mt-1 block">
              Corrigir agora →
            </Link>
          )}
        </div>
      </div>

      {/* Total do mês */}
      {!loading && stats.totalValor > 0 && (
        <div className="card-pad mb-6 flex items-center gap-4">
          <div className="text-3xl">💰</div>
          <div>
            <div className="text-2xl font-bold text-green-700">{formatR$(stats.totalValor)}</div>
            <div className="text-sm text-gray-500">Total em diárias lançadas no mês</div>
          </div>
        </div>
      )}

      {/* Fluxo do mês */}
      <div className="card-pad">
        <h2 className="font-semibold text-[#1a3a5c] mb-4">Fluxo do mês</h2>
        <div className="grid grid-cols-3 gap-3">
          {fluxo.map(f => (
            <Link key={f.n} href={f.href}>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all cursor-pointer">
                <div className="w-7 h-7 rounded-full bg-[#1a3a5c] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {f.n}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#1a3a5c] flex items-center gap-1.5">
                    <span>{f.icon}</span>{f.label}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{f.desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
