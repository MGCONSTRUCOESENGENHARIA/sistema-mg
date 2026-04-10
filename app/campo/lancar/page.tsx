'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tela = 'dia' | 'confirma_dia' | 'obra' | 'equipe' | 'funcionarios' | 'atrasados' | 'saiu_cedo' | 'faltou' | 'conta_obra' | 'conta_obra_det' | 'conta_mg' | 'conta_mg_det' | 'confirmacao' | 'sucesso'

interface Estado {
  data: string
  obra: any
  equipe: 'ARMAÇÃO' | 'CARPINTARIA' | null
  presentes: any[]
  atrasados: any[]
  horariosAtrasados: Record<string, string>
  saiuCedo: any[]
  horariosSaiu: Record<string, string>
  faltaram: any[]
  teveObra: boolean | null
  solicitouObra: string
  periodoObra: 'DIA_TODO' | 'METADE' | null
  funcsObra: any[]
  teveMG: boolean | null
  periodoMG: 'DIA_TODO' | 'METADE' | null
  funcsMG: any[]
}

const estadoInicial: Estado = {
  data: new Date().toISOString().slice(0,10),
  obra: null, equipe: null,
  presentes: [], atrasados: [], horariosAtrasados: {},
  saiuCedo: [], horariosSaiu: {}, faltaram: [],
  teveObra: null, solicitouObra: '', periodoObra: null, funcsObra: [],
  teveMG: null, periodoMG: null, funcsMG: [],
}

const S = {
  page: { minHeight:'100vh', background:'#f5f6fa', maxWidth:480, margin:'0 auto', display:'flex', flexDirection:'column' as const },
  top: { background:'#1e3a8a', padding:'14px 16px', display:'flex', alignItems:'center' as const, gap:10 },
  back: { color:'white', fontSize:22, cursor:'pointer', border:'none', background:'none', lineHeight:1 },
  title: { color:'white', fontWeight:700, fontSize:16, flex:1 },
  sub: { color:'rgba(255,255,255,.6)', fontSize:12, marginTop:1 },
  bar: { background:'#1e3a8a', padding:'0 16px 12px', display:'flex', gap:3 },
  dot: (done:boolean, active:boolean) => ({ height:4, borderRadius:2, flex:1, background: done?'white':active?'#60a5fa':'rgba(255,255,255,.2)' }),
  body: { flex:1, padding:'22px 16px', overflowY:'auto' as const },
  h1: { fontSize:20, fontWeight:700, color:'#1f2937', marginBottom:6 },
  p: { fontSize:14, color:'#6b7280', marginBottom:24, lineHeight:'1.5' },
  yesno: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:4 },
  yn: (sel:boolean, type:'sim'|'nao') => ({
    padding:'20px 12px', borderRadius:14, cursor:'pointer', textAlign:'center' as const,
    border: sel ? `2px solid ${type==='sim'?'#059669':'#dc2626'}` : '1.5px solid #e5e7eb',
    background: sel?(type==='sim'?'#f0fdf4':'#fef2f2'):'#f9fafb',
    fontSize:28, transition:'all .1s',
  }),
  ynLabel: { display:'block' as const, fontSize:14, fontWeight:600, marginTop:6, color:'#374151' },
  label: { fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:6, marginTop:18, textTransform:'uppercase' as const, letterSpacing:'0.04em' },
  input: { width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'12px 14px', fontSize:15, outline:'none', background:'white', color:'#1f2937' },
  dropdown: { position:'absolute' as const, top:'100%', left:0, right:0, background:'white', border:'1px solid #e5e7eb', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.1)', zIndex:50, maxHeight:220, overflowY:'auto' as const },
  dropItem: { padding:'12px 14px', cursor:'pointer', fontSize:14, color:'#1f2937', borderBottom:'1px solid #f3f4f6' },
  chip: (cor:string) => ({ display:'inline-flex', alignItems:'center' as const, gap:6, padding:'6px 12px', borderRadius:20, background:cor, fontSize:13, fontWeight:600, marginRight:6, marginBottom:6, cursor:'pointer' }),
  funcCard: (sel:boolean) => ({
    display:'flex', alignItems:'center' as const, gap:10, padding:'11px 14px',
    border: sel?'2px solid #1e3a8a':'1px solid #e5e7eb',
    borderRadius:10, marginBottom:8, cursor:'pointer', background:sel?'#eff6ff':'white',
  }),
  avatar: { width:36, height:36, borderRadius:'50%', background:'#e0e7ff', display:'flex', alignItems:'center' as const, justifyContent:'center', fontSize:12, fontWeight:700, color:'#3730a3', flexShrink:0 },
  check: (sel:boolean) => ({ width:22, height:22, borderRadius:'50%', border:`2px solid ${sel?'#1e3a8a':'#d1d5db'}`, background:sel?'#1e3a8a':'transparent', display:'flex', alignItems:'center' as const, justifyContent:'center', flexShrink:0 }),
  bottom: { padding:'14px 16px', background:'white', borderTop:'1px solid #e5e7eb' },
  btn: (dis?:boolean) => ({ width:'100%', padding:'14px', borderRadius:12, border:'none', background:dis?'#9ca3af':'#1e3a8a', color:'white', fontSize:15, fontWeight:700, cursor:dis?'not-allowed':'pointer' }),
  btnSec: { width:'100%', padding:'12px', borderRadius:12, border:'1.5px solid #e5e7eb', background:'white', color:'#374151', fontSize:14, fontWeight:600, cursor:'pointer', marginTop:10 },
  period: (sel:boolean) => ({ flex:1, padding:'14px', borderRadius:12, border:sel?'2px solid #1e3a8a':'1.5px solid #e5e7eb', background:sel?'#eff6ff':'white', cursor:'pointer', textAlign:'center' as const }),
  confirmRow: { display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f3f4f6', gap:12 },
  secHead: { fontSize:11, fontWeight:700, color:'#6b7280', letterSpacing:'0.06em', margin:'18px 0 8px', textTransform:'uppercase' as const },
}

