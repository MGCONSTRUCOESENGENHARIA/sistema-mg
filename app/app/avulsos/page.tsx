'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$ } from '@/lib/utils'

type AvulsoTipo = 'Vale' | 'Empréstimo' | 'Adiantamento' | 'Materiais' | 'Pensão'
type QuandoDescontar = 'adiantamento' | 'pagamento_final'

interface Avulso {
  id: string; funcionario_id: string; competencia_id: string;
  data: string; tipo: AvulsoTipo; valor: number; observacao?: string;
  quando_descontar: QuandoDescontar; funcionarios?: any
}

interface Func { id: string; nome: string; equipe: string }

export default function AvulsosPage() {
  const [avulsos, setAvulsos] = useState<Avulso[]>([])
  const [funcs, setFuncs] = useState<Func[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(mesAtual())
  const [equipe, setEquipe] = useState<'' | 'ARMAÇÃO' | 'CARPINTARIA'>('')
  const [form, setForm] = useState({
    funcionario_id: '', data: new Date().toISOString().slice(0, 10),
    tipo: 'Vale' as AvulsoTipo, valor: '', observacao: '',
    quando_descontar: 'pagamento_final' as QuandoDescontar,
  })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { carregar() }, [mes])

  async function carregar() {
    setLoading(true)
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    const [{ data: avs }, { data: fs }] = await Promise.all([
      comp
        ? supabase.from('avulsos').select('*, funcionarios(nome,equipe)').eq('competencia_id', comp.id).order('data', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('funcionarios').select('id,nome,equipe').eq('ativo', true).order('equipe').order('nome'),
    ])
    setAvulsos(avs || [])
    setFuncs(fs || [])
    setLoading(false)
  }

  async function salvar() {
    if (!form.funcionario_id) { setMsg({ tipo: 'err', texto: 'Selecione o funcionário.' }); return }
    if (!form.valor || +form.valor <= 0) { setMsg({ tipo: 'err', texto: 'Informe o valor.' }); return }
    setSalvando(true); setMsg(null)
    let { data: comp } = await supabase.from('competencias').select('id,status').eq('mes_ano', mes).maybeSingle()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status: 'ABERTA' }).select().single()
      comp = nova
    }
    if (comp?.status === 'FECHADA') { setMsg({ tipo: 'err', texto: 'Competência fechada.' }); setSalvando(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('avulsos').insert({
      competencia_id: comp!.id, funcionario_id: form.funcionario_id,
      data: form.data, tipo: form.tipo, valor: +form.valor,
      observacao: form.observacao || null,
      quando_descontar: form.quando_descontar,
      registrado_por: user?.id,
    })
    if (error) { setMsg({ tipo: 'err', texto: error.message }); setSalvando(false); return }
    setMsg({ tipo: 'ok', texto: '✅ Lançamento registrado!' })
    setTimeout(() => setMsg(null), 2500)
    setForm({ funcionario_id: '', data: new Date().toISOString().slice(0,10), tipo: 'Vale', valor: '', observacao: '', quando_descontar: 'pagamento_final' })
    setShowForm(false)
    await carregar()
    setSalvando(false)
  }

  async function remover(id: string) {
    if (!confirm('Remover este lançamento?')) return
    await supabase.from('avulsos').delete().eq('id', id)
    await carregar()
  }

  const filtrados = avulsos.filter((a: any) => !equipe || a.funcionarios?.equipe === equipe)
  const totalAdiant = filtrados.filter(a => a.quando_descontar === 'adiantamento').reduce((s, a) => s + a.valor, 0)
  const totalFinal = filtrados.filter(a => a.quando_descontar === 'pagamento_final').reduce((s, a) => s + a.valor, 0)
  const totalGeral = filtrados.reduce((s, a) => s + a.valor, 0)
  const funcsFiltradas = equipe ? funcs.filter(f => f.equipe === equipe) : funcs

  const corTipo: Record<AvulsoTipo, string> = {
    Vale: '#f59e0b', Empréstimo: '#ef4444', Adiantamento: '#3b82f6',
    Materiais: '#8b5cf6', Pensão: '#ec4899',
  }

  const corQuando: Record<QuandoDescontar, { bg: string; color: string; label: string }> = {
    adiantamento: { bg: '#dbeafe', color: '#1e40af', label: 'No Adiantamento (dia 20)' },
    pagamento_final: { bg: '#dcfce7', color: '#166534', label: 'No Pagamento Final (dia 05)' },
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a3a5c' }}>Avulsos — Vales & Descontos</h1>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Lançados no mês, descontados no adiantamento ou pagamento final</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13 }} />
          <button onClick={() => setShowForm(!showForm)}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            {showForm ? '✕ Fechar' : '+ Novo Lançamento'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.tipo === 'ok' ? '#86efac' : '#fca5a5'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: msg.tipo === 'ok' ? '#14532d' : '#7f1d1d', fontSize: 13 }}>
          {msg.texto}
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div style={{ background: '#fff', border: '2px solid #1a3a5c', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, color: '#1a3a5c', marginBottom: 16, fontSize: 14 }}>Novo Lançamento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Funcionário *</label>
              <select style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                value={form.funcionario_id} onChange={e => setForm(f => ({ ...f, funcionario_id: e.target.value }))}>
                <option value="">Selecione...</option>
                <optgroup label="ARMAÇÃO">
                  {funcsFiltradas.filter(f => f.equipe === 'ARMAÇÃO').map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </optgroup>
                <optgroup label="CARPINTARIA">
                  {funcsFiltradas.filter(f => f.equipe === 'CARPINTARIA').map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Data *</label>
              <input type="date" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tipo *</label>
              <select style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as AvulsoTipo }))}>
                <option value="Vale">Vale</option>
                <option value="Empréstimo">Empréstimo</option>
                <option value="Adiantamento">Adiantamento</option>
                <option value="Materiais">Materiais</option>
                <option value="Pensão">Pensão</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Valor (R$) *</label>
              <input type="number" step="0.01" placeholder="0,00" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Descontar quando? *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
                {(['adiantamento', 'pagamento_final'] as QuandoDescontar[]).map(q => (
                  <label key={q} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, padding: '6px 10px', borderRadius: 6, border: `1px solid ${form.quando_descontar === q ? '#1a3a5c' : '#e5e7eb'}`, background: form.quando_descontar === q ? corQuando[q].bg : '#fff', color: form.quando_descontar === q ? corQuando[q].color : '#374151' }}>
                    <input type="radio" name="quando" value={q} checked={form.quando_descontar === q} onChange={() => setForm(f => ({ ...f, quando_descontar: q }))} />
                    {corQuando[q].label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Observação</label>
              <input style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                placeholder="Ex: Vale para remédio" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={salvar} disabled={salvando}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              {salvando ? 'Salvando...' : '💾 Registrar'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros e totais */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['', 'ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
          <button key={eq} onClick={() => setEquipe(eq)}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #1a3a5c', background: equipe === eq ? '#1a3a5c' : '#fff', color: equipe === eq ? '#fff' : '#1a3a5c', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {eq || 'Todos'}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
            Adiantamento: -{formatR$(totalAdiant)}
          </span>
          <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
            Pag. Final: -{formatR$(totalFinal)}
          </span>
          <span style={{ background: '#f3f4f6', color: '#374151', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
            Total: -{formatR$(totalGeral)}
          </span>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1a3a5c' }}>
                <th style={{ color: '#fff', padding: '8px 12px', textAlign: 'left', fontSize: 11 }}>Funcionário</th>
                <th style={{ color: '#fff', padding: '8px 12px', textAlign: 'center', fontSize: 11 }}>Equipe</th>
                <th style={{ color: '#fff', padding: '8px 12px', textAlign: 'center', fontSize: 11 }}>Data</th>
                <th style={{ color: '#fff', padding: '8px 12px', textAlign: 'center', fontSize: 11 }}>Tipo</th>
                <th style={{ color: '#fff', padding: '8px 12px', textAlign: 'center', fontSize: 11 }}>Descontar em</th>
                <th style={{ color: '#fff', padding: '8px 12px', textAlign: 'right', fontSize: 11 }}>Valor</th>
                <th style={{ color: '#fff', padding: '8px 12px', textAlign: 'left', fontSize: 11 }}>Observação</th>
                <th style={{ color: '#fff', padding: '8px 12px', textAlign: 'center', fontSize: 11 }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a: any, i: number) => (
                <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1a3a5c', fontSize: 13 }}>{a.funcionarios?.nome}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: '#6b7280' }}>{a.funcionarios?.equipe}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12 }}>{new Date(a.data + 'T12:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{ background: corTipo[a.tipo as AvulsoTipo] + '22', color: corTipo[a.tipo as AvulsoTipo], fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, border: `1px solid ${corTipo[a.tipo as AvulsoTipo]}44` }}>
                      {a.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{ background: corQuando[a.quando_descontar as QuandoDescontar]?.bg || '#f3f4f6', color: corQuando[a.quando_descontar as QuandoDescontar]?.color || '#374151', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>
                      {a.quando_descontar === 'adiantamento' ? 'Adiantamento' : 'Pag. Final'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#dc2626', fontSize: 13 }}>-{formatR$(a.valor)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: '#6b7280' }}>{a.observacao || '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <button onClick={() => remover(a.id)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
                  Nenhum avulso em {nomeMes(mes)}
                </td></tr>
              )}
            </tbody>
            {filtrados.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
                  <td colSpan={5} style={{ padding: '8px 12px', fontSize: 13, color: '#1a3a5c' }}>TOTAL {equipe || 'GERAL'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626', fontSize: 13 }}>-{formatR$(totalGeral)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
