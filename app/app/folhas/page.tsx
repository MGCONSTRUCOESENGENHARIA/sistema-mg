'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Folha {
  id: string; obra_id: string; equipe: string; data: string
  tem_diaria_extra: boolean; observacao: string; processada: boolean
  criado_em: string; obras?: any
}

export default function FolhasPage() {
  const [folhas, setFolhas] = useState<Folha[]>([])
  const [loading, setLoading] = useState(true)
  const [obraFiltro, setObraFiltro] = useState('')
  const [equipeF, setEquipeF] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('folhas_ponto')
      .select('*, obras(nome,codigo)')
      .order('data', { ascending: true })
    setFolhas(data || [])
    setLoading(false)
  }

  async function marcarProcessada(id: string, val: boolean) {
    await supabase.from('folhas_ponto').update({ processada: val }).eq('id', id)
    setFolhas(prev => prev.map(f => f.id === id ? { ...f, processada: val } : f))
    setMsg(val ? '✅ Marcada como processada' : '↩ Desmarcada')
    setTimeout(() => setMsg(''), 2500)
  }

  async function deletar(id: string) {
    if (!confirm('Deletar esta folha?')) return
    await supabase.from('folhas_ponto').delete().eq('id', id)
    setFolhas(prev => prev.filter(f => f.id !== id))
  }

  const filtradas = folhas.filter(f => {
    if (obraFiltro && f.obra_id !== obraFiltro) return false
    if (equipeF && f.equipe !== equipeF) return false
    return true
  })

  // Agrupa por obra, mantendo ordem de data ASC dentro de cada obra
  const obrasMapa = new Map<string, { nome: string; codigo: string; folhas: Folha[] }>()
  filtradas.forEach(f => {
    if (!obrasMapa.has(f.obra_id)) {
      obrasMapa.set(f.obra_id, { nome: f.obras?.nome || 'Obra', codigo: f.obras?.codigo || '', folhas: [] })
    }
    obrasMapa.get(f.obra_id)!.folhas.push(f)
  })
  const obrasAgrupadas = Array.from(obrasMapa.entries())

  const obrasSelect = [...new Map(folhas.map(f => [f.obra_id, f.obras])).entries()]
    .map(([id, o]) => ({ id, ...o })).filter(o => o.nome)

  const totalFolhas = filtradas.length
  const comExtra = filtradas.filter(f => f.tem_diaria_extra).length
  const processadas = filtradas.filter(f => f.processada).length

  const tagEquipe = (equipe: string) => (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
      background: equipe === 'ARMAÇÃO' ? '#dbeafe' : '#fef9c3',
      color: equipe === 'ARMAÇÃO' ? '#1e40af' : '#92400e',
    }}>{equipe}</span>
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>Folhas de Ponto</h1>
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Geradas automaticamente pelo App Campo — encarregado lança, aparece aqui em tempo real</p>
      </div>

      {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#166534', fontSize: 13 }}>{msg}</div>}

      {/* Cards resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total de folhas', val: totalFolhas, cor: '#1e3a8a', bg: '#eff6ff' },
          { label: 'Com diária extra', val: comExtra, cor: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Processadas', val: processadas, cor: '#059669', bg: '#f0fdf4' },
        ].map((c, i) => (
          <div key={i} style={{ background: c.bg, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: c.cor, fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.cor }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}
          style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', fontSize: 13, background: 'white' }}>
          <option value="">Todas as obras</option>
          {obrasSelect.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select value={equipeF} onChange={e => setEquipeF(e.target.value)}
          style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', fontSize: 13, background: 'white' }}>
          <option value="">Todas as equipes</option>
          <option value="ARMAÇÃO">Armação</option>
          <option value="CARPINTARIA">Carpintaria</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhuma folha encontrada</div>
          <div style={{ fontSize: 13 }}>As folhas aparecem aqui quando o encarregado lança no App Campo</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {obrasAgrupadas.map(([obraId, { nome, codigo, folhas: fols }]) => {
            const mgCount = fols.filter(f => f.equipe === 'ARMAÇÃO').length
            const carpCount = fols.filter(f => f.equipe === 'CARPINTARIA').length
            return (
              <div key={obraId}>
                {/* Header da obra */}
                <div style={{
                  background: '#1a3a5c', color: '#fff', borderRadius: '10px 10px 0 0',
                  padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{nome}</span>
                    <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 8 }}>{fols.length} registro(s)</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {mgCount > 0 && <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>ARMAÇÃO {mgCount}</span>}
                    {carpCount > 0 && <span style={{ background: '#fef9c3', color: '#92400e', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>CARPINTARIA {carpCount}</span>}
                  </div>
                </div>

                {/* Cards das folhas */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 12, padding: 12, background: '#f8fafc', border: '1px solid #e5e7eb',
                  borderTop: 'none', borderRadius: '0 0 10px 10px'
                }}>
                  {fols.map(f => {
                    const linhas = (f.observacao || '').split('\n').filter(Boolean)
                    const dataFmt = new Date(f.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    const horario = new Date(f.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <div key={f.id} style={{
                        background: '#fff', borderRadius: 10, padding: '12px 14px',
                        border: `1px solid ${f.processada ? '#86efac' : '#e5e7eb'}`,
                        borderLeft: `4px solid ${f.processada ? '#22c55e' : f.equipe === 'ARMAÇÃO' ? '#3b82f6' : '#f59e0b'}`,
                      }}>
                        {/* Cabeçalho do card */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{dataFmt}</span>
                            {tagEquipe(f.equipe)}
                          </div>
                          {f.tem_diaria_extra && (
                            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 20, background: '#f5f3ff', color: '#7c3aed', fontWeight: 700 }}>⚡ Extra</span>
                          )}
                        </div>

                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>Lançado às {horario}</div>

                        {/* Conteúdo */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                          {linhas.map((linha, i) => {
                            const [chave, ...resto] = linha.split(':')
                            const valor = resto.join(':').trim()
                            return (
                              <div key={i}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{chave}</div>
                                <div style={{ fontSize: 12, color: '#1f2937', lineHeight: 1.4 }}>{valor}</div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Ações */}
                        <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
                          <button onClick={() => marcarProcessada(f.id, !f.processada)}
                            style={{
                              flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid #e5e7eb',
                              background: f.processada ? '#f0fdf4' : 'white', cursor: 'pointer',
                              fontSize: 11, fontWeight: 600, color: f.processada ? '#059669' : '#374151'
                            }}>
                            {f.processada ? '✓ Processada' : 'Marcar'}
                          </button>
                          <button onClick={() => deletar(f.id)}
                            style={{
                              padding: '5px 10px', borderRadius: 6, border: '1px solid #fecaca',
                              background: '#fef2f2', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#dc2626'
                            }}>
                            🗑
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