function ini(nome:string) { return nome.split(' ').slice(0,2).map((n:string)=>n[0]).join('').toUpperCase() }

function BuscaFunc({ todos, selecionados, onChange, placeholder }: { todos:any[], selecionados:any[], onChange:(f:any[])=>void, placeholder?:string }) {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const filtrados = todos.filter(f => !selecionados.find(s=>s.id===f.id) && f.nome.toLowerCase().includes(busca.toLowerCase()))
  return (
    <div>
      <div style={{ position:'relative' }}>
        <input style={S.input} value={busca} placeholder={placeholder||'Digite o nome...'} autoComplete="off"
          onChange={e => { setBusca(e.target.value); setAberto(true) }}
          onFocus={() => setAberto(true)} onBlur={() => setTimeout(()=>setAberto(false),200)} />
        {aberto && busca && filtrados.length > 0 && (
          <div style={S.dropdown}>
            {filtrados.slice(0,8).map(f => (
              <div key={f.id} style={S.dropItem} onMouseDown={() => { onChange([...selecionados, f]); setBusca(''); setAberto(false) }}>
                {f.nome}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop:10, display:'flex', flexWrap:'wrap' as const }}>
        {selecionados.map(f => (
          <div key={f.id} style={S.chip('#eff6ff')}>
            <span style={{ color:'#1e40af' }}>{f.nome.split(' ')[0]}</span>
            <span style={{ color:'#93c5fd', cursor:'pointer', fontWeight:700 }} onMouseDown={() => onChange(selecionados.filter(s=>s.id!==f.id))}>×</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const TELAS: Tela[] = ['dia','obra','equipe','funcionarios','atrasados','saiu_cedo','faltou','conta_obra','conta_mg','confirmacao']

export default function CampoLancar() {
  const [tela, setTela] = useState<Tela>('dia')
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [buscaObra, setBuscaObra] = useState('')
  const [obraAberta, setObraAberta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [e, setE] = useState<Estado>(estadoInicial)

  useEffect(() => {
    supabase.from('obras').select('id,nome,codigo').eq('status','ATIVA').order('nome').then(({data})=>setObras(data||[]))
  }, [])

  useEffect(() => {
    if (e.equipe) {
      supabase.from('funcionarios').select('id,nome,equipe').eq('ativo',true).eq('equipe',e.equipe).order('nome').then(({data})=>setFuncs(data||[]))
    }
  }, [e.equipe])

  function set(k: Partial<Estado>) { setE(prev=>({...prev,...k})) }
  function ir(t:Tela) { setTela(t) }

  const step = TELAS.indexOf(tela)+1
  const total = TELAS.length

  const obrasFiltradas = obras.filter(o => o.nome.toLowerCase().includes(buscaObra.toLowerCase()))

  async function salvar() {
    setSalvando(true)
    const mes = e.data.slice(0,7)
    let { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status:'ABERTA' }).select().single()
      comp = nova
    }

    // Registrar presenças
    for (const f of e.presentes) {
      const atrasado = e.atrasados.find(a=>a.id===f.id)
      const saiu = e.saiuCedo.find(s=>s.id===f.id)
      const faltou = e.faltaram.find(fa=>fa.id===f.id)
      let tipo = 'NORMAL', fracao = 1
      if (faltou) { tipo = 'FALTA'; fracao = 0 }
      else if (atrasado || saiu) { tipo = 'NORMAL'; fracao = 0.5 }
      await supabase.from('presencas').upsert({
        competencia_id: comp!.id, funcionario_id: f.id,
        data: e.data, obra_id: e.obra.id, tipo, fracao,
      }, { onConflict: 'funcionario_id,data,competencia_id' })
    }

    // Diárias extras
    const inserirDiaria = async (fid:string, tipo:string, periodo:string, obs:string) => {
      await supabase.from('diarias_extras').insert({
        obra_id: e.obra.id, funcionario_id: fid,
        data: e.data, tipo,
        quantidade: periodo === 'METADE' ? 0.5 : 1,
        servico: obs,
        descontada_producao: false, recebida_medicao: false,
      })
    }

    if (e.teveObra) {
      for (const f of e.funcsObra) {
        await inserirDiaria(f.id, 'CONTA_OBRA', e.periodoObra||'DIA_TODO', `Solicitado por: ${e.solicitouObra}`)
      }
    }
    if (e.teveMG) {
      for (const f of e.funcsMG) {
        await inserirDiaria(f.id, 'CONTA_MG', e.periodoMG||'DIA_TODO', '')
      }
    }

    setSalvando(false)
    ir('sucesso')
  }

  if (tela === 'sucesso') return (
    <div style={S.page}>
      <div style={S.top}><div style={S.title}>MG Campo</div></div>
      <div style={{...S.body, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', paddingTop:60}}>
        <div style={{ width:80, height:80, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, marginBottom:20 }}>✅</div>
        <div style={{ fontSize:22, fontWeight:700, color:'#1f2937', marginBottom:8 }}>Salvo com sucesso!</div>
        <div style={{ fontSize:15, color:'#6b7280', marginBottom:40 }}>Lançamento registrado no sistema.</div>
        <button style={{...S.btn(), maxWidth:280}} onClick={() => { setE(estadoInicial); ir('dia') }}>Novo lançamento</button>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.top}>
        {tela !== 'dia' && <button style={S.back} onClick={() => {
          const idx = TELAS.indexOf(tela)
          if (tela==='confirma_dia') ir('dia')
          else if (tela==='conta_obra_det') ir('conta_obra')
          else if (tela==='conta_mg_det') ir('conta_mg')
          else if (idx > 0) ir(TELAS[idx-1])
        }}>←</button>}
        <div style={{ flex:1 }}>
          <div style={S.title}>MG Campo</div>
          <div style={S.sub}>{e.obra ? e.obra.nome : 'Lançamento diário'}</div>
        </div>
      </div>
      <div style={S.bar}>
        {TELAS.map((_,i) => <div key={i} style={S.dot(i+1<step, i+1===step)} />)}
      </div>

      {/* TELA: DIA */}
      {tela === 'dia' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Essa diária é de hoje?</div>
            <div style={S.p}>{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
            <div style={S.yesno}>
              <div style={S.yn(false,'sim')} onClick={() => { set({ data: new Date().toISOString().slice(0,10) }); ir('obra') }}>
                ✅<span style={S.ynLabel}>Sim, hoje</span>
              </div>
              <div style={S.yn(false,'nao')} onClick={() => ir('confirma_dia')}>
                📅<span style={S.ynLabel}>Outro dia</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TELA: CONFIRMA DIA */}
      {tela === 'confirma_dia' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Qual a data?</div>
            <div style={S.label}>Selecione o dia</div>
            <input type="date" style={S.input} value={e.data} onChange={ev => set({ data: ev.target.value })} />
          </div>
          <div style={S.bottom}>
            <button style={S.btn(!e.data)} disabled={!e.data} onClick={() => ir('obra')}>Confirmar →</button>
          </div>
        </>
      )}

      {/* TELA: OBRA */}
      {tela === 'obra' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Selecione a obra</div>
            <div style={S.p}>Digite o nome para buscar</div>
            <div style={{ position:'relative' }}>
              <input style={S.input} value={buscaObra} placeholder="Ex: Barreiro, Savassi..."
                onChange={ev => { setBuscaObra(ev.target.value); setObraAberta(true) }}
                onFocus={() => setObraAberta(true)} onBlur={() => setTimeout(()=>setObraAberta(false),200)} />
              {obraAberta && obrasFiltradas.length > 0 && (
                <div style={S.dropdown}>
                  {obrasFiltradas.map(o => (
                    <div key={o.id} style={S.dropItem} onMouseDown={() => { set({ obra: o }); setBuscaObra(o.nome); setObraAberta(false) }}>
                      <div style={{ fontWeight:600 }}>{o.nome}</div>
                      <div style={{ fontSize:12, color:'#9ca3af' }}>{o.codigo}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {e.obra && (
              <div style={{ marginTop:12, padding:'12px 14px', background:'#eff6ff', borderRadius:10, border:'2px solid #1e3a8a' }}>
                <div style={{ fontWeight:700, color:'#1e3a8a' }}>✓ {e.obra.nome}</div>
              </div>
            )}
          </div>
          <div style={S.bottom}>
            <button style={S.btn(!e.obra)} disabled={!e.obra} onClick={() => ir('equipe')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA: EQUIPE */}
      {tela === 'equipe' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Selecione a equipe</div>
            <div style={S.p}>Qual equipe está na obra hoje?</div>
            <div style={S.yesno}>
              <div style={S.yn(e.equipe==='ARMAÇÃO','sim')} onClick={() => set({ equipe:'ARMAÇÃO', presentes:[], atrasados:[], saiuCedo:[], faltaram:[] })}>
                🔩<span style={S.ynLabel}>Armação</span>
              </div>
              <div style={S.yn(e.equipe==='CARPINTARIA','sim')} onClick={() => set({ equipe:'CARPINTARIA', presentes:[], atrasados:[], saiuCedo:[], faltaram:[] })}>
                🪵<span style={S.ynLabel}>Carpintaria</span>
              </div>
            </div>
          </div>
          <div style={S.bottom}>
            <button style={S.btn(!e.equipe)} disabled={!e.equipe} onClick={() => ir('funcionarios')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA: FUNCIONÁRIOS */}
      {tela === 'funcionarios' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Quem estava na obra?</div>
            <div style={S.p}>Digite o nome para buscar e selecionar</div>
            <BuscaFunc todos={funcs} selecionados={e.presentes} onChange={v => set({ presentes:v })} placeholder="Buscar funcionário..." />
          </div>
          <div style={S.bottom}>
            <button style={S.btn(!e.presentes.length)} disabled={!e.presentes.length} onClick={() => ir('atrasados')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA: ATRASADOS */}
      {tela === 'atrasados' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Alguém chegou atrasado?</div>
            <div style={S.yesno}>
              <div style={S.yn(e.atrasados.length>0,'nao')} onClick={() => set({ atrasados:{} as any })}>
                ✅<span style={S.ynLabel}>Não</span>
              </div>
              <div style={S.yn(false,'sim')} onClick={() => {}}>
                ⏰<span style={S.ynLabel}>Sim</span>
              </div>
            </div>
            {(e.atrasados.length > 0 || true) && (
              <div style={{ marginTop:20 }}>
                <div style={S.label}>Quem chegou atrasado?</div>
                <BuscaFunc todos={e.presentes} selecionados={e.atrasados} onChange={v => set({ atrasados:v })} placeholder="Buscar..." />
                {e.atrasados.map((f:any) => (
                  <div key={f.id} style={{ marginTop:8 }}>
                    <div style={{ fontSize:13, color:'#374151', marginBottom:4 }}>{f.nome.split(' ')[0]} — horário de chegada:</div>
                    <input type="time" style={S.input} value={e.horariosAtrasados[f.id]||''}
                      onChange={ev => set({ horariosAtrasados:{ ...e.horariosAtrasados, [f.id]:ev.target.value } })} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={S.bottom}>
            <button style={S.btn()} onClick={() => ir('saiu_cedo')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA: SAIU CEDO */}
      {tela === 'saiu_cedo' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Alguém saiu mais cedo?</div>
            <div style={S.label}>Quem saiu antes do horário?</div>
            <BuscaFunc todos={e.presentes} selecionados={e.saiuCedo} onChange={v => set({ saiuCedo:v })} placeholder="Buscar..." />
            {e.saiuCedo.map((f:any) => (
              <div key={f.id} style={{ marginTop:8 }}>
                <div style={{ fontSize:13, color:'#374151', marginBottom:4 }}>{f.nome.split(' ')[0]} — horário de saída:</div>
                <input type="time" style={S.input} value={e.horariosSaiu[f.id]||''}
                  onChange={ev => set({ horariosSaiu:{ ...e.horariosSaiu, [f.id]:ev.target.value } })} />
              </div>
            ))}
          </div>
          <div style={S.bottom}>
            <button style={S.btn()} onClick={() => ir('faltou')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA: FALTOU */}
      {tela === 'faltou' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Alguém faltou?</div>
            <div style={S.label}>Quem não compareceu?</div>
            <BuscaFunc todos={e.presentes} selecionados={e.faltaram} onChange={v => set({ faltaram:v })} placeholder="Buscar..." />
          </div>
          <div style={S.bottom}>
            <button style={S.btn()} onClick={() => ir('conta_obra')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA: CONTA OBRA? */}
      {tela === 'conta_obra' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Teve diária por conta da obra?</div>
            <div style={S.p}>Serviço extra solicitado pelo cliente</div>
            <div style={S.yesno}>
              <div style={S.yn(e.teveObra===true,'sim')} onClick={() => set({ teveObra:true })}>
                ✅<span style={S.ynLabel}>Sim</span>
              </div>
              <div style={S.yn(e.teveObra===false,'nao')} onClick={() => set({ teveObra:false, funcsObra:[] })}>
                ❌<span style={S.ynLabel}>Não</span>
              </div>
            </div>
          </div>
          <div style={S.bottom}>
            <button style={S.btn(e.teveObra===null)} disabled={e.teveObra===null}
              onClick={() => ir(e.teveObra ? 'conta_obra_det' : 'conta_mg')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA: CONTA OBRA DETALHES */}
      {tela === 'conta_obra_det' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Detalhes — Conta Obra</div>
            <div style={S.label}>Quem solicitou?</div>
            <input style={S.input} value={e.solicitouObra} onChange={ev => set({ solicitouObra:ev.target.value })} placeholder="Nome do responsável..." />
            <div style={S.label}>Período de realização</div>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <div style={S.period(e.periodoObra==='DIA_TODO')} onClick={() => set({ periodoObra:'DIA_TODO' })}>
                <div style={{ fontSize:22 }}>☀️</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginTop:4 }}>Dia todo</div>
              </div>
              <div style={S.period(e.periodoObra==='METADE')} onClick={() => set({ periodoObra:'METADE' })}>
                <div style={{ fontSize:22 }}>🌤</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginTop:4 }}>Metade</div>
              </div>
            </div>
            <div style={S.label}>Funcionários ({e.funcsObra.length} selecionados)</div>
            <BuscaFunc todos={e.presentes} selecionados={e.funcsObra} onChange={v => set({ funcsObra:v })} placeholder="Buscar da lista de presentes..." />
          </div>
          <div style={S.bottom}>
            <button style={S.btn(!e.solicitouObra||!e.periodoObra||!e.funcsObra.length)}
              disabled={!e.solicitouObra||!e.periodoObra||!e.funcsObra.length}
              onClick={() => ir('conta_mg')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA: CONTA MG? */}
      {tela === 'conta_mg' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Teve diária por conta da MG?</div>
            <div style={S.p}>Serviço extra solicitado pela MG Construções</div>
            <div style={S.yesno}>
              <div style={S.yn(e.teveMG===true,'sim')} onClick={() => set({ teveMG:true })}>
                ✅<span style={S.ynLabel}>Sim</span>
              </div>
              <div style={S.yn(e.teveMG===false,'nao')} onClick={() => set({ teveMG:false, funcsMG:[] })}>
                ❌<span style={S.ynLabel}>Não</span>
              </div>
            </div>
          </div>
          <div style={S.bottom}>
            <button style={S.btn(e.teveMG===null)} disabled={e.teveMG===null}
              onClick={() => ir(e.teveMG ? 'conta_mg_det' : 'confirmacao')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA: CONTA MG DETALHES */}
      {tela === 'conta_mg_det' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Detalhes — Conta MG</div>
            <div style={S.label}>Período de realização</div>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <div style={S.period(e.periodoMG==='DIA_TODO')} onClick={() => set({ periodoMG:'DIA_TODO' })}>
                <div style={{ fontSize:22 }}>☀️</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginTop:4 }}>Dia todo</div>
              </div>
              <div style={S.period(e.periodoMG==='METADE')} onClick={() => set({ periodoMG:'METADE' })}>
                <div style={{ fontSize:22 }}>🌤</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginTop:4 }}>Metade</div>
              </div>
            </div>
            <div style={S.label}>Funcionários ({e.funcsMG.length} selecionados)</div>
            <BuscaFunc todos={e.presentes} selecionados={e.funcsMG} onChange={v => set({ funcsMG:v })} placeholder="Buscar da lista de presentes..." />
          </div>
          <div style={S.bottom}>
            <button style={S.btn(!e.periodoMG||!e.funcsMG.length)} disabled={!e.periodoMG||!e.funcsMG.length}
              onClick={() => ir('confirmacao')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA: CONFIRMAÇÃO */}
      {tela === 'confirmacao' && (
        <>
          <div style={S.body}>
            <div style={S.h1}>Confirmar lançamento</div>
            <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 16px' }}>
              <div style={S.confirmRow}>
                <span style={{ fontSize:13, color:'#6b7280' }}>Obra</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#1f2937' }}>{e.obra?.nome}</span>
              </div>
              <div style={S.confirmRow}>
                <span style={{ fontSize:13, color:'#6b7280' }}>Data</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{new Date(e.data+'T12:00').toLocaleDateString('pt-BR')}</span>
              </div>
              <div style={S.confirmRow}>
                <span style={{ fontSize:13, color:'#6b7280' }}>Equipe</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{e.equipe}</span>
              </div>
              <div style={{...S.confirmRow, borderBottom:'none'}}>
                <span style={{ fontSize:13, color:'#6b7280' }}>Presentes</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{e.presentes.length} funcionários</span>
              </div>
              {e.teveObra && (
                <>
                  <div style={S.secHead}>Conta Obra</div>
                  <div style={S.confirmRow}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Solicitado por</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{e.solicitouObra}</span>
                  </div>
                  <div style={S.confirmRow}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Período</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{e.periodoObra==='DIA_TODO'?'Dia todo':'Metade do dia'}</span>
                  </div>
                  <div style={{...S.confirmRow, borderBottom:'none'}}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Funcionários</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{e.funcsObra.length} selecionados</span>
                  </div>
                </>
              )}
              {e.teveMG && (
                <>
                  <div style={S.secHead}>Conta MG</div>
                  <div style={S.confirmRow}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Período</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{e.periodoMG==='DIA_TODO'?'Dia todo':'Metade do dia'}</span>
                  </div>
                  <div style={{...S.confirmRow, borderBottom:'none'}}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Funcionários</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{e.funcsMG.length} selecionados</span>
                  </div>
                </>
              )}
            </div>
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'12px 14px', marginTop:14, fontSize:12, color:'#166534' }}>
              Os dados serão salvos em tempo real no sistema principal.
            </div>
          </div>
          <div style={S.bottom}>
            <button style={S.btn(salvando)} disabled={salvando} onClick={salvar}>
              {salvando ? 'Salvando...' : '✓ Confirmar e salvar'}
            </button>
            <button style={S.btnSec} onClick={() => ir('dia')}>Voltar ao início</button>
          </div>
        </>
      )}
    </div>
  )
}
