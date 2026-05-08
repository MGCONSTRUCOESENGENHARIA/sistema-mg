'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'

interface Diaria {
  id: string
  obra_id: string
  funcionario_id: string
  data: string
  tipo: string
  quantidade: number
  servico: string
  observacao: string
  descontada_producao: boolean
  recebida_medicao: boolean
  obras?: any
  funcionarios?: any
}

export default function DiariasPage() {
  const [diarias, setDiarias] = useState<Diaria[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [obraFiltro, setObraFiltro] = useState('')
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA' | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [modalDiaria, setModalDiaria] = useState<Diaria | null>(null)
  const [msg, setMsg] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    obra_id: '',
    funcionario_id: '',
    data: new Date().toISOString().slice(0, 10),
    tipo: 'CONTA_MG',
    quantidade: '1',
    servico: '',
    observacao: '',
  })

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)

    const [{ data: ds, error: diariaError }, { data: os }, { data: fs }] = await Promise.all([
      supabase
        .from('diarias_extras')
        .select('*, obras(nome,codigo), funcionarios(nome,equipe,valor_diaria)')
        .order('data', { ascending: true }),
      supabase
        .from('obras')
        .select('id,nome')
        .eq('status', 'ATIVA')
        .order('nome'),
      supabase
        .from('funcionarios')
        .select('id,nome,equipe')
        .eq('ativo', true)
        .order('nome'),
    ])

    if (diariaError) {
      alert('Erro ao carregar diárias: ' + diariaError.message)
      setDiarias([])
      setLoading(false)
      return
    }

    setDiarias(ds || [])
    setObras(os || [])
    setFuncs(fs || [])
    setLoading(false)
  }

  async function toggle(id: string, field: 'descontada_producao' | 'recebida_medicao', val: boolean) {
    const { error } = await supabase
      .from('diarias_extras')
      .update({ [field]: !val })
      .eq('id', id)

    if (error) {
      alert('Erro ao atualizar diária: ' + error.message)
      return
    }

    setDiarias(prev => prev.map(d => d.id === id ? { ...d, [field]: !val } : d))
    setModalDiaria(prev => prev?.id === id ? { ...prev, [field]: !val } : prev)
  }

  async function deletar(id: string) {
    if (!confirm('Deletar esta diária?')) return

    const { error } = await supabase
      .from('diarias_extras')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao deletar: ' + error.message)
      return
    }

    setDiarias(prev => prev.filter(d => d.id !== id))
    setModalDiaria(null)
  }

  async function salvarNova() {
    if (!form.obra_id || !form.funcionario_id || !form.data) {
      alert('Preencha obra, funcionário e data.')
      return
    }

    setSalvando(true)

    const { error } = await supabase.from('diarias_extras').insert({
      obra_id: form.obra_id,
      funcionario_id: form.funcionario_id,
      data: form.data,
      tipo: form.tipo,
      quantidade: parseFloat(form.quantidade) || 1,
      servico: form.servico,
      observacao: form.observacao,
      descontada_producao: false,
      recebida_medicao: false,
    })

    if (error) {
      alert('Erro ao salvar diária: ' + error.message)
      setSalvando(false)
      return
    }

    setShowForm(false)
    setForm({
      obra_id: '',
      funcionario_id: '',
      data: new Date().toISOString().slice(0, 10),
      tipo: 'CONTA_MG',
      quantidade: '1',
      servico: '',
      observacao: '',
    })
    setSalvando(false)
    setMsg('✅ Diária registrada!')
    setTimeout(() => setMsg(''), 3000)
    await carregar()
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

  function valorDiaria(d: Diaria) {
    return Number(d.quantidade || 0) * Number(d.funcionarios?.valor_diaria || 0)
  }

  function nomeTipo(tipo: string) {
    return tipo === 'CONTA_MG' ? 'Conta MG' : 'Conta Obra'
  }

  function corTipo(tipo: string) {
    if (tipo === 'CONTA_MG') {
      return { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' }
    }
    return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' }
  }

  const filtradas = diarias.filter(d => {
    if (obraFiltro && d.obra_id !== obraFiltro) return false
    if (equipe && d.funcionarios?.equipe !== equipe) return false
    return true
  })

  const totalValor = filtradas.reduce((s, d) => s + valorDiaria(d), 0)
  const totalQtd = filtradas.reduce((s, d) => s + Number(d.quantidade || 0), 0)
  const totalContaMG = filtradas.filter(d => d.tipo === 'CONTA_MG').length
  const totalContaObra = filtradas.filter(d => d.tipo !== 'CONTA_MG').length
  const totalDescProd = filtradas.filter(d => d.descontada_producao).length
  const totalRecMed = filtradas.filter(d => d.recebida_medicao).length

  const gruposPorObra = useMemo(() => {
    const grupos: Record<string, Diaria[]> = {}

    filtradas.forEach(d => {
      const nomeObra = d.obras?.nome || 'Sem obra'
      if (!grupos[nomeObra]) grupos[nomeObra] = []
      grupos[nomeObra].push(d)
    })

    return Object.entries(grupos)
      .map(([obra, itens]) => ({
        obra,
        itens: itens.sort((a, b) => String(a.data).localeCompare(String(b.data))),
        valor: itens.reduce((s, d) => s + valorDiaria(d), 0),
        qtd: itens.reduce((s, d) => s + Number(d.quantidade || 0), 0),
        contaMg: itens.filter(d => d.tipo === 'CONTA_MG').length,
        contaObra: itens.filter(d => d.tipo !== 'CONTA_MG').length,
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

  const linhaModal = (label: string, valor: any, color = '#111827') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 13, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color, textAlign: 'right' }}>{valor || '—'}</span>
    </div>
  )

  return (
    <div style={{ maxWidth: 1680, margin: '0 auto', padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111827', marginBottom: 4 }}>Diárias Extras</h1>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>
            {filtradas.length} registros · {totalQtd.toFixed(1)} diária(s) · Total: {formatR$(totalValor)}
          </p>
        </div>

        <button onClick={() => setShowForm(true)} style={{ background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
          + Nova Diária
        </button>
      </div>

      {msg && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, color: '#166534', fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total registros', val: filtradas.length, cor: '#1e3a8a', bg: '#eff6ff' },
          { label: 'Conta MG', val: totalContaMG, cor: '#1e40af', bg: '#eff6ff' },
          { label: 'Conta Obra', val: totalContaObra, cor: '#92400e', bg: '#fff7ed' },
          { label: 'Total valor', val: formatR$(totalValor), cor: '#065f46', bg: '#f0fdf4' },
        ].map((c, i) => (
          <div key={i} style={{ background: c.bg, borderRadius: 12, padding: '13px 16px' }}>
            <div style={{ fontSize: 11, color: c.cor, fontWeight: 700, marginBottom: 5 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c.cor }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={obraFiltro} onChange={e => setObraFiltro(e.target.value)} style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', flex: 1, minWidth: 260 }}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 6 }}>
          {(['', 'ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
            <button key={eq || 'TODAS'} onClick={() => setEquipe(eq)} style={btnEquipe(eq)}>{eq || 'Todas'}</button>
          ))}
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>Desc. produção: {totalDescProd} · Rec. medição: {totalRecMed}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 700 }}>Nenhuma diária encontrada.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {gruposPorObra.map(grupo => (
            <section key={grupo.obra} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: '#1e3a8a', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase' }}>{grupo.obra}</div>
                  <div style={{ fontSize: 11, opacity: .75, marginTop: 2 }}>{grupo.itens.length} registro(s) · {grupo.qtd.toFixed(1)} diária(s) · {formatR$(grupo.valor)}</div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {grupo.contaMg > 0 && <span style={{ background: '#eff6ff', color: '#1e40af', padding: '3px 8px', borderRadius: 999, fontWeight: 800 }}>MG {grupo.contaMg}</span>}
                  {grupo.contaObra > 0 && <span style={{ background: '#fff7ed', color: '#92400e', padding: '3px 8px', borderRadius: 999, fontWeight: 800 }}>Obra {grupo.contaObra}</span>}
                </div>
              </div>

              <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
                {grupo.itens.map(d => {
                  const tipoCor = corTipo(d.tipo)
                  const valor = valorDiaria(d)

                  return (
                    <div key={d.id} onClick={() => setModalDiaria(d)} style={{ border: `1px solid ${d.recebida_medicao ? '#86efac' : d.descontada_producao ? '#fbbf24' : '#e5e7eb'}`, borderRadius: 12, background: '#fff', boxShadow: '0 1px 4px rgba(15,23,42,.06)', overflow: 'hidden', cursor: 'pointer' }}>
                      <div style={{ padding: '11px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: '#111827' }}>{dataCurta(d.data)}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{d.funcionarios?.nome || '—'}</div>
                        </div>
                        <span style={{ background: tipoCor.bg, color: tipoCor.color, border: `1px solid ${tipoCor.border}`, fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 999, height: 'fit-content', whiteSpace: 'nowrap' }}>{nomeTipo(d.tipo)}</span>
                      </div>

                      <div style={{ padding: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 9 }}>
                            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>Qtd</div>
                            <div style={{ fontSize: 15, color: '#1e3a8a', fontWeight: 900 }}>{Number(d.quantidade || 0)}</div>
                          </div>
                          <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 9 }}>
                            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>Valor</div>
                            <div style={{ fontSize: 15, color: '#065f46', fontWeight: 900 }}>{formatR$(valor)}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, marginBottom: 4 }}>Serviço</div>
                        <div style={{ fontSize: 12, color: '#111827', minHeight: 34, lineHeight: 1.35 }}>{d.servico || '—'}</div>
                      </div>

                      <div style={{ padding: '9px 12px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, alignItems: 'center', background: '#f9fafb' }}>
                        <label onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>
                          <input type="checkbox" checked={d.descontada_producao} onChange={() => toggle(d.id, 'descontada_producao', d.descontada_producao)} style={{ cursor: 'pointer', accentColor: '#1e3a8a' }} />
                          Desc.
                        </label>
                        <label onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>
                          <input type="checkbox" checked={d.recebida_medicao} onChange={() => toggle(d.id, 'recebida_medicao', d.recebida_medicao)} style={{ cursor: 'pointer', accentColor: '#059669' }} />
                          Rec.
                        </label>
                        <span style={badgeEquipe(d.funcionarios?.equipe || '')}>{d.funcionarios?.equipe || '—'}</span>
                        <button onClick={e => { e.stopPropagation(); deletar(d.id) }} style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>🗑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {modalDiaria && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setModalDiaria(null)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#1e3a8a', color: '#fff', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900 }}>{modalDiaria.funcionarios?.nome || 'Funcionário'}</div>
                <div style={{ fontSize: 12, opacity: .75 }}>{modalDiaria.obras?.nome || 'Sem obra'}</div>
              </div>
              <button onClick={() => setModalDiaria(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={badgeEquipe(modalDiaria.funcionarios?.equipe || '')}>{modalDiaria.funcionarios?.equipe || '—'}</span>
                <span style={{ background: corTipo(modalDiaria.tipo).bg, color: corTipo(modalDiaria.tipo).color, border: `1px solid ${corTipo(modalDiaria.tipo).border}`, fontSize: 11, fontWeight: 900, padding: '4px 9px', borderRadius: 999 }}>{nomeTipo(modalDiaria.tipo)}</span>
              </div>
              {linhaModal('Data', dataLonga(modalDiaria.data))}
              {linhaModal('Quantidade', modalDiaria.quantidade)}
              {linhaModal('Valor diária', formatR$(modalDiaria.funcionarios?.valor_diaria || 0))}
              {linhaModal('Valor total', formatR$(valorDiaria(modalDiaria)), '#065f46')}
              {linhaModal('Serviço', modalDiaria.servico || '—')}
              {modalDiaria.observacao && linhaModal('Observação', modalDiaria.observacao)}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
                <label style={{ background: modalDiaria.descontada_producao ? '#eff6ff' : '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: modalDiaria.descontada_producao ? '#1e40af' : '#64748b' }}>
                  <input type="checkbox" checked={modalDiaria.descontada_producao} onChange={() => toggle(modalDiaria.id, 'descontada_producao', modalDiaria.descontada_producao)} style={{ accentColor: '#1e3a8a' }} />
                  Desc. produção
                </label>
                <label style={{ background: modalDiaria.recebida_medicao ? '#f0fdf4' : '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: modalDiaria.recebida_medicao ? '#166534' : '#64748b' }}>
                  <input type="checkbox" checked={modalDiaria.recebida_medicao} onChange={() => toggle(modalDiaria.id, 'recebida_medicao', modalDiaria.recebida_medicao)} style={{ accentColor: '#059669' }} />
                  Rec. medição
                </label>
              </div>
            </div>
            <div style={{ padding: '14px 18px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f9fafb' }}>
              <button onClick={() => deletar(modalDiaria.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#dc2626' }}>🗑 Deletar</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Nova Diária Extra</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Obra', el: <select value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))} style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}><option value="">Selecione...</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}</select> },
                { label: 'Funcionário', el: <select value={form.funcionario_id} onChange={e => setForm(f => ({ ...f, funcionario_id: e.target.value }))} style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}><option value="">Selecione...</option>{funcs.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select> },
                { label: 'Data', el: <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} /> },
                { label: 'Tipo', el: <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}><option value="CONTA_MG">Conta MG</option><option value="CONTA_OBRA">Conta Obra</option></select> },
                { label: 'Quantidade', el: <input type="number" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} step="0.5" /> },
                { label: 'Serviço', el: <input value={form.servico} onChange={e => setForm(f => ({ ...f, servico: e.target.value }))} style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} placeholder="Descrição do serviço..." /> },
                { label: 'Observação', el: <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} style={{ width: '100%', height: 80, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', resize: 'none' }} placeholder="Observação opcional..." /> },
              ].map(({ label, el }) => <div key={label}><label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>{label}</label>{el}</div>)}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={salvarNova} disabled={salvando} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1e3a8a', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
