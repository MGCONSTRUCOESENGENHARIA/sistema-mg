'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface Folha {
  id: string; obra_id: string; equipe: string; data: string
  foto_url: string; tem_diaria_extra: boolean; observacao: string
  obras?: any; processada?: boolean
}

export default function FolhasPage() {
  const [obras, setObras] = useState<any[]>([])
  const [folhas, setFolhas] = useState<Folha[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [obraFiltro, setObraFiltro] = useState('')
  const [equipeF, setEquipeF] = useState('')
  const [fotoAberta, setFotoAberta] = useState<string | null>(null)
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
    const [{ data: os }, { data: fls }] = await Promise.all([
      supabase.from('obras').select('id,nome,codigo').eq('status','ATIVA').order('nome'),
      supabase.from('folhas_ponto').select('*, obras(nome,codigo)').order('data', { ascending: false }),
    ])
    setObras(os || [])
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
    setMsg('✅ Folha salva!')
    setTimeout(() => setMsg(''), 3000)
    setArquivo(null); setPreview(null)
    setForm({ obra_id: '', equipe: 'ARMAÇÃO', data: new Date().toISOString().slice(0,10), tem_diaria_extra: false, observacao: '' })
    if (fileRef.current) fileRef.current.value = ''
    await carregar()
    setUploading(false)
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
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Registro das fotos das folhas de ponto por obra e equipe</p>
      </div>

      {msg && <div style={{ background: msg.includes('✅') ? '#f0fdf4' : '#fffbeb', border: `1px solid ${msg.includes('✅') ? '#bbf7d0' : '#fde68a'}`, borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 13, color: msg.includes('✅') ? '#166534' : '#92400e' }}>{msg}</div>}

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

      {/* Lista */}
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
        return (
          <div key={obraId} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ background: '#1e3a8a', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15, flex: 1 }}>{obraInfo?.nome}</span>
              <span style={{ color: '#93c5fd', fontSize: 11 }}>{items.length} folha(s)</span>
              {comExtra > 0 && <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>⚡ {comExtra} com extra</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 12, padding: 16 }}>
              {items.map(f => (
                <div key={f.id} style={{ border: `2px solid ${f.tem_diaria_extra ? '#fbbf24' : '#e5e7eb'}`, borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                  {f.tem_diaria_extra && <div style={{ position: 'absolute', top: 6, left: 6, background: '#f59e0b', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, zIndex: 1 }}>⚡ EXTRA</div>}
                  <div onClick={() => setFotoAberta(f.foto_url)} style={{ cursor: 'pointer' }}>
                    <img src={f.foto_url} alt="folha" style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{new Date(f.data + 'T12:00').toLocaleDateString('pt-BR')}</div>
                    <div style={{ fontSize: 11, color: f.equipe === 'ARMAÇÃO' ? '#7c3aed' : '#0891b2', fontWeight: 600 }}>{f.equipe}</div>
                    {f.observacao && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.observacao}</div>}
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                      <button onClick={() => toggleExtra(f.id, f.tem_diaria_extra)}
                        style={{ flex: 1, padding: '4px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: 10 }}>
                        {f.tem_diaria_extra ? '⚡ Extra' : 'Sem extra'}
                      </button>
                      <button onClick={() => remover(f.id, f.foto_url)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {fotoAberta && (
        <div onClick={() => setFotoAberta(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer' }}>
          <img src={fotoAberta} alt="folha" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
          <button style={{ position: 'absolute', top: 16, right: 20, background: 'white', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  )
}
