'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { diasDoMes, formatDate, formatBR, mesAtual } from '@/lib/utils'

type PresencaTipo = 'NORMAL' | 'FALTA' | 'ATESTADO' | 'AUSENTE' | 'SAIU' | 'SABADO_EXTRA' | 'X' | 'FERIADO'

interface Func { id: string; nome: string; equipe: string }
interface Obra { id: string; codigo: string; nome: string }
interface Pres { id: string; funcionario_id: string; data: string; tipo: PresencaTipo; obra_id?: string; fracao?: number; obra2_id?: string; fracao2?: number; obras?: any; obras2?: any }
interface Modal { funcId: string; funcNome: string; data: string; atual?: Pres }
interface LinhaPrev { nomeOriginal: string; funcId: string | null; funcNome: string; dias: { data: string; raw: string; tipo: PresencaTipo; obra_id?: string; fracao?: number; obra2_id?: string; fracao2?: number }[]; erros: string[] }

// Normalização de obras
const NORM_OBRAS: Record<string, string> = {
  'BLL MANGABEIRAS':'BLL MANGABEIRAS','BLL':'BLL MANGABEIRAS',
  'CIDADE JARDIM':'CIDADE JARDIM','CJ':'CIDADE JARDIM',
  'FULGENCIO':'FULGENCIO','FULG':'FULGENCIO',
  'PISCINA SERRA':'PISCINA SERRA','PISC':'PISCINA SERRA',
  'NIQUELINA':'NIQUELINA','NIQ':'NIQUELINA','NIQUE':'NIQUELINA',
  'SAVASSI':'SAVASSI','SAV':'SAVASSI','V3V':'SAVASSI',
  'VILAÇA':'VILAÇA','VIL':'VILAÇA',
  'BARREIRO':'BARREIRO','BARR':'BARREIRO',
  'PLANALTO':'PLANALTO','PLAN':'PLANALTO',
  'FERNANDO':'FERNANDO','FERN':'FERNANDO',
  'GALPÃO':'GALPÃO','GAL':'GALPÃO',
  'INHOTIM':'INHOTIM','INH':'INHOTIM',
  'CASA AGILE':'CASA AGILE','AGILE':'CASA AGILE',
  'TRÊS MARIAS':'TRÊS MARIAS','3MAR':'TRÊS MARIAS',
  'CONTENÇÃO LUZ E CIA':'CONTENÇÃO LUZ E CIA','LUZ':'CONTENÇÃO LUZ E CIA',
}

function normNomeObra(s: string): string | null {
  const u = s.trim().toUpperCase()
  return NORM_OBRAS[u] || null
}

function similaridade(a: string, b: string): number {
  a = a.toLowerCase().trim()
  b = b.toLowerCase().trim()
  if (a === b) return 1
  if (b.includes(a) || a.includes(b)) return 0.9
  const partsA = a.split(' ')
  const partsB = b.split(' ')
  const match = partsA.filter(p => partsB.some(q => q.startsWith(p) || p.startsWith(q))).length
  return match / Math.max(partsA.length, partsB.length)
}

