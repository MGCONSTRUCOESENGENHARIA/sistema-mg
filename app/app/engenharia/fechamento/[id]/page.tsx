'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'
import Link from 'next/link'

interface Producao { id: string; servico: string; pavimento: string; unidade: string; quantidade: number; valor_unitario: number; percentual_medido: number; ordem: number }
interface Diaria { id: string; funcionario_id: string; nome: string; qtd_total: number; diarias_descontadas: number; valor_diaria: number; valor_passagem: number; complemento_passagem: number; total: number }
interface Distribuicao { id: string; funcionario_id?: string; nome: string; valor: number; observacao: string }

export default function FechamentoPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [fechamento, setFechamento] = useState<any>(null)
  const [producao, setProducao] = useState<Producao[]>([])
  const [diarias, setDiarias] = useState<Diaria[]>([])
  const [distribuicao, setDistribuicao] = useState<Distribuicao[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [novaLinha, setNovaLinha] = useState({ servico: '', pavimento: '', unidade: 'KG', quantidade: '', valor_unitario: '', percentual_medido: '' })

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    setLoading(true)
    const [{ data: fech }, { data: prod }, { data: diar }, { data: dist }] = await Promise.all([
      supabase.from('fechamentos').select('*, obras(id,nome,codigo)').eq('id', id).single(),
      supabase.from('fechamento_producao').select('*').eq('fechamento_id', id).order('ordem'),
      supabase.from('fechamento_diarias').select('*, funcionarios(nome)').eq('fechamento_id', id).order('total', { ascending: false }),
      supabase.from('fechamento_distribuicao').select('*').eq('fechamento_id', id),
    ])
    setFechamento(fech)
    setProducao(prod || [])
    setDiarias((diar || []).map((d: any) => ({ ...d, nome: d.funcionarios?.nome || '' })))
    setDistribuicao(dist || [])
    setLoading(false)
  }

  const saldoProducao = producao.reduce((s, p) => s + ((p.quantidade || 0) * (p.valor_unitario || 0)), 0)
  const totalDiarias = diarias.reduce((s, d) => s + (d.total || 0), 0)
  const saldoDistribuir = saldoProducao - totalDiarias
  const totalDistribuido = distribuicao.reduce((s, d) => s + (d.valor || 0), 0)
  const saldoRestante = saldoDistribuir - totalDistribuido

  async function atualizarTotais(sp: number, td: number) {
    await supabase.from('fechamentos').update({ saldo_producao: sp, total_diarias: td, saldo_distribuir: sp - td }).eq('id', id)
  }

  async function addProducao() {
    if (!novaLinha.servico || !novaLinha.quantidade || !novaLinha.valor_unitario) {
      setMsg('⚠️ Preencha serviço, quantidade e valor.'); setTimeout(() => setMsg(''), 3000); return
    }
    const ordem = (producao.length || 0) + 1
    await supabase.from('fechamento_producao').insert({
      fechamento_id: id, item: ordem, servico: novaLinha.servico,
      pavimento: novaLinha.pavimento, unidade: novaLinha.unidade,
      quantidade: parseFloat(novaLinha.quantidade), valor_unitario: parseFloat(novaLinha.valor_unitario),
      percentual_medido: parseFloat(novaLinha.percentual_medido) || 0, ordem,
    })
    setNovaLinha({ servico: '', pavimento: '', unidade: 'KG', quantidade: '', valor_unitario: '', percentual_medido: '' })
    await carregar()
    const sp = producao.reduce((s, p) => s + (p.quantidade || 0) * (p.valor_unitario || 0), 0) + parseFloat(novaLinha.quantidade) * parseFloat(novaLinha.valor_unitario)
    await atualizarTotais(sp, totalDiarias)
  }

  async function removeProducao(pid: string) {
    await supabase.from('fechamento_producao').delete().eq('id', pid)
    await carregar()
  }

  async function editProducao(pid: string, field: string, val: string) {
    await supabase.from('fechamento_producao').update({ [field]: parseFloat(val) || 0 }).eq('id', pid)
    await carregar()
  }

  async function carregarDiarias() {
    if (!fechamento) return
    setSalvando(true); setMsg('Buscando presenças...')
    const obraId = (fechamento.obras as any)?.id || fechamento.obra_id
    const { data: presencas } = await supabase.from('presencas')
      .select('funcionario_id, fracao, fracao2, tipo, obra_id, funcionarios(nome, valor_diaria)')
      .gte('data', fechamento.periodo_inicio).lte('data', fechamento.periodo_fim)
    const presObra = (presencas || []).filter((p: any) => p.obra_id === obraId)
    if (!presObra.length) { setMsg('⚠️ Nenhuma presença nesta obra no período.'); setSalvando(false); setTimeout(() => setMsg(''), 4000); return }
    const mapa: Record<string, { nome: string; dias: number; diaria: number }> = {}
    presObra.forEach((p: any) => {
      if (['FALTA', 'ATESTADO', 'AUSENTE', 'SAIU'].includes(p.tipo)) return
      const soma = (p.fracao || 0) + (p.fracao2 || 0)
      if (!mapa[p.funcionario_id]) mapa[p.funcionario_id] = { nome: (p.funcionarios as any)?.nome || '', dias: 0, diaria: (p.funcionarios as any)?.valor_diaria || 0 }
      mapa[p.funcionario_id].dias += soma
    })
    const funcIds = Object.keys(mapa)
    const { data: passagens } = await supabase.from('funcionario_obra_passagem').select('funcionario_id,valor_passagem,tipo_passagem').eq('obra_id', obraId).in('funcionario_id', funcIds)
    const passMap: Record<string, number> = {}
    passagens?.forEach((p: any) => { passMap[p.funcionario_id] = p.tipo_passagem === 'PRA FRENTE' ? (p.valor_passagem || 0) : 0 })
    let count = 0
    for (const [funcId, info] of Object.entries(mapa)) {
      const passagem = passMap[funcId] || 0
      const total = info.dias * (info.diaria + passagem)
      const { data: ex } = await supabase.from('fechamento_diarias').select('id').eq('fechamento_id', id).eq('funcionario_id', funcId).maybeSingle()
      if (ex) await supabase.from('fechamento_diarias').update({ qtd_total: info.dias, valor_diaria: info.diaria, valor_passagem: passagem, total }).eq('id', ex.id)
      else await supabase.from('fechamento_diarias').insert({ fechamento_id: id, funcionario_id: funcId, qtd_total: info.dias, diarias_descontadas: 0, valor_diaria: info.diaria, valor_passagem: passagem, complemento_passagem: 0, total })
      // Auto-preencher distribuição
      const { data: exDist } = await supabase.from('fechamento_distribuicao').select('id').eq('fechamento_id', id).eq('funcionario_id', funcId).maybeSingle()
      if (!exDist) await supabase.from('fechamento_distribuicao').insert({ fechamento_id: id, funcionario_id: funcId, nome: info.nome, valor: 0, observacao: '' })
      count++
    }
    await carregar()
    setMsg(`✅ ${count} funcionários carregados!`); setTimeout(() => setMsg(''), 3000)
    setSalvando(false)
  }

  async function updateDiaria(did: string, field: string, val: number) {
    const d = diarias.find(d => d.id === did); if (!d) return
    const upd: any = { ...d, [field]: val }
    const dias = Math.max(0, upd.qtd_total - upd.diarias_descontadas)
    const total = dias * (upd.valor_diaria + upd.valor_passagem + upd.complemento_passagem)
    await supabase.from('fechamento_diarias').update({ [field]: val, total: Math.max(0, total) }).eq('id', did)
    await carregar()
  }

  async function updateDistribuicao(did: string, field: string, val: string | number) {
    await supabase.from('fechamento_distribuicao').update({ [field]: val }).eq('id', did)
    await carregar()
  }

  async function addDistribuicaoManual() {
    await supabase.from('fechamento_distribuicao').insert({ fechamento_id: id, nome: 'Novo', valor: 0, observacao: '' })
    await carregar()
  }

  async function removeDist(did: string) { await supabase.from('fechamento_distribuicao').delete().eq('id', did); await carregar() }
  async function mudarStatus(status: string) { await supabase.from('fechamentos').update({ status }).eq('id', id); await carregar() }

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
  if (!fechamento) return <div style={{ textAlign: 'center', padding: 48 }}>Não encontrado.</div>

  const dataI = new Date(fechamento.periodo_inicio + 'T12:00').toLocaleDateString('pt-BR')
  const dataF = new Date(fechamento.periodo_fim + 'T12:00').toLocaleDateString('pt-BR')
  const inp = { border: '1.5px solid #e5e7eb', borderRadius: 4, padding: '3px 6px', fontSize: 12, textAlign: 'right' as const, outline: 'none', width: '100%', background: '#fefce8' }
  const inpRed = { ...inp, border: '1.5px solid #fca5a5', background: '#fef2f2' }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body { font-size: 11px; }
          .no-print { display: none !important; }
          .print-page { padding: 10px; }
          table { page-break-inside: avoid; }
          h2 { margin-top: 16px; }
        }
      `}</style>

      <div className="print-page">
        {/* Header */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/app/engenharia">
              <button style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: '#6b7280', fontSize: 13 }}>← Voltar</button>
            </Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1f2937' }}>Fechamento #{String(fechamento.numero).padStart(2, '0')} — {(fechamento.obras as any)?.nome}</h1>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: fechamento.status === 'APROVADO' ? '#d1fae5' : fechamento.status === 'FECHADO' ? '#f3f4f6' : '#fef3c7', color: fechamento.status === 'APROVADO' ? '#065f46' : fechamento.status === 'FECHADO' ? '#6b7280' : '#92400e' }}>
                  {fechamento.status}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>{dataI} até {dataF}{fechamento.encarregado ? ` · Enc: ${fechamento.encarregado}` : ''}{fechamento.descricao ? ` · ${fechamento.descricao}` : ''}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {fechamento.status === 'ABERTO' && <button onClick={() => mudarStatus('APROVADO')} style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✓ Aprovar</button>}
            {fechamento.status === 'APROVADO' && <button onClick={() => mudarStatus('ABERTO')} style={{ background: '#6b7280', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Reabrir</button>}
            <button onClick={() => window.print()} style={{ background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>🖨 Imprimir</button>
          </div>
        </div>

        {/* Cabeçalho de impressão */}
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #1e3a8a' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1e3a8a', margin: 0 }}>FECHAMENTO DE PRODUÇÃO #{String(fechamento.numero).padStart(2, '0')}</h1>
          <div style={{ display: 'flex', gap: 32, marginTop: 6, fontSize: 13, color: '#374151', flexWrap: 'wrap' }}>
            <span><strong>Obra:</strong> {(fechamento.obras as any)?.nome}</span>
            <span><strong>Período:</strong> {dataI} a {dataF}</span>
            {fechamento.encarregado && <span><strong>Encarregado:</strong> {fechamento.encarregado}</span>}
            {fechamento.descricao && <span><strong>Descrição:</strong> {fechamento.descricao}</span>}
          </div>
        </div>

        {msg && <div className="no-print" style={{ background: msg.includes('✅') ? '#f0fdf4' : '#fffbeb', border: `1px solid ${msg.includes('✅') ? '#bbf7d0' : '#fde68a'}`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 13, color: msg.includes('✅') ? '#166534' : '#92400e' }}>{msg}</div>}

        {/* Cards resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Saldo da Produção', val: saldoProducao, color: '#1e3a8a', bg: '#eff6ff' },
            { label: 'Total das Diárias', val: totalDiarias, color: '#dc2626', bg: '#fef2f2', neg: true },
            { label: 'Saldo p/ Distribuir', val: saldoDistribuir, color: saldoDistribuir >= 0 ? '#059669' : '#dc2626', bg: saldoDistribuir >= 0 ? '#f0fdf4' : '#fef2f2' },
            { label: 'Saldo Restante', val: saldoRestante, color: saldoRestante >= 0 ? '#059669' : '#dc2626', bg: saldoRestante >= 0 ? '#f0fdf4' : '#fef2f2' },
          ].map((c, i) => (
            <div key={i} style={{ background: c.bg, borderRadius: 10, padding: '12px 16px', border: `1px solid ${c.color}22` }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{(c as any).neg && totalDiarias > 0 ? '-' : ''}{formatR$(Math.abs(c.val))}</div>
            </div>
          ))}
        </div>

        {/* ══ SEÇÃO 1: LEVANTAMENTO DE PRODUÇÃO ══ */}
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 8, marginTop: 0, borderLeft: '4px solid #1e3a8a', paddingLeft: 10 }}>1. Levantamento de Produção</h2>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'auto', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1e3a8a' }}>
                {['Item', 'Serviço Executado', 'Pavimento', 'Un.', '% Med.', 'Quantidade', 'Valor Unit.', 'Valor Parcial', ''].map((h, i) => (
                  <th key={i} className={i >= 8 ? 'no-print' : ''} style={{ color: 'white', padding: '9px 12px', textAlign: i >= 4 && i <= 7 ? 'right' : 'left', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {producao.map((p, fi) => (
                <tr key={p.id} style={{ background: fi % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 12px', fontSize: 12, color: '#9ca3af', textAlign: 'center', width: 40 }}>{fi + 1}</td>
                  <td style={{ padding: '6px 12px', fontSize: 13, fontWeight: 500 }}>{p.servico}</td>
                  <td style={{ padding: '6px 12px', fontSize: 12, color: '#6b7280' }}>{p.pavimento}</td>
                  <td style={{ padding: '6px 12px', fontSize: 12, textAlign: 'center', width: 50 }}>{p.unidade}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', width: 70 }}>
                    <input type="number" defaultValue={p.percentual_medido || ''} placeholder="0" style={inp} onBlur={e => editProducao(p.id, 'percentual_medido', e.target.value)} />
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', width: 100 }}>
                    <input type="number" step="0.01" defaultValue={p.quantidade} style={inp} onBlur={e => editProducao(p.id, 'quantidade', e.target.value)} />
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', width: 100 }}>
                    <input type="number" step="0.01" defaultValue={p.valor_unitario} style={inp} onBlur={e => editProducao(p.id, 'valor_unitario', e.target.value)} />
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#1e3a8a', fontSize: 13 }}>{formatR$((p.quantidade || 0) * (p.valor_unitario || 0))}</td>
                  <td className="no-print" style={{ padding: '6px 8px', textAlign: 'center', width: 40 }}>
                    <button onClick={() => removeProducao(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18 }}>×</button>
                  </td>
                </tr>
              ))}
              {/* Nova linha */}
              <tr className="no-print" style={{ background: '#f0f9ff', borderTop: '2px dashed #bfdbfe' }}>
                <td style={{ padding: '6px 12px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>+</td>
                <td style={{ padding: '4px 8px' }}><input placeholder="Serviço..." style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '5px 8px', fontSize: 12, width: '100%', outline: 'none' }} value={novaLinha.servico} onChange={e => setNovaLinha(n => ({ ...n, servico: e.target.value }))} /></td>
                <td style={{ padding: '4px 8px' }}><input placeholder="Pavimento..." style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '5px 8px', fontSize: 12, width: '100%', outline: 'none' }} value={novaLinha.pavimento} onChange={e => setNovaLinha(n => ({ ...n, pavimento: e.target.value }))} /></td>
                <td style={{ padding: '4px 8px' }}>
                  <select style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '5px 4px', fontSize: 12, width: '100%' }} value={novaLinha.unidade} onChange={e => setNovaLinha(n => ({ ...n, unidade: e.target.value }))}>
                    <option>KG</option><option>M²</option><option>M³</option><option>M</option><option>UN</option>
                  </select>
                </td>
                <td style={{ padding: '4px 8px' }}><input type="number" placeholder="%" style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '5px 8px', fontSize: 12, width: '100%', textAlign: 'right', outline: 'none' }} value={novaLinha.percentual_medido} onChange={e => setNovaLinha(n => ({ ...n, percentual_medido: e.target.value }))} /></td>
                <td style={{ padding: '4px 8px' }}><input type="number" placeholder="0" style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '5px 8px', fontSize: 12, width: '100%', textAlign: 'right', outline: 'none' }} value={novaLinha.quantidade} onChange={e => setNovaLinha(n => ({ ...n, quantidade: e.target.value }))} /></td>
                <td style={{ padding: '4px 8px' }}><input type="number" placeholder="0,00" style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '5px 8px', fontSize: 12, width: '100%', textAlign: 'right', outline: 'none' }} value={novaLinha.valor_unitario} onChange={e => setNovaLinha(n => ({ ...n, valor_unitario: e.target.value }))} /></td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: 12, color: '#9ca3af' }}>{novaLinha.quantidade && novaLinha.valor_unitario ? formatR$(parseFloat(novaLinha.quantidade) * parseFloat(novaLinha.valor_unitario)) : '—'}</td>
                <td style={{ padding: '4px 8px' }}><button onClick={addProducao} style={{ background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Add</button></td>
              </tr>
            </tbody>
            <tfoot>
              <tr style={{ background: '#1e3a8a' }}>
                <td colSpan={7} style={{ padding: '10px 12px', color: 'white', fontWeight: 700, fontSize: 13 }}>SALDO DA PRODUÇÃO</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#93c5fd', fontWeight: 800, fontSize: 16 }}>{formatR$(saldoProducao)}</td>
                <td className="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ══ SEÇÃO 2: DESCONTO DE DIÁRIAS ══ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a', margin: 0, borderLeft: '4px solid #dc2626', paddingLeft: 10 }}>2. Desconto de Diárias</h2>
          <button className="no-print" onClick={carregarDiarias} disabled={salvando}
            style={{ background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {salvando ? '⏳ Carregando...' : '🔄 Carregar do sistema'}
          </button>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'auto', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#dc2626' }}>
                {['Nº', 'Nome', 'Qtd Total', 'Dias Desc.', 'Vl Diária', 'Vl Passagem', 'Complemento', 'Total'].map((h, i) => (
                  <th key={i} style={{ color: 'white', padding: '9px 12px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {diarias.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Clique em "Carregar do sistema" para buscar automaticamente.</td></tr>
              )}
              {diarias.map((d, fi) => {
                const diasEf = Math.max(0, d.qtd_total - d.diarias_descontadas)
                return (
                  <tr key={d.id} style={{ background: fi % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 12px', fontSize: 12, color: '#9ca3af', textAlign: 'center', width: 40 }}>{fi + 1}</td>
                    <td style={{ padding: '6px 12px', fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{d.nome}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#1e3a8a' }}>{d.qtd_total}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', width: 80 }}>
                      <input type="number" step="0.5" min="0" defaultValue={d.diarias_descontadas || 0} style={inpRed} onBlur={e => updateDiaria(d.id, 'diarias_descontadas', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', width: 90 }}>
                      <input type="number" step="0.01" defaultValue={d.valor_diaria} style={inp} onBlur={e => updateDiaria(d.id, 'valor_diaria', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', width: 90 }}>
                      <input type="number" step="0.01" defaultValue={d.valor_passagem} style={inp} onBlur={e => updateDiaria(d.id, 'valor_passagem', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', width: 90 }}>
                      <input type="number" step="0.01" defaultValue={d.complemento_passagem || 0} style={inp} onBlur={e => updateDiaria(d.id, 'complemento_passagem', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 13 }}>{formatR$(d.total)}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{diasEf} dias efetivos</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {diarias.length > 0 && (
              <tfoot>
                <tr style={{ background: '#dc2626' }}>
                  <td colSpan={7} style={{ padding: '10px 12px', color: 'white', fontWeight: 700, fontSize: 13 }}>TOTAL DAS DIÁRIAS</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fecaca', fontWeight: 800, fontSize: 16 }}>-{formatR$(totalDiarias)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ══ SEÇÃO 3: DISTRIBUIÇÃO ══ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#059669', margin: 0, borderLeft: '4px solid #059669', paddingLeft: 10 }}>3. Distribuição do Saldo</h2>
          <button className="no-print" onClick={addDistribuicaoManual}
            style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            + Adicionar linha
          </button>
        </div>

        {/* Mini resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
          {[
            { label: 'Saldo p/ Distribuir', val: saldoDistribuir, color: '#1e3a8a' },
            { label: 'Total Distribuído', val: totalDistribuido, color: '#92400e' },
            { label: 'Saldo Restante', val: saldoRestante, color: saldoRestante >= 0 ? '#059669' : '#dc2626' },
          ].map((c, i) => (
            <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{c.label}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: c.color }}>{formatR$(c.val)}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#059669' }}>
                {['Nº', 'Nome / Beneficiário', 'Valor (R$)', 'Observação', ''].map((h, i) => (
                  <th key={i} className={i === 4 ? 'no-print' : ''} style={{ color: 'white', padding: '9px 14px', textAlign: i === 2 ? 'right' : 'left', fontSize: 11, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {distribuicao.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  Carregue as diárias para preencher automaticamente, ou adicione linhas manualmente.
                </td></tr>
              )}
              {distribuicao.map((d, fi) => (
                <tr key={d.id} style={{ background: fi % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 14px', fontSize: 12, color: '#9ca3af', width: 40 }}>{fi + 1}</td>
                  <td style={{ padding: '4px 10px' }}>
                    <input
                      defaultValue={d.nome}
                      style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '5px 8px', fontSize: 13, width: '100%', outline: 'none', fontWeight: 600 }}
                      onBlur={e => updateDistribuicao(d.id, 'nome', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '4px 10px', width: 130 }}>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={d.valor || ''}
                      placeholder="0,00"
                      style={{ ...inp, border: '1.5px solid #059669', background: d.valor > 0 ? '#f0fdf4' : '#fefce8' }}
                      onBlur={e => updateDistribuicao(d.id, 'valor', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td style={{ padding: '4px 10px' }}>
                    <input
                      defaultValue={d.observacao || ''}
                      placeholder="Observação..."
                      style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '5px 8px', fontSize: 12, width: '100%', outline: 'none', color: '#6b7280' }}
                      onBlur={e => updateDistribuicao(d.id, 'observacao', e.target.value)}
                    />
                  </td>
                  <td className="no-print" style={{ padding: '6px 10px', textAlign: 'center', width: 40 }}>
                    <button onClick={() => removeDist(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18 }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {distribuicao.length > 0 && (
              <tfoot>
                <tr style={{ background: '#059669' }}>
                  <td colSpan={2} style={{ padding: '10px 14px', color: 'white', fontWeight: 700, fontSize: 13 }}>TOTAL DISTRIBUÍDO</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#d1fae5', fontWeight: 800, fontSize: 16 }}>{formatR$(totalDistribuido)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Assinaturas para impressão */}
        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 32 }}>
          {['Encarregado', 'Responsável Técnico', 'Aprovação'].map((label, i) => (
            <div key={i} style={{ borderTop: '1px solid #374151', paddingTop: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
