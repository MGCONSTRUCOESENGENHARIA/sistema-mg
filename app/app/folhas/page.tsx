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

  const filtradas = folhas.filter(f => {
    if (obraFiltro && f.obra_id !== obraFiltro) return false
    if (equipeF && f.equipe !== equipeF) return false
    return true
  })

  const obras = [...new Map(folhas.map(f => [f.obra_id, f.obras])).entries()]
    .map(([id, o]) => ({ id, ...o })).filter(o => o.nome)

  const totalFolhas = filtradas.length
  const comExtra = filtradas.filter(f => f.tem_diaria_extra).length
  const processadas = filtradas.filter(f => f.processada).length

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#1f2937', marginBottom:4 }}>Folhas de Ponto</h1>
        <p style={{ fontSize:13, color:'#9ca3af' }}>Geradas automaticamente pelo App Campo — encarregado lança, aparece aqui em tempo real</p>
      </div>

      {msg && <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 14px', marginBottom:12, color:'#166534', fontSize:13 }}>{msg}</div>}

      {/* Cards resumo */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total de folhas', val:totalFolhas, cor:'#1e3a8a', bg:'#eff6ff' },
          { label:'Com diária extra', val:comExtra, cor:'#7c3aed', bg:'#f5f3ff' },
          { label:'Processadas', val:processadas, cor:'#059669', bg:'#f0fdf4' },
        ].map((c,i) => (
          <div key={i} style={{ background:c.bg, borderRadius:10, padding:'12px 14px', border:`1px solid ${c.bg}` }}>
            <div style={{ fontSize:11, color:c.cor, fontWeight:600, marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:c.cor }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <select value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}
          style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'7px 12px', fontSize:13, background:'white' }}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select value={equipeF} onChange={e => setEquipeF(e.target.value)}
          style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'7px 12px', fontSize:13, background:'white' }}>
          <option value="">Todas as equipes</option>
          <option value="ARMAÇÃO">Armação</option>
          <option value="CARPINTARIA">Carpintaria</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
          <div style={{ fontWeight:600, marginBottom:4 }}>Nenhuma folha encontrada</div>
          <div style={{ fontSize:13 }}>As folhas aparecem aqui quando o encarregado lança no App Campo</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtradas.map(f => {
            const aberta = expandida === f.id
            const linhas = (f.observacao || '').split('\n').filter(Boolean)
            return (
              <div key={f.id} style={{ background:'white', border:`1px solid ${f.processada?'#bbf7d0':'#e5e7eb'}`, borderRadius:12, overflow:'hidden' }}>
                {/* Header */}
                <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}
                  onClick={() => setExpandida(aberta ? null : f.id)}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700, fontSize:14, color:'#1f2937' }}>{f.obras?.nome || 'Obra'}</span>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background: f.equipe==='ARMAÇÃO'?'#eff6ff':'#fef3c7', color: f.equipe==='ARMAÇÃO'?'#1e40af':'#92400e', fontWeight:600 }}>{f.equipe}</span>
                      {f.tem_diaria_extra && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'#f5f3ff', color:'#7c3aed', fontWeight:600 }}>⚡ Extra</span>}
                      {f.processada && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'#f0fdf4', color:'#059669', fontWeight:600 }}>✓ Processada</span>}
                    </div>
                    <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
                      {new Date(f.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                      {' · '}
                      {new Date(f.criado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                  <div style={{ color:'#9ca3af', fontSize:18 }}>{aberta ? '▲' : '▼'}</div>
                </div>

                {/* Conteúdo expandido */}
                {aberta && (
                  <div style={{ borderTop:'1px solid #f3f4f6' }}>
                    <div style={{ padding:'14px 16px' }}>
                      {linhas.map((linha, i) => {
                        const [chave, ...resto] = linha.split(':')
                        const valor = resto.join(':').trim()
                        return (
                          <div key={i} style={{ marginBottom:10 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:3 }}>{chave}</div>
                            <div style={{ fontSize:13, color:'#1f2937', lineHeight:'1.5' }}>{valor}</div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ padding:'10px 16px', borderTop:'1px solid #f3f4f6', display:'flex', gap:8, background:'#f9fafb' }}>
                      <button onClick={() => marcarProcessada(f.id, !f.processada)}
                        style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', cursor:'pointer', fontSize:12, fontWeight:600, color: f.processada?'#374151':'#059669' }}>
                        {f.processada ? '↩ Desmarcar' : '✓ Marcar como processada'}
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
      )}
    </div>
  )
}
