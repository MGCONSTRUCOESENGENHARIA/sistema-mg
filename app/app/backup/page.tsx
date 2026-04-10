'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function BackupPage() {
  const [exportando, setExportando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [msg, setMsg] = useState('')

  async function buscarDados() {
    setProgresso('Buscando funcionários...')
    const { data: funcionarios } = await supabase.from('funcionarios').select('*').order('nome')

    setProgresso('Buscando obras...')
    const { data: obras } = await supabase.from('obras').select('*').order('nome')

    setProgresso('Buscando planejamento...')
    const { data: planejamento } = await supabase.from('planejamento_obras')
      .select('*, funcionarios(nome,equipe), obras(nome)')

    setProgresso('Buscando presenças...')
    const { data: presencas } = await supabase.from('presencas')
      .select('*, funcionarios(nome), obras:obra_id(nome), competencias(mes_ano)')
      .order('data', { ascending: false })

    setProgresso('Buscando passagens...')
    const { data: passagens } = await supabase.from('passagens_quinzena')
      .select('*, funcionarios(nome), competencias(mes_ano)')

    setProgresso('Buscando descontos...')
    const { data: avulsos } = await supabase.from('avulsos')
      .select('*, funcionarios(nome)')
    const { data: parcelas } = await supabase.from('avulso_parcelas').select('*')

    setProgresso('Buscando folhas de ponto...')
    const { data: folhas } = await supabase.from('folhas_ponto')
      .select('*, obras(nome)').order('data', { ascending: false })

    setProgresso('Buscando pagamentos...')
    const { data: pagamentos } = await supabase.from('pagamentos')
      .select('*, funcionarios(nome), competencias(mes_ano)')
      .order('criado_em', { ascending: false })
    const { data: ajustes } = await supabase.from('pagamento_ajustes').select('*')

    setProgresso('Buscando diárias extras...')
    const { data: diarias } = await supabase.from('diarias_extras')
      .select('*, funcionarios(nome), obras(nome)')
      .order('data', { ascending: false })

    setProgresso('Buscando competências...')
    const { data: competencias } = await supabase.from('competencias').select('*').order('mes_ano')

    return { funcionarios, obras, planejamento, presencas, passagens, avulsos, parcelas, folhas, pagamentos, ajustes, diarias, competencias }
  }

  function flattenRows(rows: any[]): any[] {
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

  function toCSV(rows: any[]): string {
    if (!rows?.length) return ''
    const flat = flattenRows(rows)
    const headers = Object.keys(flat[0])
    const lines = flat.map(row =>
      headers.map(h => {
        const v = row[h]
        if (v === null || v === undefined) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s
      }).join(',')
    )
    return '\uFEFF' + [headers.join(','), ...lines].join('\n')
  }

  function download(filename: string, csv: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function exportarTudo() {
    setExportando(true)
    setMsg('')
    try {
      const dados = await buscarDados()
      const data = new Date().toISOString().slice(0,10)

      const abas = [
        // PLANEJAMENTO
        { nome: 'Funcionarios', dados: dados.funcionarios },
        { nome: 'Obras', dados: dados.obras },
        { nome: 'Planejamento_Obras', dados: dados.planejamento },
        // LANÇAMENTOS
        { nome: 'Presencas', dados: dados.presencas },
        { nome: 'Passagens', dados: dados.passagens },
        { nome: 'Descontos_Vales', dados: dados.avulsos },
        { nome: 'Parcelas_Desconto', dados: dados.parcelas },
        { nome: 'Folhas_Ponto', dados: dados.folhas },
        // FINANCEIRO
        { nome: 'Pagamentos', dados: dados.pagamentos },
        { nome: 'Ajustes_Pagamento', dados: dados.ajustes },
        // ENGENHARIA
        { nome: 'Diarias_Extras', dados: dados.diarias },
        { nome: 'Competencias', dados: dados.competencias },
      ]

      setProgresso('Gerando arquivos...')
      for (const aba of abas) {
        if (!aba.dados?.length) continue
        const csv = toCSV(aba.dados)
        await new Promise(r => setTimeout(r, 300))
        download(`MG_${aba.nome}_${data}.csv`, csv)
      }

      setMsg(`✅ Backup completo! ${abas.filter(a => a.dados?.length).length} arquivos exportados.`)
    } catch(e: any) {
      setMsg(`❌ Erro: ${e.message}`)
    } finally {
      setExportando(false)
      setProgresso('')
    }
  }

  const GRUPOS = [
    {
      titulo: 'Planejamento',
      cor: '#7c3aed',
      icon: '📋',
      itens: ['Funcionários', 'Obras', 'Planejamento de Obras']
    },
    {
      titulo: 'Lançamentos',
      cor: '#0891b2',
      icon: '✅',
      itens: ['Presenças', 'Matriz de Passagens', 'Grade de Presença', 'Descontos / Vales', 'Folhas de Ponto']
    },
    {
      titulo: 'Financeiro',
      cor: '#059669',
      icon: '💰',
      itens: ['Pagamentos', 'Adiantamentos', 'Ajustes de Pagamento']
    },
    {
      titulo: 'Engenharia',
      cor: '#92400e',
      icon: '🏗',
      itens: ['Diárias Extras', 'Competências']
    },
  ]

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#1f2937', marginBottom:4 }}>Backup dos Dados</h1>
        <p style={{ fontSize:13, color:'#9ca3af' }}>Exporta todos os dados do sistema em arquivos CSV separados por categoria</p>
      </div>

      <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'14px 18px', marginBottom:20, display:'flex', gap:12 }}>
        <span style={{ fontSize:22 }}>⚠️</span>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#92400e', marginBottom:3 }}>Faça backup regularmente!</div>
          <div style={{ fontSize:12, color:'#b45309', lineHeight:1.6 }}>
            O Supabase pausa projetos gratuitos após 1 semana sem uso. Recomendamos exportar pelo menos <strong>1x por mês</strong> e guardar os arquivos em uma pasta segura no computador ou Google Drive.
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ background:msg.includes('✅')?'#f0fdf4':'#fef2f2', border:`1px solid ${msg.includes('✅')?'#bbf7d0':'#fecaca'}`, borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:14, fontWeight:600, color:msg.includes('✅')?'#166534':'#991b1b' }}>
          {msg}
        </div>
      )}

      {/* Botão principal */}
      <button onClick={exportarTudo} disabled={exportando}
        style={{ width:'100%', padding:'16px', borderRadius:12, border:'none', background:exportando?'#6b7280':'#1e3a8a', color:'white', fontSize:16, fontWeight:700, cursor:exportando?'not-allowed':'pointer', marginBottom:24, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
        {exportando ? (
          <>
            <div style={{ width:20, height:20, borderRadius:'50%', border:'3px solid rgba(255,255,255,.3)', borderTopColor:'white', animation:'spin .8s linear infinite' }} />
            {progresso || 'Exportando...'}
          </>
        ) : '📦 Exportar Backup Completo'}
      </button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* O que está incluído */}
      <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:12 }}>O que será exportado:</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
        {GRUPOS.map((g, i) => (
          <div key={i} style={{ border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
            <div style={{ background:g.cor, padding:'10px 14px', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>{g.icon}</span>
              <span style={{ color:'white', fontWeight:700, fontSize:14 }}>{g.titulo}</span>
            </div>
            <div style={{ padding:'10px 14px' }}>
              {g.itens.map((item, j) => (
                <div key={j} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom: j<g.itens.length-1?'1px solid #f3f4f6':'none' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:g.cor, flexShrink:0 }} />
                  <span style={{ fontSize:13, color:'#374151' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
