'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'
import Link from 'next/link'

export default function EngenhariaPage() {
  const [obras, setObras] = useState<any[]>([])
  const [fechamentos, setFechamentos] = useState<any[]>([])
  const [obraFiltro, setObraFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState({ obra_id: '', numero: '', encarregado: '', descricao: '', periodo_inicio: '', periodo_fim: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: os }, { data: fs }] = await Promise.all([
      supabase.from('obras').select('id,nome,codigo').eq('status', 'ATIVA').order('nome'),
      supabase.from('fechamentos').select('*, obras(nome,codigo)').order('criado_em', { ascending: false }),
    ])
    setObras(os || [])
    setFechamentos(fs || [])
    setLoading(false)
  }

  async function criarFechamento() {
    if (!form.obra_id || !form.numero || !form.periodo_inicio || !form.periodo_fim) {
      setMsg('Preencha todos os campos obrigatórios.'); return
    }
    const { error } = await supabase.from('fechamentos').insert({
      obra_id: form.obra_id, numero: parseInt(form.numero),
      encarregado: form.encarregado, descricao: form.descricao,
      periodo_inicio: form.periodo_inicio, periodo_fim: form.periodo_fim,
    })
    if (error) { setMsg('Erro: ' + (error.message.includes('unique') ? 'Já existe fechamento com este número para esta obra.' : error.message)); return }
    setMsg('✅ Fechamento criado!')
    setTimeout(() => setMsg(''), 3000)
    setCriando(false)
    setForm({ obra_id: '', numero: '', encarregado: '', descricao: '', periodo_inicio: '', periodo_fim: '' })
    await carregar()
  }

  const filtrados = fechamentos.filter(f => !obraFiltro || f.obra_id === obraFiltro)

  const corStatus: Record<string, { bg: string; color: string }> = {
    ABERTO: { bg: '#fef3c7', color: '#92400e' },
    APROVADO: { bg: '#d1fae5', color: '#065f46' },
    FECHADO: { bg: '#f3f4f6', color: '#6b7280' },
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>Produção por Obra</h1>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>Fechamentos de produção, desconto de diárias e distribuição</p>
        </div>
        <button onClick={() => setCriando(true)}
          style={{ background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          + Novo Fechamento
        </button>
      </div>

      {msg && (
        <div style={{ background: msg.includes('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.includes('✅') ? '#bbf7d0' : '#fecaca'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: msg.includes('✅') ? '#166534' : '#991b1b', fontSize: 13 }}>
          {msg}
        </div>
      )}

      {/* Modal novo fechamento */}
      {criando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>Novo Fechamento de Produção</h2>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Obra *</label>
                  <select style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                    value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Nº Fechamento *</label>
                  <input type="number" min="1" style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                    placeholder="01" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Encarregado</label>
                <input style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                  placeholder="Nome do encarregado" value={form.encarregado} onChange={e => setForm(f => ({ ...f, encarregado: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Período início *</label>
                  <input type="date" style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                    value={form.periodo_inicio} onChange={e => setForm(f => ({ ...f, periodo_inicio: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Período fim *</label>
                  <input type="date" style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                    value={form.periodo_fim} onChange={e => setForm(f => ({ ...f, periodo_fim: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Descrição</label>
                <input style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                  placeholder="Ex: 4º Pavimento" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setCriando(false); setMsg('') }}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={criarFechamento}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1e3a8a', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Criar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtro por obra */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Filtrar por obra:</label>
        <select style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 13, minWidth: 220 }}
          value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{filtrados.length} fechamentos</span>
      </div>

      {/* Lista de fechamentos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏗️</div>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Nenhum fechamento ainda. Crie o primeiro acima.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(f => {
            const cor = corStatus[f.status] || corStatus.ABERTO
            const dataInicio = new Date(f.periodo_inicio + 'T12:00').toLocaleDateString('pt-BR')
            const dataFim = new Date(f.periodo_fim + 'T12:00').toLocaleDateString('pt-BR')
            return (
              <Link key={f.id} href={`/app/engenharia/fechamento/${f.id}`}>
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer', transition: 'all .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1e3a8a'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(30,58,138,.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
                  {/* Número */}
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#1e3a8a' }}>#{String(f.numero).padStart(2, '0')}</span>
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>{(f.obras as any)?.nome}</span>
                      <span style={{ background: cor.bg, color: cor.color, fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20 }}>{f.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span>📅 {dataInicio} até {dataFim}</span>
                      {f.encarregado && <span>👷 {f.encarregado}</span>}
                      {f.descricao && <span>📝 {f.descricao}</span>}
                    </div>
                  </div>
                  {/* Valores */}
                  <div style={{ display: 'flex', gap: 24, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>Saldo produção</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1e3a8a' }}>{formatR$(f.saldo_producao || 0)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>Total diárias</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>-{formatR$(f.total_diarias || 0)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>Saldo distribuir</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#059669' }}>{formatR$(f.saldo_distribuir || 0)}</div>
                    </div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