function parseCelula(raw: string, obrasDB: Obra[]): { tipo: PresencaTipo; obra_id?: string; fracao?: number; obra2_id?: string; fracao2?: number; erro?: string } {
  const u = raw.trim().toUpperCase()
  if (!u || u === 'X') return { tipo: 'NORMAL' }
  if (u === 'FALTA') return { tipo: 'FALTA' }
  if (u === 'ATESTADO') return { tipo: 'ATESTADO' }
  if (u === 'AUSENTE') return { tipo: 'AUSENTE' }
  if (u === 'SAIU') return { tipo: 'SAIU' }

  function findObra(nome: string): string | null {
    const norm = normNomeObra(nome)
    if (norm) {
      const found = obrasDB.find(o => o.nome.toUpperCase() === norm.toUpperCase())
      return found?.id || null
    }
    const found = obrasDB.find(o => o.nome.toUpperCase().includes(nome.toUpperCase()) || nome.toUpperCase().includes(o.codigo.toUpperCase()))
    return found?.id || null
  }

  // "1/2 OBRA" ou "1/2 OBRA + OBRA2"
  if (u.startsWith('1/2 ') || u.startsWith('0.5 ') || u.startsWith('0,5 ')) {
    const resto = u.replace(/^(1\/2|0[.,]5)\s+/, '')
    if (resto.includes('+')) {
      const partes = resto.split('+').map(p => p.trim())
      const id1 = findObra(partes[0])
      const id2 = findObra(partes[1])
      if (!id1) return { tipo: 'NORMAL', erro: `Obra não encontrada: ${partes[0]}` }
      if (!id2) return { tipo: 'NORMAL', erro: `Obra não encontrada: ${partes[1]}` }
      return { tipo: 'NORMAL', obra_id: id1, fracao: 0.5, obra2_id: id2, fracao2: 0.5 }
    }
    const id = findObra(resto)
    if (!id) return { tipo: 'NORMAL', erro: `Obra não encontrada: ${resto}` }
    return { tipo: 'NORMAL', obra_id: id, fracao: 0.5 }
  }

  // "OBRA/0,5 + OBRA2/0,5" ou "OBRA + OBRA2/0,5"
  if (u.includes('+')) {
    const partes = u.split('+').map(p => p.trim())
    const parse1 = partes[0].includes('/') ? partes[0].split('/') : [partes[0], '1']
    const parse2 = partes[1].includes('/') ? partes[1].split('/') : [partes[1], '1']
    const id1 = findObra(parse1[0].trim())
    const id2 = findObra(parse2[0].trim())
    const f1 = parseFloat(parse1[1].replace(',','.')) || 0.5
    const f2 = parseFloat(parse2[1].replace(',','.')) || 0.5
    if (!id1) return { tipo: 'NORMAL', erro: `Obra não encontrada: ${parse1[0]}` }
    if (!id2) return { tipo: 'NORMAL', erro: `Obra não encontrada: ${parse2[0]}` }
    return { tipo: 'NORMAL', obra_id: id1, fracao: f1, obra2_id: id2, fracao2: f2 }
  }

  // "OBRA/0,5"
  if (u.includes('/')) {
    const [nomeObra, fracStr] = u.split('/')
    const id = findObra(nomeObra.trim())
    const frac = parseFloat(fracStr.replace(',','.')) || 0.5
    if (!id) return { tipo: 'NORMAL', erro: `Obra não encontrada: ${nomeObra}` }
    return { tipo: 'NORMAL', obra_id: id, fracao: frac }
  }

  // Obra inteira
  const id = findObra(u)
  if (!id) return { tipo: 'NORMAL', erro: `Obra não encontrada: ${u}` }
  return { tipo: 'NORMAL', obra_id: id, fracao: 1 }
}

