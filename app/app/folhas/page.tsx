'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface Folha {
  id: string; obra_id: string; equipe: string; data: string
  foto_url: string; tem_diaria_extra: boolean; observacao: string
  obras?: any; processada?: boolean
}

interface ResultadoIA {
  data?: string
  obra?: string
  presentes: { nome: string; funcId?: string; match?: number }[]
  diarias_obra: { nome: string; servico: string; funcId?: string }[]
  diarias_mg: { nome: string; servico: string; funcId?: string }[]
  faltas: { nome: string; funcId?: string }[]
}

interface ConfirmacaoItem {
  funcId: string | null
  nome: string
  nomeOriginal: string
  tipo: 'PRESENTE' | 'FALTA'
  extra?: 'CONTA_MG' | 'CONTA_OBRA'
  servico?: string
  incluir: boolean
}

export default function FolhasPage() {
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [folhas, setFolhas] = useState<Folha[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [processando, setProcessando] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [obraFiltro, setObraFiltro] = useState('')
  const [equipeF, setEquipeF] = useState('')
  const [fotoAberta, setFotoAberta] = useState<string | null>(null)
  const [resultadoIA, setResultadoIA] = useState<ResultadoIA | null>(null)
  const [folhaProcessando, setFolhaProcessando] = useState<Folha | null>(null)
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoItem[]>([])
  const [obraConfirm, setObraConfirm] = useState('')
  const [dataConfirm, setDataConfirm] = useState('')
  const [salvandoLancamentos, setSalvandoLancamentos] = useState(false)
  const [form, setForm] = useState({
    obra_id: '', equipe: 'ARMAÇÃO', data: new Date().toISOString().slice(0,10),
    tem_diaria_extra: false, observacao: '',
  })
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: os }, { data: fs }, { data: fls }] = await Promise.all([
      supabase.from('obras').select('id,nome,codigo').eq('status','ATIVA').order('nome'),
      supabase.from('funcionarios').select('id,nome,equipe').eq('ativo',true).order('nome'),
      supabase.from('folhas_ponto').select('*, obras(nome,codigo)').order('data', { ascending: false }),
    ])
    setObras(os || [])
    setFuncs(fs || [])
    setFolhas(fls || [])
    setLoading(false)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArquivo(file)
    setPreview(URL.createObjectURL(file))
  }

  async function salvar() {
    if (!arquivo || !form.obra_id || !form.data) {
      setMsg('⚠️ Selecione a foto, obra e data.'); setTimeout(() => setMsg(''), 3000); return
    }
    setUploading(true)
    const ext = arquivo.name.split('.').pop()
    const nome = `${form.obra_id}/${form.data}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('folhas-ponto').upload(nome, arquivo)
    if (upErr) { setMsg('⚠️ Erro no upload: ' + upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('folhas-ponto').getPublicUrl(nome)
    await supabase.from('folhas_ponto').insert({
      obra_id: form.obra_id, equipe: form.equipe, data: form.data,
      foto_url: urlData.publicUrl, tem_diaria_extra: form.tem_diaria_extra,
      observacao: form.observacao, processada: false,
    })
    setMsg('✅ Folha salva! Clique em "Processar com IA" para lançar as presenças.')
    setTimeout(() => setMsg(''), 5000)
    setArquivo(null); setPreview(null)
    setForm({ obra_id: '', equipe: 'ARMAÇÃO', data: new Date().toISOString().slice(0,10), tem_diaria_extra: false, observacao: '' })
    if (fileRef.current) fileRef.current.value = ''
    await carregar()
    setUploading(false)
  }

  async function processarComIA(folha: Folha) {
    setProcessando(folha.id)
    setMsg('🤖 Analisando imagem com IA...')

    try {
      // Chamar API route do servidor
      const nomesFuncs = funcs.map(f => f.nome)
      const response = await fetch('/api/processar-folha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: folha.foto_url, funcionarios: nomesFuncs })
      })
      const data = await response.json()
      if (!data.ok) throw new Error(data.erro || 'Erro ao processar')
      const resultado: ResultadoIA = data.resultado

      // Tentar fazer match com funcionários cadastrados
      function similaridade(a: string, b: string): number {
        a = a.toLowerCase().trim()
        b = b.toLowerCase().trim()
        if (a === b) return 1
        if (b.includes(a) || a.includes(b)) return 0.85
        const partsA = a.split(' ').filter(p => p.length > 2)
        const partsB = b.split(' ')
        const match = partsA.filter(p => partsB.some(q => q.toLowerCase().startsWith(p) || p.startsWith(q.toLowerCase()))).length
        return match / Math.max(partsA.length, 1) * 0.8
      }

      function findFunc(nome: string) {
        let best = { id: null as string | null, nome: '', score: 0 }
        funcs.forEach(f => {
          const score = similaridade(nome, f.nome)
          if (score > best.score) best = { id: f.id, nome: f.nome, score }
        })
        return best.score > 0.4 ? best : null
      }

      // Montar confirmação
      const items: ConfirmacaoItem[] = []
      const obraEncontrada = obras.find(o => o.nome.toUpperCase().includes(resultado.obra?.toUpperCase() || '') || resultado.obra?.toUpperCase().includes(o.nome.toUpperCase().split(' ')[0]))

      resultado.presentes?.forEach(p => {
        const match = findFunc(p.nome)
        // Verificar se tem diária extra
        const extraObra = resultado.diarias_obra?.find(d => similaridade(d.nome, p.nome) > 0.4)
        const extraMG = resultado.diarias_mg?.find(d => similaridade(d.nome, p.nome) > 0.4)
        items.push({
          funcId: match?.id || null,
          nome: match?.nome || p.nome,
          nomeOriginal: p.nome,
          tipo: 'PRESENTE',
          extra: extraObra ? 'CONTA_OBRA' : extraMG ? 'CONTA_MG' : undefined,
          servico: extraObra?.servico || extraMG?.servico || '',
          incluir: !!match?.id,
        })
      })

      resultado.faltas?.forEach(p => {
        const match = findFunc(p.nome)
        items.push({
          funcId: match?.id || null,
          nome: match?.nome || p.nome,
          nomeOriginal: p.nome,
          tipo: 'FALTA',
          incluir: !!match?.id,
        })
      })

      setResultadoIA(resultado)
      setConfirmacao(items)
      setFolhaProcessando(folha)
      setObraConfirm(obraEncontrada?.id || folha.obra_id)
      setDataConfirm(folha.data)
      setMsg('')
    } catch (err: any) {
      setMsg('⚠️ Erro ao processar: ' + err.message)
      setTimeout(() => setMsg(''), 5000)
    }
    setProcessando(null)
  }

  async function confirmarLancamentos() {
    if (!obraConfirm || !dataConfirm) { setMsg('⚠️ Confirme a obra e data.'); return }
    setSalvandoLancamentos(true)

    const mes = dataConfirm.slice(0,7)
    let { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status: 'ABERTA' }).select().single()
      comp = nova
    }

    // Buscar existentes
    const funcIds = confirmacao.filter(c => c.incluir && c.funcId).map(c => c.funcId!)
    const { data: existentes } = await supabase.from('presencas').select('id,funcionario_id')
      .eq('competencia_id', comp!.id).eq('data', dataConfirm).in('funcionario_id', funcIds)
    const existMap: Record<string, string> = {}
    ;(existentes || []).forEach((e: any) => { existMap[e.funcionario_id] = e.id })

    let count = 0
    for (const item of confirmacao) {
      if (!item.incluir || !item.funcId) continue
      const tipo = item.tipo === 'PRESENTE' ? 'NORMAL' : 'FALTA'
      const payload = {
        competencia_id: comp!.id, funcionario_id: item.funcId,
        data: dataConfirm, tipo,
        obra_id: item.tipo === 'PRESENTE' ? obraConfirm : null,
        fracao: 1,
      }
      if (existMap[item.funcId]) {
        await supabase.from('presencas').update(payload).eq('id', existMap[item.funcId])
      } else {
        await supabase.from('presencas').insert(payload)
      }

      // Diária extra
      if (item.extra && item.tipo === 'PRESENTE') {
        await supabase.from('diarias_extras').insert({
          obra_id: obraConfirm, funcionario_id: item.funcId,
          data: dataConfirm, tipo: item.extra,
          quantidade: 1, servico: item.servico || '',
          descontada_producao: false, recebida_medicao: false,
        })
      }
      count++
    }

    // Marcar folha como processada
    if (folhaProcessando) {
      await supabase.from('folhas_ponto').update({ processada: true }).eq('id', folhaProcessando.id)
    }

    setMsg(`✅ ${count} lançamentos salvos na grade de presença!`)
    setTimeout(() => setMsg(''), 4000)
    setConfirmacao([]); setResultadoIA(null); setFolhaProcessando(null)
    await carregar()
    setSalvandoLancamentos(false)
  }

  async function remover(id: string, fotoUrl: string) {
    if (!confirm('Remover esta folha?')) return
    const path = fotoUrl.split('/folhas-ponto/')[1]
    if (path) await supabase.storage.from('folhas-ponto').remove([decodeURIComponent(path)])
    await supabase.from('folhas_ponto').delete().eq('id', id)
    await carregar()
  }

  async function toggleExtra(id: string, val: boolean) {
    await supabase.from('folhas_ponto').update({ tem_diaria_extra: !val }).eq('id', id)
    await carregar()
  }

  const filtradas = folhas.filter(f => {
    if (obraFiltro && f.obra_id !== obraFiltro) return false
    if (equipeF && f.equipe !== equipeF) return false
    return true
  })
  const porObra: Record<string, Folha[]> = {}
  filtradas.forEach(f => { if (!porObra[f.obra_id]) porObra[f.obra_id] = []; porObra[f.obra_id].push(f) })

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', marginBottom: 4 }}>Folhas de Ponto</h1>
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Tire foto da folha → salve → processe com IA → confirme os lançamentos</p>
      </div>

      {msg && <div style={{ background: msg.includes('✅') ? '#f0fdf4' : msg.includes('🤖') ? '#eff6ff' : '#fffbeb', border: `1px solid ${msg.includes('✅') ? '#bbf7d0' : msg.includes('🤖') ? '#bfdbfe' : '#fde68a'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 13, color: msg.includes('✅') ? '#166534' : msg.includes('🤖') ? '#1e40af' : '#92400e' }}>{msg}</div>}

      {/* Modal de confirmação da IA */}
      {confirmacao.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>🤖 IA identificou — Confirme antes de lançar</h2>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>Verifique os nomes e marque quem deve ser lançado</p>
            </div>

            {/* Obra e data */}
            <div style={{ padding: '14px 22px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Obra</label>
                <select value={obraConfirm} onChange={e => setObraConfirm(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }}>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data</label>
                <input type="date" value={dataConfirm} onChange={e => setDataConfirm(e.target.value)}
                  style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
              </div>
            </div>

            {/* Lista */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 22px' }}>
              {confirmacao.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
                  <input type="checkbox" checked={item.incluir} onChange={() => setConfirmacao(prev => prev.map((c,j) => j===i ? {...c, incluir: !c.incluir} : c))}
                    style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: item.funcId ? '#1f2937' : '#dc2626' }}>{item.nome}</span>
                      {item.nomeOriginal !== item.nome && <span style={{ fontSize: 11, color: '#9ca3af' }}>← "{item.nomeOriginal}"</span>}
                      {!item.funcId && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>Não encontrado</span>}
                    </div>
                    {item.extra && <div style={{ fontSize: 11, color: item.extra === 'CONTA_OBRA' ? '#92400e' : '#1e40af', marginTop: 2 }}>
                      {item.extra === 'CONTA_OBRA' ? '🏗 Conta Obra' : '🏢 Conta MG'}{item.servico ? ` — ${item.servico}` : ''}
                    </div>}
                  </div>
                  <span style={{ background: item.tipo === 'PRESENTE' ? '#dcfce7' : '#fee2e2', color: item.tipo === 'PRESENTE' ? '#166534' : '#dc2626', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
                    {item.tipo === 'PRESENTE' ? '✅ Presente' : '❌ Falta'}
                  </span>
                  {/* Corrigir funcionário não encontrado */}
                  {!item.funcId && (
                    <select onChange={e => setConfirmacao(prev => prev.map((c,j) => j===i ? {...c, funcId: e.target.value, nome: funcs.find(f=>f.id===e.target.value)?.nome || c.nome} : c))}
                      style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 6px', fontSize: 11, outline: 'none', maxWidth: 160 }}>
                      <option value="">Corrigir...</option>
                      {funcs.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{confirmacao.filter(c => c.incluir).length} de {confirmacao.length} selecionados</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setConfirmacao([]); setResultadoIA(null); setFolhaProcessando(null) }}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                <button onClick={confirmarLancamentos} disabled={salvandoLancamentos}
                  style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#059669', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  {salvandoLancamentos ? 'Salvando...' : `✅ Confirmar ${confirmacao.filter(c=>c.incluir).length} lançamentos`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginBottom: 14 }}>📷 Adicionar Folha</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Obra *</label>
            <select value={form.obra_id} onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }}>
              <option value="">Selecione...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Equipe *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
                <button key={eq} onClick={() => setForm(f => ({ ...f, equipe: eq }))}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    borderColor: form.equipe === eq ? '#7c3aed' : '#e5e7eb',
                    background: form.equipe === eq ? '#7c3aed' : 'white',
                    color: form.equipe === eq ? 'white' : '#6b7280' }}>
                  {eq === 'ARMAÇÃO' ? 'Armação' : 'Carp.'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Data *</label>
            <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Diária extra?</label>
            <button onClick={() => setForm(f => ({ ...f, tem_diaria_extra: !f.tem_diaria_extra }))}
              style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                borderColor: form.tem_diaria_extra ? '#d97706' : '#e5e7eb',
                background: form.tem_diaria_extra ? '#fef3c7' : 'white',
                color: form.tem_diaria_extra ? '#92400e' : '#9ca3af' }}>
              {form.tem_diaria_extra ? '⚡ Tem extra' : 'Sem extra'}
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 14, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Observação</label>
            <input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              placeholder="Ex: descarga de aço..."
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()}
              style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px dashed #d1d5db', background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              {arquivo ? `📄 ${arquivo.name.slice(0,15)}...` : '📷 Selecionar foto'}
            </button>
          </div>
        </div>
        {preview && <div style={{ marginBottom: 14 }}><img src={preview} alt="preview" style={{ maxHeight: 180, borderRadius: 8, border: '1px solid #e5e7eb', objectFit: 'contain' }} /></div>}
        <button onClick={salvar} disabled={uploading}
          style={{ background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: uploading ? .7 : 1 }}>
          {uploading ? '⏳ Enviando...' : '💾 Salvar Folha'}
        </button>
      </div>

      {/* Filtros */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={obraFiltro} onChange={e => setObraFiltro(e.target.value)}
          style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 13, outline: 'none', minWidth: 180 }}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['', 'ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
            <button key={eq} onClick={() => setEquipeF(eq)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                borderColor: equipeF === eq ? '#7c3aed' : '#e5e7eb',
                background: equipeF === eq ? '#7c3aed' : 'white',
                color: equipeF === eq ? 'white' : '#6b7280' }}>
              {eq === '' ? 'Todas' : eq === 'ARMAÇÃO' ? 'Armação' : 'Carpintaria'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{filtradas.length} folhas</span>
      </div>

      {/* Lista por obra */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Carregando...</div>
      ) : Object.keys(porObra).length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ color: '#9ca3af' }}>Nenhuma folha registrada ainda.</p>
        </div>
      ) : Object.entries(porObra).map(([obraId, items]) => {
        const obraInfo = (items[0].obras as any)
        const comExtra = items.filter(f => f.tem_diaria_extra).length
        const processadas = items.filter(f => (f as any).processada).length
        return (
          <div key={obraId} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ background: '#1e3a8a', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15, flex: 1 }}>{obraInfo?.nome}</span>
              <span style={{ color: '#93c5fd', fontSize: 11 }}>{items.length} folha(s)</span>
              {processadas > 0 && <span style={{ background: '#d1fae5', color: '#065f46', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>✅ {processadas} lançadas</span>}
              {comExtra > 0 && <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>⚡ {comExtra} com extra</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px,1fr))', gap: 12, padding: 16 }}>
              {items.map(f => (
                <div key={f.id} style={{ border: `2px solid ${(f as any).processada ? '#86efac' : f.tem_diaria_extra ? '#fbbf24' : '#e5e7eb'}`, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                  {f.tem_diaria_extra && <div style={{ position: 'absolute', top: 6, left: 6, background: '#f59e0b', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, zIndex: 1 }}>⚡ EXTRA</div>}
                  {(f as any).processada && <div style={{ position: 'absolute', top: 6, right: 6, background: '#059669', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, zIndex: 1 }}>✅ LANÇADA</div>}
                  <div onClick={() => setFotoAberta(f.foto_url)} style={{ cursor: 'pointer' }}>
                    <img src={f.foto_url} alt="folha" style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{new Date(f.data + 'T12:00').toLocaleDateString('pt-BR')}</div>
                    <div style={{ fontSize: 11, color: f.equipe === 'ARMAÇÃO' ? '#7c3aed' : '#0891b2', fontWeight: 600 }}>{f.equipe}</div>
                    {f.observacao && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.observacao}</div>}
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexDirection: 'column' }}>
                      <button onClick={() => processarComIA(f)} disabled={processando === f.id}
                        style={{ width: '100%', padding: '6px', borderRadius: 6, border: 'none', background: (f as any).processada ? '#f3f4f6' : '#7c3aed', color: (f as any).processada ? '#9ca3af' : 'white', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        {processando === f.id ? '⏳ Processando...' : (f as any).processada ? '🔄 Reprocessar' : '🤖 Processar com IA'}
                      </button>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => toggleExtra(f.id, f.tem_diaria_extra)}
                          style={{ flex: 1, padding: '4px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: 10 }}>
                          {f.tem_diaria_extra ? '⚡ Extra' : 'Sem extra'}
                        </button>
                        <button onClick={() => remover(f.id, f.foto_url)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>×</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Modal foto */}
      {fotoAberta && (
        <div onClick={() => setFotoAberta(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer' }}>
          <img src={fotoAberta} alt="folha" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
          <button style={{ position: 'absolute', top: 16, right: 20, background: 'white', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 18, cursor: 'pointer', color: '#1f2937' }}>×</button>
        </div>
      )}
    </div>
  )
}
