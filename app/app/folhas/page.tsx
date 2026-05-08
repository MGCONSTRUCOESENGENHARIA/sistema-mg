'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Folha {
  id: string
  obra_id: string
  equipe: string
  data: string
  tem_diaria_extra: boolean
  observacao: string
  processada: boolean
  criado_em: string
  obras?: { nome?: string; codigo?: string } | null
  imagem_url?: string | null
  foto_url?: string | null
  arquivo_url?: string | null
  url_imagem?: string | null
  image_url?: string | null
  public_url?: string | null
}

export default function FolhasPage() {
  const [folhas, setFolhas] = useState<Folha[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [obraFiltro, setObraFiltro] = useState('')
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA' | ''>('')
  const [modalFolha, setModalFolha] = useState<Folha | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)

    const [{ data: fs, error: folhasError }, { data: os }] = await Promise.all([
      supabase
        .from('folhas_ponto')
        .select('*, obras(nome,codigo)')
        .order('data', { ascending: false }),
      supabase
        .from('obras')
        .select('id,nome')
        .eq('status', 'ATIVA')
        .order('nome'),
    ])

    if (folhasError) {
      alert('Erro ao carregar folhas: ' + folhasError.message)
      setFolhas([])
      setLoading(false)
      return
    }

    setFolhas(fs || [])
    setObras(os || [])
    setLoading(false)
  }

  async function marcarProcessada(id: string, val: boolean) {
    const { error } = await supabase
      .from('folhas_ponto')
      .update({ processada: val })
      .eq('id', id)

    if (error) {
      alert('Erro ao atualizar folha: ' + error.message)
      return
    }

    setFolhas(prev => prev.map(f => f.id === id ? { ...f, processada: val } : f))
    setModalFolha(prev => prev?.id === id ? { ...prev, processada: val } : prev)
    setMsg(val ? '✅ Marcada como processada' : '↩ Desmarcada')
    setTimeout(() => setMsg(''), 2500)
  }

  async function deletar(id: string) {
    if (!confirm('Deletar esta folha?')) return

    const { error } = await supabase
      .from('folhas_ponto')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao deletar: ' + error.message)
      return
    }

    setFolhas(prev => prev.filter(f => f.id !== id))
    setModalFolha(null)
  }

  function dataCurta(data: string) {
    return new Date(data + 'T12:00').toLocaleDateString('pt-BR')
  }

  function dataLonga(data: string) {
    return new Date(data + 'T12:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  function horaCriacao(data: string) {
    return new Date(data).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function urlFolha(f: Folha) {
    return (
      f.imagem_url ||
      f.foto_url ||
      f.arquivo_url ||
      f.url_imagem ||
      f.image_url ||
      f.public_url ||
      ''
    )
  }

  const filtradas = folhas.filter(f => {
    if (obraFiltro && f.obra_id !== obraFiltro) return false
    if (equipe && f.equipe !== equipe) return false
    return true
  })

  const totais = {
    total: filtradas.length,
    extra: filtradas.filter(f => f.tem_diaria_extra).length,
    proc: filtradas.filter(f => f.processada).length,
    pend: filtradas.filter(f => !f.processada).length,
  }

  const gruposPorObra = useMemo(() => {
    const grupos: Record<string, Folha[]> = {}

    filtradas.forEach(f => {
      const nomeObra = f.obras?.nome || 'Sem obra'
      if (!grupos[nomeObra]) grupos[nomeObra] = []
      grupos[nomeObra].push(f)
    })

    return Object.entries(grupos)
      .map(([obra, itens]) => ({
        obra,
        itens: itens.sort((a, b) => String(b.data).localeCompare(String(a.data))),
      }))
      .sort((a, b) => a.obra.localeCompare(b.obra))
  }, [filtradas])

  const btnEquipe = (eq: '' | 'ARMAÇÃO' | 'CARPINTARIA') => ({
    padding: '8px 16px',
    borderRadius: 8,
    border: equipe === eq ? '1px solid #1e3a8a' : '1px solid #e5e7eb',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    background: equipe === eq ? '#1e3a8a' : '#fff',
    color: equipe === eq ? '#fff' : '#6b7280',
  })

  const badgeEquipe = (eq: string) => ({
    background: eq === 'ARMAÇÃO' ? '#eff6ff' : '#fef3c7',
    color: eq === 'ARMAÇÃO' ? '#1e40af' : '#92400e',
    fontSize: 10,
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: 999,
    textTransform: 'uppercase' as const,
  })

  return (
    <div style={{ maxWidth: 1680, margin: '0 auto', padding: '18px 22px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111827', marginBottom: 4 }}>
          Folhas de Ponto
        </h1>
        <p style={{ fontSize: 13, color: '#9ca3af' }}>
          Geradas automaticamente pelo App Campo
        </p>
      </div>

      {msg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, color: '#166534', fontSize: 13 }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total', val: totais.total, cor: '#1e3a8a', bg: '#eff6ff' },
          { label: 'Com extra', val: totais.extra, cor: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Processadas', val: totais.proc, cor: '#059669', bg: '#f0fdf4' },
          { label: 'Pendentes', val: totais.pend, cor: '#92400e', bg: '#fff7ed' },
        ].map((c, i) => (
          <div key={i} style={{ background: c.bg, borderRadius: 12, padding: '13px 16px' }}>
            <div style={{ fontSize: 11, color: c.cor, fontWeight: 700, marginBottom: 5 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c.cor }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={obraFiltro}
          onChange={e => setObraFiltro(e.target.value)}
          style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', flex: 1, minWidth: 260 }}
        >
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 6 }}>
          {(['', 'ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
            <button key={eq || 'TODAS'} onClick={() => setEquipe(eq)} style={btnEquipe(eq)}>
              {eq || 'Todas'}
            </button>
          ))}
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
          {filtradas.length} folha(s)
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 700 }}>Nenhuma folha encontrada</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {gruposPorObra.map(grupo => {
            const extras = grupo.itens.filter(f => f.tem_diaria_extra).length
            const processadas = grupo.itens.filter(f => f.processada).length

            return (
              <section key={grupo.obra} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ background: '#1e3a8a', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase' }}>
                    {grupo.obra}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}>
                    <span style={{ opacity: .8 }}>{grupo.itens.length} folha(s)</span>
                    {extras > 0 && (
                      <span style={{ background: '#fff7ed', color: '#92400e', padding: '3px 8px', borderRadius: 999, fontWeight: 800 }}>
                        ⚡ {extras} com extra
                      </span>
                    )}
                    {processadas > 0 && (
                      <span style={{ background: '#f0fdf4', color: '#166534', padding: '3px 8px', borderRadius: 999, fontWeight: 800 }}>
                        ✓ {processadas} processada(s)
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ padding: 16, display: 'flex', gap: 14, overflowX: 'auto', minHeight: 240 }}>
                  {grupo.itens.map(f => {
                    const img = urlFolha(f)

                    return (
                      <div
                        key={f.id}
                        onClick={() => setModalFolha(f)}
                        style={{
                          width: 150,
                          flex: '0 0 150px',
                          background: '#fff',
                          border: `1px solid ${f.tem_diaria_extra ? '#fbbf24' : f.processada ? '#86efac' : '#e5e7eb'}`,
                          borderRadius: 10,
                          overflow: 'hidden',
                          boxShadow: '0 1px 4px rgba(15,23,42,.08)',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        <div style={{ height: 128, background: '#f3f4f6', overflow: 'hidden', position: 'relative' }}>
                          {img ? (
                            <img
                              src={img}
                              alt={`Folha ${dataCurta(f.data)}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 32 }}>
                              📄
                            </div>
                          )}

                          {f.tem_diaria_extra && (
                            <span style={{ position: 'absolute', top: 8, left: 8, background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 900, padding: '3px 9px', borderRadius: 999 }}>
                              EXTRA
                            </span>
                          )}

                          {f.processada && (
                            <span style={{ position: 'absolute', top: 8, right: 8, background: '#16a34a', color: '#fff', fontSize: 10, fontWeight: 900, padding: '3px 7px', borderRadius: 999 }}>
                              ✓
                            </span>
                          )}
                        </div>

                        <div style={{ padding: '9px 10px' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#1f2937', marginBottom: 3 }}>
                            {dataCurta(f.data)}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                            <span style={badgeEquipe(f.equipe)}>{f.equipe}</span>
                          </div>

                          <div style={{ display: 'flex', gap: 5 }}>
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                marcarProcessada(f.id, !f.processada)
                              }}
                              style={{
                                flex: 1,
                                padding: '5px 6px',
                                borderRadius: 6,
                                border: '1px solid #e5e7eb',
                                background: f.processada ? '#f0fdf4' : '#fff',
                                color: f.processada ? '#166534' : '#6b7280',
                                cursor: 'pointer',
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              {f.processada ? 'Ok' : 'Pendente'}
                            </button>

                            <button
                              onClick={e => {
                                e.stopPropagation()
                                deletar(f.id)
                              }}
                              style={{
                                width: 28,
                                padding: '5px 0',
                                borderRadius: 6,
                                border: '1px solid #fecaca',
                                background: '#fff',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {modalFolha && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.58)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
          onClick={() => setModalFolha(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 980, maxHeight: '92vh', background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(320px,1.2fr) minmax(280px,.8fr)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#111827', minHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
              {urlFolha(modalFolha) ? (
                <img
                  src={urlFolha(modalFolha)}
                  alt={`Folha ${dataCurta(modalFolha.data)}`}
                  style={{ maxWidth: '100%', maxHeight: '88vh', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ color: '#d1d5db', textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 52, marginBottom: 10 }}>📄</div>
                  <div>Esta folha não possui imagem vinculada.</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 520 }}>
              <div style={{ background: '#1e3a8a', color: '#fff', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>{modalFolha.obras?.nome || 'Sem obra'}</div>
                  <div style={{ fontSize: 12, opacity: .75 }}>{dataLonga(modalFolha.data)}</div>
                </div>
                <button onClick={() => setModalFolha(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ padding: 18, overflow: 'auto', flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span style={badgeEquipe(modalFolha.equipe)}>{modalFolha.equipe}</span>
                  {modalFolha.tem_diaria_extra && (
                    <span style={{ background: '#fff7ed', color: '#92400e', fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999 }}>⚡ Extra</span>
                  )}
                  {modalFolha.processada && (
                    <span style={{ background: '#f0fdf4', color: '#166534', fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999 }}>✓ Processada</span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
                  Criada às {horaCriacao(modalFolha.criado_em)}
                </div>

                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 8 }}>Observações</div>
                  {(modalFolha.observacao || '').trim() ? (
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55, color: '#1f2937', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                      {modalFolha.observacao}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#9ca3af' }}>Sem observações.</div>
                  )}
                </div>
              </div>

              <div style={{ padding: 14, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end', background: '#f9fafb' }}>
                <button
                  onClick={() => marcarProcessada(modalFolha.id, !modalFolha.processada)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 800,
                    color: modalFolha.processada ? '#374151' : '#059669',
                  }}
                >
                  {modalFolha.processada ? '↩ Desmarcar' : '✓ Processada'}
                </button>

                <button
                  onClick={() => deletar(modalFolha.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#dc2626',
                  }}
                >
                  🗑 Deletar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