export default function PresencaPage() {
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [mes, setMes] = useState(mesAtual())
  const [compId, setCompId] = useState<string | null>(null)
  const [funcs, setFuncs] = useState<Func[]>([])
  const [obras, setObras] = useState<Obra[]>([])
  const [presMap, setPresMap] = useState<Record<string, Pres>>({})
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [formTipo, setFormTipo] = useState<PresencaTipo>('NORMAL')
  const [formObra, setFormObra] = useState('')
  const [formFracao, setFormFracao] = useState('1')
  const [formObra2, setFormObra2] = useState('')
  const [formFracao2, setFormFracao2] = useState('')
  const [formErro, setFormErro] = useState('')
  const [busca, setBusca] = useState('')
  const [preview, setPreview] = useState<LinhaPrev[] | null>(null)
  const [importando, setImportando] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const dias = diasDoMes(mes)
  const nomeDia = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const fim1Q = dias.findIndex(d => d.getDate() > 15) - 1

  useEffect(() => { carregar() }, [equipe, mes])



  async function carregar() {
    setLoading(true)
    let { data: comp } = await supabase.from('competencias').select('id,status').eq('mes_ano', mes).maybeSingle()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status: 'ABERTA' }).select().single()
      comp = nova
    }
    setCompId(comp?.id || null)
    const [{ data: fs }, { data: os }, { data: ps }] = await Promise.all([
      supabase.from('funcionarios').select('id,nome,equipe').eq('equipe', equipe).eq('ativo', true).order('nome'),
      supabase.from('obras').select('id,codigo,nome').eq('status', 'ATIVA').order('nome'),
      supabase.from('presencas').select('id,funcionario_id,data,tipo,obra_id,fracao,obra2_id,fracao2,obras:obra_id(nome,codigo),obras2:obra2_id(nome,codigo)').eq('competencia_id', comp?.id || ''),
    ])
    setFuncs(fs || [])
    setObras(os || [])
    const mapa: Record<string, Pres> = {}
    ps?.forEach(p => { mapa[`${p.funcionario_id}|${p.data}`] = p })
    setPresMap(mapa)
    setLoading(false)
  }

  // ── IMPORTAÇÃO EXCEL ──
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportMsg('Lendo planilha...')

    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

    // Procurar aba de presença
    const abaPresenca = wb.SheetNames.find(n => n.toUpperCase().includes('PRESENÇA') || n.toUpperCase().includes('PRESENCA'))
    if (!abaPresenca) { setImportMsg('❌ Aba "PRESENÇA" não encontrada na planilha.'); return }

    const ws = wb.Sheets[abaPresenca]
    // raw:true preserva números seriais de data do Excel
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

    // Linha 2 (idx=2) = cabeçalho com datas, Coluna 1 = nome funcionário
    // Procurar linha do cabeçalho (que tem datas) — pode ser qualquer linha
    let headerRow: any[] = []
    let headerRowIdx = -1
    const colsDatas: { col: number; data: string }[] = []

    function parseDateCell(cell: any): string {
      if (!cell && cell !== 0) return ''
      // Date object
      if (cell instanceof Date) return formatDate(cell)
      // Número serial do Excel (ex: 46092 = 02/03/2026)
      if (typeof cell === 'number' && cell > 40000 && cell < 50000) {
        // Excel epoch: 1 = 01/01/1900, com bug do ano 1900
        const d = new Date(Date.UTC(1899, 11, 30) + cell * 86400000)
        return formatDate(d)
      }
      const s = String(cell).trim()
      // dd/mm/yyyy
      if (s.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const [dd, mm, yyyy] = s.split('/')
        return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
      }
      // dd/mm/yy
      if (s.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
        const [dd, mm, yy] = s.split('/')
        return `20${yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
      }
      // yyyy-mm-dd
      if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s
      // ISO com hora: 2026-03-02T00:00:00
      if (s.match(/^\d{4}-\d{2}-\d{2}T/)) return s.substring(0, 10)
      return ''
    }

    // Encontrar linha com datas do mês correto
    for (let ri = 0; ri < Math.min(10, data.length); ri++) {
      const row = data[ri] || []
      const datasEncontradas: { col: number; data: string }[] = []
      row.forEach((cell: any, ci: number) => {
        const d = parseDateCell(cell)
        if (d && d.startsWith(mes)) datasEncontradas.push({ col: ci, data: d })
      })
      if (datasEncontradas.length >= 5) {
        headerRow = row
        headerRowIdx = ri
        datasEncontradas.forEach(d => colsDatas.push(d))
        break
      }
    }

    if (colsDatas.length === 0) { setImportMsg('❌ Não encontrei colunas de data para o mês ' + mes + '. Verifique se as datas estão no formato dd/mm/yyyy'); return }

    // Processar linhas de funcionários (após o cabeçalho)
    const linhas: LinhaPrev[] = []
    for (let ri = headerRowIdx + 2; ri < data.length; ri++) {
      const row = data[ri]
      const nomeRaw = row[1] || row[0]
      if (!nomeRaw || typeof nomeRaw !== 'string' || !nomeRaw.trim()) continue
      if (nomeRaw.trim().toUpperCase() === 'FUNCIONÁRIO' || nomeRaw.trim().toUpperCase() === 'FUNCIONARIO') continue

      const nomeOrig = nomeRaw.trim()
      // Buscar funcionário mais parecido
      let melhorFunc: Func | null = null
      let melhorSim = 0
      funcs.forEach(f => {
        const sim = similaridade(nomeOrig, f.nome)
        if (sim > melhorSim) { melhorSim = sim; melhorFunc = f }
      })

      const funcId = melhorSim >= 0.5 ? melhorFunc!.id : null
      const funcNome = melhorFunc?.nome || nomeOrig
      const erros: string[] = []
      if (!funcId) erros.push(`Funcionário não encontrado: "${nomeOrig}"`)

      const diasLinha: LinhaPrev['dias'] = []
      for (const { col, data: dataStr } of colsDatas) {
        const rawVal = row[col]
        if (!rawVal || String(rawVal).trim() === '') continue
        const raw = String(rawVal).trim()
        const up = raw.toUpperCase()
        if (up === 'X') continue // sábado sem lançamento

        const parsed = parseCelula(raw, obras)
        if (parsed.erro) erros.push(`${dataStr}: ${parsed.erro}`)
        else if (parsed.tipo !== 'NORMAL' || parsed.obra_id) {
          diasLinha.push({ data: dataStr, raw, ...parsed })
        }
      }

      if (diasLinha.length > 0 || erros.length > 0) {
        linhas.push({ nomeOriginal: nomeOrig, funcId, funcNome, dias: diasLinha, erros })
      }
    }

    setPreview(linhas)
    setImportMsg('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function confirmarImportacao() {
    if (!preview || !compId) return
    setImportando(true)
    setImportMsg('Importando...')
    let total = 0, erros = 0

    for (const linha of preview) {
      if (!linha.funcId) { erros++; continue }
      for (const d of linha.dias) {
        const payload: any = {
          competencia_id: compId, funcionario_id: linha.funcId,
          data: d.data, tipo: d.tipo,
          obra_id: d.obra_id || null, fracao: d.fracao || null,
          obra2_id: d.obra2_id || null, fracao2: d.fracao2 || null,
        }
        // Verificar se já existe
      const { data: existing } = await supabase.from('presencas')
        .select('id').eq('funcionario_id', linha.funcId!).eq('data', d.data).maybeSingle()
      let error = null
      if (existing) {
        const { error: e } = await supabase.from('presencas').update(payload).eq('id', existing.id)
        error = e
      } else {
        const { error: e } = await supabase.from('presencas').insert(payload)
        error = e
      }
        if (error) erros++
        else total++
      }
    }

    setPreview(null)
    await carregar()
    setImportando(false)
    setImportMsg(`✅ ${total} lançamentos importados!${erros > 0 ? ` ⚠️ ${erros} erros.` : ''}`)
    setTimeout(() => setImportMsg(''), 5000)
  }

  function getPres(funcId: string, data: string) { return presMap[`${funcId}|${data}`] }

  function celLabel(p?: Pres) {
    if (!p) return ''
    if (p.tipo === 'FERIADO') return 'X'
    if (['FALTA','ATESTADO','AUSENTE','SAIU'].includes(p.tipo)) return p.tipo.substring(0,3)
    const o1 = (p.obras as any)?.codigo || ''
    const o2 = (p.obras2 as any)?.codigo || ''
    const f1 = p.fracao === 1 ? '' : `/${p.fracao}`
    const f2 = p.fracao2 ? `+${o2}/${p.fracao2}` : ''
    return `${o1}${f1}${f2}`
  }

  function celBg(p?: Pres, isSab = false) {
    if (!p) return isSab ? '#fff7ed' : '#fff'
    if (p.tipo === 'FALTA') return '#fee2e2'
    if (p.tipo === 'ATESTADO') return '#fef9c3'
    if (p.tipo === 'AUSENTE' || p.tipo === 'SAIU') return '#f3f4f6'
    if (p.tipo === 'SABADO_EXTRA') return '#fed7aa'
    return '#dcfce7'
  }

  function abrirModal(funcId: string, funcNome: string, data: string) {
    const atual = getPres(funcId, data)
    setModal({ funcId, funcNome, data, atual })
    if (atual) {
      setFormTipo(atual.tipo); setFormObra(atual.obra_id || '')
      setFormFracao(String(atual.fracao || 1)); setFormObra2(atual.obra2_id || '')
      setFormFracao2(String(atual.fracao2 || ''))
    } else {
      const d = new Date(data + 'T12:00')
      setFormTipo(d.getDay() === 6 ? 'SABADO_EXTRA' : 'NORMAL')
      setFormObra(''); setFormFracao('1'); setFormObra2(''); setFormFracao2('')
    }
    setFormErro('')
  }

  async function salvar() {
    if (!modal || !compId) return
    if (formTipo === ('X' as any)) { setModal(null); return } // X é só visual, não salva
    if ((formTipo==='NORMAL'||formTipo==='SABADO_EXTRA') && !formObra) { setFormErro('Selecione a obra.'); return }
    setSalvando(true)
    const payload: any = {
      competencia_id: compId, funcionario_id: modal.funcId, data: modal.data, tipo: formTipo,
      obra_id: formObra || null, fracao: parseFloat(formFracao) || null,
      obra2_id: formObra2 || null, fracao2: parseFloat(formFracao2) || null,
    }
    const { error } = modal.atual
      ? await supabase.from('presencas').update(payload).eq('id', modal.atual.id)
      : await supabase.from('presencas').insert(payload)
    if (error) { setFormErro(error.message); setSalvando(false); return }
    await carregar(); setSalvando(false); setModal(null)
  }



  async function remover() {
    if (!modal?.atual) return
    await supabase.from('presencas').delete().eq('id', modal.atual.id)
    await carregar(); setModal(null)
  }

  function calcTot(funcId: string) {
    let q1=0,q2=0,q1ex=0,q2ex=0,faltas=0,aus=0
    dias.forEach((d,di) => {
      const p = getPres(funcId, formatDate(d))
      if (!p) return
      if (p.tipo==='FALTA') { faltas++; return }
      if (p.tipo==='AUSENTE') { aus++; return }
      const soma = (p.fracao||0)+(p.fracao2||0)
      if (p.tipo==='SABADO_EXTRA') { di<=fim1Q ? q1ex+=soma : q2ex+=soma; return }
      di<=fim1Q ? q1+=soma : q2+=soma
    })
    return {q1,q2,q1ex,q2ex,faltas,aus,tot:q1+q2}
  }

  const funcsFiltradas = funcs.filter(f => !busca || f.nome.toLowerCase().includes(busca.toLowerCase()))
  return (
    <div>
      {/* BOTÕES EQUIPE */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <button
          onClick={() => setEquipe('ARMAÇÃO')}
          style={{ padding:'7px 18px', borderRadius:8, border:'2px solid #1a3a5c', cursor:'pointer', fontWeight:700, fontSize:13, background: equipe==='ARMAÇÃO'?'#1a3a5c':'#fff', color: equipe==='ARMAÇÃO'?'#fff':'#1a3a5c' }}>
          Armação ({equipe==='ARMAÇÃO'?funcs.length:'...'})
        </button>
        <button
          onClick={() => setEquipe('CARPINTARIA')}
          style={{ padding:'7px 18px', borderRadius:8, border:'2px solid #1a3a5c', cursor:'pointer', fontWeight:700, fontSize:13, background: equipe==='CARPINTARIA'?'#1a3a5c':'#fff', color: equipe==='CARPINTARIA'?'#fff':'#1a3a5c' }}>
          Carpintaria ({equipe==='CARPINTARIA'?funcs.length:'...'})
        </button>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          style={{ border:'1px solid #d1d5db', borderRadius:6, padding:'6px 10px', fontSize:13 }} />
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleFileChange} />
          <button onClick={() => fileRef.current?.click()}
            style={{ padding:'7px 16px', borderRadius:8, border:'2px solid #2e7d32', background:'#2e7d32', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13 }}>
            📥 Importar Excel
          </button>
        </div>
      </div>

      <div style={{ marginBottom:10, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <h1 style={{ fontSize:18, fontWeight:700, color:'#1a3a5c' }}>Grade de Presença — {equipe}</h1>
        <span style={{ fontSize:12, color:'#9ca3af' }}>{funcsFiltradas.length} funcionários · {dias.length} dias úteis</span>
      </div>

      {importMsg && (
        <div style={{ background: importMsg.includes('❌')?'#fef2f2': importMsg.includes('⚠')?'#fffbeb':'#f0fdf4', border:`1px solid ${importMsg.includes('❌')?'#fca5a5':importMsg.includes('⚠')?'#fde68a':'#86efac'}`, borderRadius:8, padding:'10px 14px', marginBottom:12, color: importMsg.includes('❌')?'#7f1d1d':importMsg.includes('⚠')?'#78350f':'#14532d', fontSize:13 }}>
          {importMsg}
        </div>
      )}

      {/* PREVIEW DA IMPORTAÇÃO */}
      {preview && (
        <div style={{ background:'#fff', border:'2px solid #2e7d32', borderRadius:12, padding:20, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div>
              <div style={{ fontWeight:700, color:'#1a3a5c', fontSize:15 }}>📋 Preview da importação — {equipe}</div>
              <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                {preview.filter(l=>l.funcId).length} funcionários encontrados ·{' '}
                {preview.reduce((s,l)=>s+l.dias.length,0)} lançamentos ·{' '}
                {preview.filter(l=>l.erros.length>0).length} com erros
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setPreview(null)} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #6b7280', background:'#fff', color:'#6b7280', cursor:'pointer', fontSize:13 }}>Cancelar</button>
              <button onClick={confirmarImportacao} disabled={importando}
                style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#2e7d32', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13 }}>
                {importando ? 'Importando...' : '✅ Confirmar Importação'}
              </button>
            </div>
          </div>
          <div style={{ maxHeight:300, overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  <th style={{ background:'#1a3a5c', color:'#fff', padding:'6px 10px', textAlign:'left' }}>Nome na planilha</th>
                  <th style={{ background:'#1a3a5c', color:'#fff', padding:'6px 10px', textAlign:'left' }}>Funcionário encontrado</th>
                  <th style={{ background:'#1a3a5c', color:'#fff', padding:'6px 10px', textAlign:'center' }}>Lançamentos</th>
                  <th style={{ background:'#1a3a5c', color:'#fff', padding:'6px 10px', textAlign:'left' }}>Erros</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((l, i) => (
                  <tr key={i} style={{ background: l.erros.length>0 ? '#fff7ed' : i%2===0?'#fff':'#f9fafb' }}>
                    <td style={{ padding:'5px 10px', color:'#374151' }}>{l.nomeOriginal}</td>
                    <td style={{ padding:'5px 10px', fontWeight:600, color: l.funcId?'#166534':'#dc2626' }}>
                      {l.funcNome} {!l.funcId && '❌'}
                    </td>
                    <td style={{ padding:'5px 10px', textAlign:'center', fontWeight:700, color:'#1a3a5c' }}>{l.dias.length}</td>
                    <td style={{ padding:'5px 10px', color:'#dc2626', fontSize:11 }}>{l.erros.join(' | ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
        <input type="text" placeholder="🔍 Buscar funcionário..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ border:'1px solid #d1d5db', borderRadius:6, padding:'6px 10px', fontSize:13, width:260 }} />
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ overflow:'auto', border:'1px solid #e5e7eb', borderRadius:8, maxHeight:'calc(100vh - 300px)' }}>
          <table style={{ borderCollapse:'collapse', minWidth:'max-content' }}>
            <thead>
              <tr>
                <th style={{ background:'#1a3a5c', color:'#fff', padding:'7px 12px', textAlign:'left', minWidth:200, position:'sticky', left:0, zIndex:20, fontSize:11 }}>Funcionário</th>
                {dias.map((d,di) => {
                  const sab = d.getDay()===6
                  return (
                    <th key={di} style={{ background:sab?'#c2410c':'#1a3a5c', color:'#fff', padding:'5px 4px', minWidth:65, textAlign:'center', fontSize:10 }}>
                      {formatBR(d)}<br/><span style={{ fontWeight:400, opacity:.7, fontSize:9 }}>{nomeDia[d.getDay()]}{di===fim1Q?' ◀':''}</span>
                    </th>
                  )
                })}
                <th style={{ background:'#064e3b', color:'#fff', padding:'5px 6px', minWidth:40, fontSize:10 }}>1ªQ</th>
                <th style={{ background:'#6d28d9', color:'#fff', padding:'5px 6px', minWidth:36, fontSize:10 }}>Ex1</th>
                <th style={{ background:'#064e3b', color:'#fff', padding:'5px 6px', minWidth:40, fontSize:10 }}>2ªQ</th>
                <th style={{ background:'#6d28d9', color:'#fff', padding:'5px 6px', minWidth:36, fontSize:10 }}>Ex2</th>
                <th style={{ background:'#065f46', color:'#fff', padding:'5px 6px', minWidth:44, fontSize:10 }}>TOT</th>
                <th style={{ background:'#1a3a5c', color:'#fff', padding:'5px 6px', minWidth:36, fontSize:10 }}>Falt</th>
                <th style={{ background:'#1a3a5c', color:'#fff', padding:'5px 6px', minWidth:36, fontSize:10 }}>Aus</th>
              </tr>
            </thead>
            <tbody>
              {funcsFiltradas.map((func, fi) => {
                const t = calcTot(func.id)
                const bg = fi%2===0 ? '#fff' : '#f9fafb'
                return (
                  <tr key={func.id} style={{ background:bg }}>
                    <td style={{ padding:'6px 12px', fontWeight:600, color:'#1a3a5c', position:'sticky', left:0, background:bg, zIndex:1, borderRight:'2px solid #e5e7eb', fontSize:12, minWidth:200, whiteSpace:'nowrap' }}>
                      {func.nome}
                    </td>
                    {dias.map((d,di) => {
                      const key = formatDate(d)
                      const sab = d.getDay()===6
                      const p = getPres(func.id, key)
                      const label = celLabel(p)
                      return (
                        <td key={di}
                          onClick={() => abrirModal(func.id, func.nome, key)}
                          style={{ padding:'3px 2px', textAlign:'center', fontSize:9, cursor:'pointer', minWidth:65, maxWidth:65, background:celBg(p,sab), borderBottom:'1px solid #f3f4f6', verticalAlign:'middle' }}>
                          <span style={{ display:'block', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', padding:'0 2px', fontWeight:p?600:400, color:p&&p.tipo==='FALTA'?'#dc2626':p&&p.tipo==='ATESTADO'?'#854d0e':p&&['AUSENTE','SAIU'].includes(p.tipo)?'#6b7280':p?'#166534':'#d1d5db' }}>
                            {label||(sab?'·':'')}
                          </span>
                        </td>
                      )
                    })}
                    <td style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#166534', background:'#f0fdf4' }}>{t.q1}</td>
                    <td style={{ textAlign:'center', fontSize:11, color:'#6d28d9', background:'#f5f3ff' }}>{t.q1ex}</td>
                    <td style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#166534', background:'#f0fdf4' }}>{t.q2}</td>
                    <td style={{ textAlign:'center', fontSize:11, color:'#6d28d9', background:'#f5f3ff' }}>{t.q2ex}</td>
                    <td style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#065f46', background:'#dcfce7' }}>{t.tot}</td>
                    <td style={{ textAlign:'center', fontSize:11, color:'#dc2626' }}>{t.faltas}</td>
                    <td style={{ textAlign:'center', fontSize:11, color:'#6b7280' }}>{t.aus}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:420, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6' }}>
              <div style={{ fontWeight:700, color:'#1a3a5c', fontSize:14 }}>{modal.funcNome}</div>
              <div style={{ color:'#6b7280', fontSize:12 }}>{new Date(modal.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</div>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
              {formErro && <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:6, padding:'8px 12px', color:'#7f1d1d', fontSize:12 }}>{formErro}</div>}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Tipo</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                  {(['NORMAL','SABADO_EXTRA','X','FALTA','ATESTADO','AUSENTE','SAIU'] as any[]).map(t => (
                    <button key={t} onClick={() => setFormTipo(t)}
                      style={{ padding:'6px 4px', borderRadius:6, border:formTipo===t?'2px solid #1a3a5c':'1px solid #e5e7eb', background:formTipo===t?'#1a3a5c':'#fff', color:formTipo===t?'#fff':'#374151', cursor:'pointer', fontSize:11, fontWeight:500 }}>
                      {t==='NORMAL'?'Normal':t==='SABADO_EXTRA'?'Sáb Extra':t==='FALTA'?'Falta':t==='ATESTADO'?'Atestado':t==='AUSENTE'?'Ausente':t==='X'?'✖ X':'Saiu'}
                    </button>
                  ))}
                </div>
              </div>
              {(formTipo==='NORMAL'||formTipo==='SABADO_EXTRA') && (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Obra *</label>
                      <select style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px 10px', fontSize:13 }}
                        value={formObra} onChange={e => setFormObra(e.target.value)}>
                        <option value="">Selecione...</option>
                        {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Fração</label>
                      <select style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px 10px', fontSize:13 }}
                        value={formFracao} onChange={e => setFormFracao(e.target.value)}>
                        <option value="1">1 (inteira)</option>
                        <option value="0.5">0,5 (meia)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>2ª Obra (opcional)</label>
                      <select style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px 10px', fontSize:13 }}
                        value={formObra2} onChange={e => setFormObra2(e.target.value)}>
                        <option value="">Nenhuma</option>
                        {obras.filter(o=>o.id!==formObra).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      {formObra2 && (
                        <>
                          <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Fração 2</label>
                          <select style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px 10px', fontSize:13 }}
                            value={formFracao2} onChange={e => setFormFracao2(e.target.value)}>
                            <option value="0.5">0,5</option>
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                  {formObra2 && <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:6, padding:'8px 12px', fontSize:11, color:'#1e40af' }}>Passagem = (obra1 + obra2) ÷ 2</div>}
                </>
              )}
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid #f3f4f6', display:'flex', gap:8, justifyContent:'space-between' }}>
              <div>{modal.atual && <button onClick={remover} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#dc2626', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>Remover</button>}</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setModal(null)} style={{ padding:'7px 16px', borderRadius:8, border:'1px solid #1a3a5c', background:'#fff', color:'#1a3a5c', cursor:'pointer', fontSize:13, fontWeight:600 }}>Cancelar</button>
                <button onClick={salvar} disabled={salvando} style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#1a3a5c', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                  {salvando?'Salvando...':'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

}
