'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

declare const XLSX: any

function loadXLSX(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof XLSX !== 'undefined') { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
}

function flatten(rows: any[]): any[] {
  return (rows || []).map(row => {
    const flat: any = {}
    for (const [k, v] of Object.entries(row)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v as any)) {
          flat[`${k}_${k2}`] = v2
        }
      } else {
        flat[k] = v
      }
    }
    return flat
  })
}

async function buscar(tabela: string, select: string, order?: string) {
  let q = supabase.from(tabela).select(select)
  if (order) q = q.order(order)
  const { data } = await q
  return data || []
}

export default function BackupPage() {
  const [exportando, setExportando] = useState<string | null>(null)
  const [progresso, setProgresso] = useState('')
  const [msg, setMsg] = useState('')

  async function gerarExcel(nome: string, abas: { titulo: string; dados: any[] }[]) {
    await loadXLSX()
    const wb = XLSX.utils.book_new()
    for (const aba of abas) {
      const rows = flatten(aba.dados)
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}])
      // Largura automática
      if (rows.length) {
        const cols = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 15) }))
        ws['!cols'] = cols
      }
      XLSX.utils.book_append_sheet(wb, ws, aba.titulo.substring(0, 31))
    }
    const data = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `MG_${nome}_${data}.xlsx`)
  }

  async function exportarGrupo(grupo: string) {
    setExportando(grupo)
    setMsg('')
    try {
      if (grupo === 'Planejamento') {
        setProgresso('Buscando funcionários...')
        const funcionarios = await buscar('funcionarios', '*', 'nome')
        setProgresso('Buscando obras...')
        const obras = await buscar('obras', '*', 'nome')
        setProgresso('Buscando planejamento...')
        const planejamento = await buscar('planejamento_obras', '*, funcionarios(nome,equipe,funcao,valor_diaria), obras(nome)')
        await gerarExcel('Planejamento', [
          { titulo: 'Funcionários', dados: funcionarios },
          { titulo: 'Obras', dados: obras },
          { titulo: 'Planejamento de Obras', dados: planejamento },
        ])
      }

      if (grupo === 'Lancamentos') {
        setProgresso('Buscando presenças...')
        const presencas = await buscar('presencas', '*, funcionarios(nome), obras:obra_id(nome), competencias(mes_ano)', 'data')
        setProgresso('Buscando passagens...')
        const passagens = await buscar('passagens_quinzena', '*, funcionarios(nome), competencias(mes_ano)')
        setProgresso('Buscando descontos...')
        const avulsos = await buscar('avulsos', '*, funcionarios(nome)', 'data_lancamento')
        const parcelas = await buscar('avulso_parcelas', '*')
        setProgresso('Buscando folhas de ponto...')
        const folhas = await buscar('folhas_ponto', '*, obras(nome)', 'data')
        setProgresso('Buscando matriz de passagens...')
        const matriz = await buscar('funcionario_obra_passagem', '*, funcionarios(nome), obras(nome)')
        await gerarExcel('Lancamentos', [
          { titulo: 'Presenças', dados: presencas },
          { titulo: 'Passagem e Café', dados: passagens },
          { titulo: 'Matriz de Passagens', dados: matriz },
          { titulo: 'Descontos e Vales', dados: avulsos },
          { titulo: 'Parcelas', dados: parcelas },
          { titulo: 'Folhas de Ponto', dados: folhas },
        ])
      }

      if (grupo === 'Financeiro') {
        setProgresso('Buscando pagamentos...')
        const pagamentos = await buscar('pagamentos', '*, funcionarios(nome), competencias(mes_ano)')
        setProgresso('Buscando ajustes...')
        const ajustes = await buscar('pagamento_ajustes', '*')
        setProgresso('Buscando competências...')
        const competencias = await buscar('competencias', '*', 'mes_ano')
        setProgresso('Buscando rateio...')
        const rateio = await buscar('rateio_mensal', '*')
        await gerarExcel('Financeiro', [
          { titulo: 'Pagamentos', dados: pagamentos },
          { titulo: 'Ajustes Pagamento', dados: ajustes },
          { titulo: 'Rateio por Obra', dados: rateio },
          { titulo: 'Competências', dados: competencias },
        ])
      }

      if (grupo === 'Engenharia') {
        setProgresso('Buscando diárias extras...')
        const diarias = await buscar('diarias_extras', '*, funcionarios(nome), obras(nome)', 'data')
        setProgresso('Buscando folhas...')
        const folhas = await buscar('folhas_ponto', '*, obras(nome)', 'data')
        await gerarExcel('Engenharia', [
          { titulo: 'Diárias Extras', dados: diarias },
          { titulo: 'Folhas de Ponto', dados: folhas },
        ])
      }

      setMsg(`✅ ${grupo}.xlsx exportado com sucesso!`)
      setTimeout(() => setMsg(''), 4000)
    } catch (e: any) {
      setMsg(`❌ Erro: ${e.message}`)
    } finally {
      setExportando(null)
      setProgresso('')
    }
  }

  async function exportarTudo() {
    setExportando('tudo')
    for (const g of ['Planejamento', 'Lancamentos', 'Financeiro', 'Engenharia']) {
      await exportarGrupo(g)
      await new Promise(r => setTimeout(r, 800))
    }
    setExportando(null)
    setMsg('✅ Backup completo exportado — 4 arquivos Excel!')
    setTimeout(() => setMsg(''), 5000)
  }

  const GRUPOS = [
    {
      key: 'Planejamento', cor: '#7c3aed', icon: '📋',
      abas: ['Funcionários', 'Obras', 'Planejamento de Obras']
    },
    {
      key: 'Lancamentos', cor: '#0891b2', icon: '✅',
      abas: ['Presenças', 'Passagem e Café', 'Matriz de Passagens', 'Descontos e Vales', 'Parcelas', 'Folhas de Ponto']
    },
    {
      key: 'Financeiro', cor: '#059669', icon: '💰',
      abas: ['Pagamentos', 'Ajustes Pagamento', 'Rateio por Obra', 'Competências']
    },
    {
      key: 'Engenharia', cor: '#92400e', icon: '🏗',
      abas: ['Diárias Extras', 'Folhas de Ponto']
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>Backup dos Dados</h1>
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Exporta os dados em arquivos Excel organizados por categoria, cada um com múltiplas abas</p>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 22 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>Faça backup regularmente!</div>
          <div style={{ fontSize: 12, color: '#b45309' }}>Recomendamos exportar pelo menos <strong>1x por mês</strong> e guardar os arquivos em pasta segura ou Google Drive.</div>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.includes('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.includes('✅') ? '#bbf7d0' : '#fecaca'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14, fontWeight: 600, color: msg.includes('✅') ? '#166534' : '#991b1b' }}>
          {msg}
        </div>
      )}

      {(exportando === 'tudo' || progresso) && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #93c5fd', borderTopColor: '#1e40af', animation: 'spin .8s linear infinite', flexShrink: 0 }} />
          {progresso || 'Exportando...'}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Botão exportar tudo */}
      <button onClick={exportarTudo} disabled={!!exportando}
        style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: exportando ? '#6b7280' : '#1e3a8a', color: 'white', fontSize: 15, fontWeight: 700, cursor: exportando ? 'not-allowed' : 'pointer', marginBottom: 20 }}>
        📦 Exportar Backup Completo (4 arquivos Excel)
      </button>

      {/* Cards por grupo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
        {GRUPOS.map(g => (
          <div key={g.key} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: g.cor, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{g.icon}</span>
                <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{g.key}.xlsx</span>
              </div>
              <button onClick={() => exportarGrupo(g.key)} disabled={!!exportando}
                style={{ padding: '6px 14px', borderRadius: 8, border: '2px solid rgba(255,255,255,.5)', background: exportando === g.key ? 'rgba(255,255,255,.3)' : 'transparent', color: 'white', cursor: exportando ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}>
                {exportando === g.key ? '⏳ Gerando...' : '⬇ Baixar'}
              </button>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>ABAS DO EXCEL:</div>
              {g.abas.map((aba, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: i < g.abas.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: g.cor, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#374151' }}>{aba}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
