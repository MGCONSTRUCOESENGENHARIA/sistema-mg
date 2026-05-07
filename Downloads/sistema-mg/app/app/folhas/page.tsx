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
  const [equipeF, setEquipeF] = useState<'TODAS'|'ARMAÇÃO'|'CARPINTARIA'>('TODAS')
  const [expandida, setExpandida] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('folhas_ponto')
      .select('*, obras(nome,codigo)')
      .order('data', { ascending: false })
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

  const filtradas = equipeF === 'TODAS' ? folhas : folhas.filter(f => f.equipe === equipeF)

  // Agrupar por obra
  const porObra: Record<string, { nome: string; codigo: string; folhas: Folha[] }> = {}
  filtradas.forEach(f => {
    const obraId = f.obra_id
    if (!porObra[obraId]) {
      porObra[obraId] = { nome: f.obras?.nome || 'Obra', codigo: f.obras?.codigo || '', folhas: [] }
    }
    porObra[obraId].folhas.push(f)
  })

  const obras = Object.entries(porObra).sort((a, b) => a[1].nome.localeCompare(b[1].nome))

  const CORES = ['#1e3a8a','#065f46','#7c3aed','#92400e','#0891b2','#dc2626','#059669','#4f46e5']

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>Folhas de Ponto</h1>
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Geradas automaticamente pelo App Campo — organizadas por obra</p>
      </div>

      {msg && <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', marginBottom:12, color:'#166534', fontSize:13 }}>{msg}</div>}

      {/* Resumo */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total de folhas', val: filtradas.length, cor:'#1e3a8a', bg:'#eff6ff' },
          { label:'Com diária extra', val: filtradas.filter(f=>f.tem_diaria_extra).length, cor:'#7c3aed', bg:'#f5f3ff' },
          { label:'Processadas', val: filtradas.filter(f=>f.processada).length, cor:'#059669', bg:'#f0fdf4' },
        ].map((c,i) => (
          <div key={i} style={{ background:c.bg, borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:c.cor, fontWeight:600, marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:c.cor }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Filtro equipe */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {(['TODAS','ARMAÇÃO','CARPINTARIA'] as const).map(eq => (
          <button key={eq} onClick={() => setEquipeF(eq)}
            style={{ padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background: equipeF===eq ? '#1e3a8a' : '#f3f4f6',
              color: equipeF===eq ? 'white' : '#6b7280' }}>
            {eq}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>Carregando...</div>
      ) : obras.length === 0 ? (
        <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
          <div style={{ fontWeight:600 }}>Nenhuma folha encontrada</div>
          <div style={{ fontSize:13, marginTop:4 }}>As folhas aparecem quando o encarregado lança no App Campo</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {obras.map(([obraId, info], idx) => (
            <div key={obraId} style={{ border:'1px solid #e5e7eb', borderRadius:14, overflow:'hidden' }}>
              {/* Header da obra */}
              <div style={{ background:CORES[idx % CORES.length], padding:'12px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ color:'white', fontWeight:700, fontSize:15 }}>{info.nome}</div>
                  <div style={{ color:'rgba(255,255,255,.6)', fontSize:12 }}>{info.folhas.length} folha{info.folhas.length!==1?'s':''} · {info.folhas.filter(f=>f.tem_diaria_extra).length} com extra</div>
                </div>
                <div style={{ background:'rgba(255,255,255,.2)', borderRadius:20, padding:'3px 12px', color:'white', fontSize:13, fontWeight:700 }}>
                  {info.folhas.filter(f=>f.processada).length}/{info.folhas.length} processadas
                </div>
              </div>

              {/* Folhas da obra */}
              <div>
                {info.folhas.map(f => {
                  const aberta = expandida === f.id
                  const linhas = (f.observacao || '').split('\n').filter(Boolean)
                  return (
                    <div key={f.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                      <div style={{ padding:'12px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', background: f.processada?'#f0fdf4':'white' }}
                        onClick={() => setExpandida(aberta ? null : f.id)}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                            <span style={{ fontWeight:600, fontSize:14, color:'#1f2937' }}>
                              {new Date(f.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}
                            </span>
                            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:f.equipe==='ARMAÇÃO'?'#eff6ff':'#fef3c7', color:f.equipe==='ARMAÇÃO'?'#1e40af':'#92400e', fontWeight:600 }}>{f.equipe}</span>
                            {f.tem_diaria_extra && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'#f5f3ff', color:'#7c3aed', fontWeight:600 }}>⚡ Extra</span>}
                            {f.processada && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'#f0fdf4', color:'#059669', fontWeight:600 }}>✓ Processada</span>}
                          </div>
                          <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
                            Lançado às {new Date(f.criado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
                          </div>
                        </div>
                        <div style={{ color:'#9ca3af', fontSize:18 }}>{aberta ? '▲' : '▼'}</div>
                      </div>

                      {aberta && (
                        <div style={{ borderTop:'1px solid #f3f4f6' }}>
                          <div style={{ padding:'14px 18px' }}>
                            {linhas.map((linha, i) => {
                              const colonIdx = linha.indexOf(':')
                              const chave = colonIdx > -1 ? linha.slice(0, colonIdx) : linha
                              const valor = colonIdx > -1 ? linha.slice(colonIdx + 1).trim() : ''
                              return (
                                <div key={i} style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:3 }}>{chave}</div>
                                  <div style={{ fontSize:13, color:'#1f2937', lineHeight:'1.5' }}>{valor}</div>
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ padding:'10px 18px', borderTop:'1px solid #f3f4f6', display:'flex', gap:8, background:'#f9fafb' }}>
                            <button onClick={() => marcarProcessada(f.id, !f.processada)}
                              style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', cursor:'pointer', fontSize:12, fontWeight:600, color:f.processada?'#374151':'#059669' }}>
                              {f.processada ? '↩ Desmarcar' : '✓ Processada'}
                            </button>
                            <button onClick={() => deletar(f.id)}
                              style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #fecaca', background:'#fef2f2', cursor:'pointer', fontSize:12, fontWeight:600, color:'#dc2626' }}>
                              🗑 Deletar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
