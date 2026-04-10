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

function criarAba(dados: any[], titulo: string) {
  const rows = flatten(dados)
  if (!rows.length) return XLSX.utils.aoa_to_sheet([['Sem dados']])

  const headers = Object.keys(rows[0])

  // Montar array de arrays (AOA) com header + dados
  const aoa: any[][] = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Largura das colunas baseada no conteúdo
  ws['!cols'] = headers.map(h => {
    const maxLen = Math.max(
      h.length,
      ...rows.slice(0, 50).map(r => String(r[h] ?? '').length)
    )
    return { wch: Math.min(Math.max(maxLen + 2, 12), 50) }
  })

  // Congelar primeira linha
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }

  // Estilo do cabeçalho — azul escuro, texto branco, negrito
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
    fill: { fgColor: { rgb: '1E3A8A' }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border: {
      bottom: { style: 'thin', color: { rgb: '93C5FD' } },
    }
  }

  // Estilo linhas pares (cinza claro)
  const evenStyle = {
    font: { name: 'Arial', sz: 9 },
    fill: { fgColor: { rgb: 'F1F5F9' }, patternType: 'solid' },
    alignment: { vertical: 'center' }
  }

  // Estilo linhas ímpares (branco)
  const oddStyle = {
    font: { name: 'Arial', sz: 9 },
    fill: { fgColor: { rgb: 'FFFFFF' }, patternType: 'solid' },
    alignment: { vertical: 'center' }
  }

  // Aplicar estilos célula por célula
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c })
    if (!ws[cellRef]) ws[cellRef] = { v: headers[c], t: 's' }
    ws[cellRef].s = headerStyle
  }

  for (let r = 1; r <= rows.length; r++) {
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c })
      if (!ws[cellRef]) continue
      ws[cellRef].s = r % 2 === 0 ? evenStyle : oddStyle
    }
  }

  // Altura da linha de cabeçalho
  ws['!rows'] = [{ hpt: 20 }, ...Array(rows.length).fill({ hpt: 16 })]

  return ws
}

async function buscar(tabela: string, select: string, order?: string) {
  let q = supabase.from(tabela).select(select)
  if (order) q = (q as any).order(order)
  const { data } = await q
  return data || []
}

async function gerarExcel(nome: string, abas: { titulo: string; dados: any[] }[]) {
  await loadXLSX()
  const wb = XLSX.utils.book_new()
  wb.Props = {
    Title: `MG Construções — ${nome}`,
    Author: 'Sistema MG',
    CreatedDate: new Date()
  }
  for (const aba of abas) {
    const ws = criarAba(aba.dados, aba.titulo)
    XLSX.utils.book_append_sheet(wb, ws, aba.titulo.substring(0, 31))
  }
  const data = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `MG_${nome}_${data}.xlsx`)
}

export default function BackupPage() {
  const [exportando, setExportando] = useState<string | null>(null)
  const [progresso, setProgresso] = useState('')
  const [msg, setMsg] = useState('')

  async function exportarGrupo(grupo: string) {
    setExportando(grupo); setMsg('')
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
        setProgresso('Buscando matriz...')
        const matriz = await buscar('funcionario_obra_passagem', '*, funcionarios(nome), obras(nome)')
        setProgresso('Buscando descontos...')
        const avulsos = await buscar('avulsos', '*, funcionarios(nome)', 'data_lancamento')
        const parcelas = await buscar('avulso_parcelas', '*')
        setProgresso('Buscando folhas...')
        const folhas = await buscar('folhas_ponto', '*, obras(nome)', 'data')
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
        setProgresso('Buscando rateio...')
        const rateio = await buscar('rateio_mensal', '*')
        setProgresso('Buscando competências...')
        const competencias = await buscar('competencias', '*', 'mes_ano')
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
      setMsg(`✅ ${grupo}.xlsx exportado!`)
      setTimeout(() => setMsg(''), 4000)
    } catch (e: any) {
      setMsg(`❌ Erro: ${e.message}`)
    } finally {
      setExportando(null); setProgresso('')
    }
  }

  async function exportarTudo() {
    setExportando('tudo')
    for (const g of ['Planejamento', 'Lancamentos', 'Financeiro', 'Engenharia']) {
      await exportarGrupo(g)
      await new Promise(r => setTimeout(r, 1000))
    }
    setExportando(null)
    setMsg('✅ Backup completo — 4 arquivos Excel!')
    setTimeout(() => setMsg(''), 5000)
  }

  const GRUPOS = [
    { key: 'Planejamento', cor: '#7c3aed', icon: '📋', abas: ['Funcionários', 'Obras', 'Planejamento de Obras'] },
    { key: 'Lancamentos', cor: '#0891b2', icon: '✅', abas: ['Presenças', 'Passagem e Café', 'Matriz de Passagens', 'Descontos e Vales', 'Parcelas', 'Folhas de Ponto'] },
    { key: 'Financeiro', cor: '#059669', icon: '💰', abas: ['Pagamentos', 'Ajustes Pagamento', 'Rateio por Obra', 'Competências'] },
    { key: 'Engenharia', cor: '#92400e', icon: '🏗', abas: ['Diárias Extras', 'Folhas de Ponto'] },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>Backup dos Dados</h1>
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Exporta planilhas Excel formatadas com cabeçalho azul, linhas zebradas e colunas ajustadas</p>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 22 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>Faça backup regularmente!</div>
          <div style={{ fontSize: 12, color: '#b45309' }}>Recomendamos exportar pelo menos <strong>1x por mês</strong> e guardar em pasta segura ou Google Drive.</div>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.includes('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.includes('✅') ? '#bbf7d0' : '#fecaca'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14, fontWeight: 600, color: msg.includes('✅') ? '#166534' : '#991b1b' }}>
          {msg}
        </div>
      )}

      {progresso && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #93c5fd', borderTopColor: '#1e40af', animation: 'spin .8s linear infinite', flexShrink: 0 }} />
          {progresso}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <button onClick={exportarTudo} disabled={!!exportando}
        style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: exportando ? '#6b7280' : '#1e3a8a', color: 'white', fontSize: 15, fontWeight: 700, cursor: exportando ? 'not-allowed' : 'pointer', marginBottom: 20 }}>
        📦 Exportar Backup Completo (4 arquivos Excel formatados)
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
        {GRUPOS.map(g => (
          <div key={g.key} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: g.cor, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{g.icon}</span>
                <div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{g.key}.xlsx</div>
                  <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 11 }}>{g.abas.length} abas</div>
                </div>
              </div>
              <button onClick={() => exportarGrupo(g.key)} disabled={!!exportando}
                style={{ padding: '7px 16px', borderRadius: 8, border: '2px solid rgba(255,255,255,.5)', background: exportando === g.key ? 'rgba(255,255,255,.3)' : 'transparent', color: 'white', cursor: exportando ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {exportando === g.key ? '⏳' : '⬇ Baixar'}
              </button>
            </div>
            <div style={{ padding: '12px 16px' }}>
              {g.abas.map((aba, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < g.abas.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
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
