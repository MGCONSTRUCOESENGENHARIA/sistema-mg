'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tela = 'dia' | 'confirma_dia' | 'obra' | 'equipe' | 'funcionarios' |
  'atrasados' | 'saiu_cedo' | 'faltou' |
  'conta_obra' | 'conta_obra_det' | 'conta_mg' | 'conta_mg_det' |
  'confirmacao' | 'sucesso'

interface Estado {
  data: string
  obra: any
  equipe: 'ARMAÇÃO' | 'CARPINTARIA' | null
  presentes: any[]
  simAtrasado: boolean | null
  atrasados: any[]
  horariosAtrasados: Record<string, string>
  simSaiu: boolean | null
  saiuCedo: any[]
  horariosSaiu: Record<string, string>
  simFaltou: boolean | null
  faltaram: any[]
  teveObra: boolean | null
  solicitouObra: string
  periodoObra: 'DIA_TODO' | 'METADE' | null
  servicoObra: string
  funcsObra: any[]
  teveMG: boolean | null
  periodoMG: 'DIA_TODO' | 'METADE' | null
  servicoMG: string
  funcsMG: any[]
}

const INIT: Estado = {
  data: new Date().toISOString().slice(0,10),
  obra: null, equipe: null,
  presentes: [],
  simAtrasado: null, atrasados: [], horariosAtrasados: {},
  simSaiu: null, saiuCedo: [], horariosSaiu: {},
  simFaltou: null, faltaram: [],
  teveObra: null, solicitouObra: '', periodoObra: null, servicoObra: '', funcsObra: [],
  teveMG: null, periodoMG: null, servicoMG: '', funcsMG: [],
}

const STEPS: Tela[] = ['dia','obra','equipe','funcionarios','atrasados','saiu_cedo','faltou','conta_obra','conta_mg','confirmacao']

function BuscaFunc({ todos, selecionados, onChange, placeholder }: {
  todos: any[], selecionados: any[], onChange: (v: any[]) => void, placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const filtrados = todos.filter((f:any) => !selecionados.find((s:any) => s.id === f.id) && f.nome.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input value={q} placeholder={placeholder || 'Digite o nome...'} autoComplete="off"
          style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'12px 14px', fontSize:15, outline:'none', background:'white', color:'#1f2937' }}
          onChange={ev => { setQ(ev.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)} />
        {open && q.length > 0 && filtrados.length > 0 && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1px solid #e5e7eb', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)', zIndex:50, maxHeight:220, overflowY:'auto' }}>
            {filtrados.slice(0,8).map((f:any) => (
              <div key={f.id} style={{ padding:'12px 14px', cursor:'pointer', fontSize:14, color:'#1f2937', borderBottom:'1px solid #f3f4f6' }}
                onMouseDown={() => { onChange([...selecionados, f]); setQ(''); setOpen(false) }}>
                {f.nome}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop:10, display:'flex', flexWrap:'wrap' as const }}>
        {selecionados.map((f:any) => (
          <div key={f.id} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, background:'#eff6ff', fontSize:13, fontWeight:600, marginRight:6, marginBottom:6 }}>
            <span style={{ color:'#1e40af' }}>{f.nome.split(' ')[0]}</span>
            <span style={{ color:'#93c5fd', cursor:'pointer', fontWeight:700, fontSize:16 }}
              onMouseDown={() => onChange(selecionados.filter((s:any) => s.id !== f.id))}>×</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CampoLancar() {
  const [tela, setTela] = useState<Tela>('dia')
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [buscaObra, setBuscaObra] = useState('')
  const [obraAberta, setObraAberta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [e, setE] = useState<Estado>(INIT)

  useEffect(() => {
    supabase.from('obras').select('id,nome,codigo').eq('status','ATIVA').order('nome').then(({ data }) => setObras(data || []))
  }, [])

  useEffect(() => {
    if (e.equipe) {
      supabase.from('funcionarios').select('id,nome,equipe').eq('ativo',true).eq('equipe',e.equipe).order('nome')
        .then(({ data }) => setFuncs(data || []))
    }
  }, [e.equipe])

  function upd(k: Partial<Estado>) { setE(prev => ({ ...prev, ...k })) }
  function ir(t: Tela) { setTela(t) }

  const step = STEPS.indexOf(tela) + 1
  const obrasFiltradas = obras.filter(o => o.nome.toLowerCase().includes(buscaObra.toLowerCase()))

  const css = {
    page: { minHeight:'100vh', background:'#f5f6fa', maxWidth:480, margin:'0 auto', display:'flex', flexDirection:'column' as const },
    top: { background:'#1e3a8a', padding:'14px 16px', display:'flex', alignItems:'center' as const, gap:10 },
    body: { flex:1, padding:'22px 16px', overflowY:'auto' as const },
    bottom: { padding:'14px 16px', background:'white', borderTop:'1px solid #e5e7eb' },
    h1: { fontSize:20, fontWeight:700, color:'#1f2937', marginBottom:6 },
    sub: { fontSize:14, color:'#6b7280', marginBottom:24, lineHeight:'1.5' },
    lbl: { fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:6, marginTop:18, textTransform:'uppercase' as const, letterSpacing:'0.04em', display:'block' as const },
    inp: { width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'12px 14px', fontSize:15, outline:'none', background:'white', color:'#1f2937' },
    grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:4 },
    ynLabel: { display:'block' as const, fontSize:14, fontWeight:600, marginTop:6, color:'#374151' },
    confirmRow: { display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f3f4f6', gap:12 },
    secHead: { fontSize:11, fontWeight:700, color:'#6b7280', letterSpacing:'0.06em', margin:'18px 0 8px', textTransform:'uppercase' as const, display:'block' as const },
  }

  function yn(sel: boolean, type: 'verde'|'vermelho') {
    return {
      padding:'20px 12px', borderRadius:14, cursor:'pointer', textAlign:'center' as const,
      border: sel ? `2px solid ${type==='verde'?'#059669':'#dc2626'}` : '1.5px solid #e5e7eb',
      background: sel ? (type==='verde'?'#f0fdf4':'#fef2f2') : '#f9fafb',
      fontSize:28, transition:'all .1s',
    }
  }

  function Btn({ disabled, onClick, children }: { disabled?: boolean, onClick: () => void, children: any }) {
    return (
      <button disabled={disabled} onClick={onClick}
        style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background:disabled?'#d1d5db':'#1e3a8a', color:'white', fontSize:15, fontWeight:700, cursor:disabled?'not-allowed':'pointer' }}>
        {children}
      </button>
    )
  }

  function BtnSec({ onClick, children }: { onClick: () => void, children: any }) {
    return (
      <button onClick={onClick}
        style={{ width:'100%', padding:'12px', borderRadius:12, border:'1.5px solid #e5e7eb', background:'white', color:'#374151', fontSize:14, fontWeight:600, cursor:'pointer', marginTop:10 }}>
        {children}
      </button>
    )
  }

  function Period({ sel, onClick, icon, label }: { sel: boolean, onClick: () => void, icon: string, label: string }) {
    return (
      <div onClick={onClick} style={{ flex:1, padding:'16px', borderRadius:12, border:sel?'2px solid #1e3a8a':'1.5px solid #e5e7eb', background:sel?'#eff6ff':'white', cursor:'pointer', textAlign:'center' as const }}>
        <div style={{ fontSize:24 }}>{icon}</div>
        <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginTop:6 }}>{label}</div>
      </div>
    )
  }

  async function salvar() {
    setSalvando(true)
    const mes = e.data.slice(0,7)
    let { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status:'ABERTA' }).select().single()
      comp = nova
    }

    // 1. Salvar presenças
    for (const f of e.presentes) {
      const faltou = e.faltaram.find((fa:any) => fa.id === f.id)
      const atrasado = e.atrasados.find((a:any) => a.id === f.id)
      const saiu = e.saiuCedo.find((s:any) => s.id === f.id)
      let tipo = 'NORMAL', fracao = 1
      if (faltou) { tipo = 'FALTA'; fracao = 0 }
      else if (atrasado || saiu) { fracao = 0.5 }
      await supabase.from('presencas').upsert({
        competencia_id: comp!.id, funcionario_id: f.id,
        data: e.data, obra_id: e.obra.id, tipo, fracao,
      }, { onConflict: 'funcionario_id,data,competencia_id' })
    }

    // 2. Salvar faltaram (que nao estavam em presentes)
    for (const f of e.faltaram) {
      const jaPresente = e.presentes.find((p:any) => p.id === f.id)
      if (!jaPresente) {
        await supabase.from('presencas').upsert({
          competencia_id: comp!.id, funcionario_id: f.id,
          data: e.data, obra_id: e.obra.id, tipo: 'FALTA', fracao: 0,
        }, { onConflict: 'funcionario_id,data,competencia_id' })
      }
    }

    // 3. Diárias extras — Conta Obra
    if (e.teveObra) {
      for (const f of e.funcsObra) {
        await supabase.from('diarias_extras').insert({
          obra_id: e.obra.id, funcionario_id: f.id, data: e.data,
          tipo: 'CONTA_OBRA',
          quantidade: e.periodoObra === 'METADE' ? 0.5 : 1,
          servico: e.servicoObra,
          observacao: `Solicitado por: ${e.solicitouObra} | Período: ${e.periodoObra === 'METADE' ? 'Metade do dia' : 'Dia todo'}`,
          descontada_producao: false, recebida_medicao: false,
        })
      }

    }

    // 4. Diárias extras — Conta MG
    if (e.teveMG) {
      for (const f of e.funcsMG) {
        await supabase.from('diarias_extras').insert({
          obra_id: e.obra.id, funcionario_id: f.id, data: e.data,
          tipo: 'CONTA_MG',
          quantidade: e.periodoMG === 'METADE' ? 0.5 : 1,
          servico: e.servicoMG,
          observacao: `Período: ${e.periodoMG === 'METADE' ? 'Metade do dia' : 'Dia todo'}`,
          descontada_producao: false, recebida_medicao: false,
        })
      }
    }

    // 5. Gerar folha de ponto automática
    const resumoLinhas = [
      `Equipe: ${e.equipe}`,
      `Presentes (${e.presentes.length}): ${e.presentes.map((f:any) => f.nome).join(', ')}`,
      e.atrasados.length > 0 ? `Atrasados: ${e.atrasados.map((f:any) => `${f.nome} (${e.horariosAtrasados[f.id]||'?'})`).join(', ')}` : null,
      e.saiuCedo.length > 0 ? `Saíram cedo: ${e.saiuCedo.map((f:any) => `${f.nome} (${e.horariosSaiu[f.id]||'?'})`).join(', ')}` : null,
      e.faltaram.length > 0 ? `Faltaram: ${e.faltaram.map((f:any) => f.nome).join(', ')}` : null,
      e.teveObra ? `Diária Conta Obra: ${e.servicoObra} | ${e.periodoObra === 'METADE' ? 'Metade' : 'Dia todo'} | Solicitado por: ${e.solicitouObra} | Funcionários: ${e.funcsObra.map((f:any) => f.nome).join(', ')}` : null,
      e.teveMG ? `Diária Conta MG: ${e.servicoMG} | ${e.periodoMG === 'METADE' ? 'Metade' : 'Dia todo'} | Funcionários: ${e.funcsMG.map((f:any) => f.nome).join(', ')}` : null,
    ].filter(Boolean).join('\n')

    const { error: folhaError } = await supabase.from('folhas_ponto').insert({
      obra_id: e.obra.id,
      equipe: e.equipe,
      data: e.data,
      foto_url: '',
      tem_diaria_extra: !!(e.teveObra || e.teveMG),
      observacao: resumoLinhas,
      processada: false,
    })
    if (folhaError) console.error('Erro folha:', folhaError.message)

    setSalvando(false)
    ir('sucesso')
  }

  if (tela === 'sucesso') return (
    <div style={css.page}>
      <div style={css.top}><div style={{ color:'white', fontWeight:700, fontSize:16 }}>MG Campo</div></div>
      <div style={{ ...css.body, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', paddingTop:60 }}>
        <div style={{ width:80, height:80, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, marginBottom:20 }}>✅</div>
        <div style={{ fontSize:22, fontWeight:700, color:'#1f2937', marginBottom:8 }}>Salvo com sucesso!</div>
        <div style={{ fontSize:15, color:'#6b7280', marginBottom:40 }}>Lançamento registrado no sistema.</div>
        <button style={{ width:240, padding:'14px', borderRadius:12, border:'none', background:'#1e3a8a', color:'white', fontSize:15, fontWeight:700, cursor:'pointer' }}
          onClick={() => { setE(INIT); ir('dia') }}>Novo lançamento</button>
      </div>
    </div>
  )

  return (
    <div style={css.page}>
      <div style={css.top}>
        {tela !== 'dia' && (
          <button style={{ color:'white', fontSize:22, cursor:'pointer', border:'none', background:'none', lineHeight:1, marginRight:4 }}
            onClick={() => {
              if (tela === 'confirma_dia') ir('dia')
              else if (tela === 'conta_obra_det') ir('conta_obra')
              else if (tela === 'conta_mg_det') ir('conta_mg')
              else { const i = STEPS.indexOf(tela); if (i > 0) ir(STEPS[i-1]) }
            }}>←</button>
        )}
        <div style={{ flex:1 }}>
          <div style={{ color:'white', fontWeight:700, fontSize:16 }}>MG Campo</div>
          <div style={{ color:'rgba(255,255,255,.6)', fontSize:12 }}>{e.obra ? e.obra.nome : 'Lançamento diário'}</div>
        </div>
      </div>

      <div style={{ background:'#1e3a8a', padding:'0 16px 12px', display:'flex', gap:3 }}>
        {STEPS.map((_,i) => (
          <div key={i} style={{ height:4, borderRadius:2, flex:1, background: i+1 < step?'white':i+1===step?'#60a5fa':'rgba(255,255,255,.2)' }} />
        ))}
      </div>

      {/* DIA */}
      {tela === 'dia' && (
        <div style={css.body}>
          <div style={css.h1}>Essa diária é de hoje?</div>
          <div style={css.sub}>{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
          <div style={css.grid2}>
            <div style={yn(false,'verde')} onClick={() => { upd({ data: new Date().toISOString().slice(0,10) }); ir('obra') }}>
              ✅<span style={css.ynLabel}>Sim, hoje</span>
            </div>
            <div style={yn(false,'vermelho')} onClick={() => ir('confirma_dia')}>
              📅<span style={css.ynLabel}>Outro dia</span>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMA DIA */}
      {tela === 'confirma_dia' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Qual a data?</div>
            <span style={css.lbl}>Selecione o dia</span>
            <input type="date" style={css.inp} value={e.data} onChange={ev => upd({ data: ev.target.value })} />
          </div>
          <div style={css.bottom}><Btn disabled={!e.data} onClick={() => ir('obra')}>Confirmar →</Btn></div>
        </>
      )}

      {/* OBRA */}
      {tela === 'obra' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Selecione a obra</div>
            <div style={css.sub}>Digite o nome para buscar</div>
            <div style={{ position:'relative' }}>
              <input style={css.inp} value={buscaObra} placeholder="Ex: Barreiro, Savassi..."
                onChange={ev => { setBuscaObra(ev.target.value); setObraAberta(true) }}
                onFocus={() => setObraAberta(true)}
                onBlur={() => setTimeout(() => setObraAberta(false), 200)} />
              {obraAberta && obrasFiltradas.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1px solid #e5e7eb', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)', zIndex:50, maxHeight:240, overflowY:'auto' }}>
                  {obrasFiltradas.map(o => (
                    <div key={o.id} style={{ padding:'12px 14px', cursor:'pointer', fontSize:14, borderBottom:'1px solid #f3f4f6' }}
                      onMouseDown={() => { upd({ obra: o }); setBuscaObra(o.nome); setObraAberta(false) }}>
                      <div style={{ fontWeight:600, color:'#1f2937' }}>{o.nome}</div>
                      <div style={{ fontSize:12, color:'#9ca3af' }}>{o.codigo}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {e.obra && <div style={{ marginTop:12, padding:'12px 14px', background:'#eff6ff', borderRadius:10, border:'2px solid #1e3a8a', fontWeight:700, color:'#1e3a8a' }}>✓ {e.obra.nome}</div>}
          </div>
          <div style={css.bottom}><Btn disabled={!e.obra} onClick={() => ir('equipe')}>Continuar →</Btn></div>
        </>
      )}

      {/* EQUIPE */}
      {tela === 'equipe' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Selecione a equipe</div>
            <div style={css.grid2}>
              <div style={yn(e.equipe==='ARMAÇÃO','verde')} onClick={() => upd({ equipe:'ARMAÇÃO', presentes:[] })}>
                🔩<span style={css.ynLabel}>Armação</span>
              </div>
              <div style={yn(e.equipe==='CARPINTARIA','verde')} onClick={() => upd({ equipe:'CARPINTARIA', presentes:[] })}>
                🪵<span style={css.ynLabel}>Carpintaria</span>
              </div>
            </div>
          </div>
          <div style={css.bottom}><Btn disabled={!e.equipe} onClick={() => ir('funcionarios')}>Continuar →</Btn></div>
        </>
      )}

      {/* FUNCIONÁRIOS */}
      {tela === 'funcionarios' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Quem estava na obra?</div>
            <div style={css.sub}>Digite o nome e selecione os presentes</div>
            <BuscaFunc todos={funcs} selecionados={e.presentes} onChange={v => upd({ presentes: v })} placeholder="Buscar funcionário..." />
          </div>
          <div style={css.bottom}><Btn disabled={!e.presentes.length} onClick={() => ir('atrasados')}>Continuar →</Btn></div>
        </>
      )}

      {/* ATRASADOS */}
      {tela === 'atrasados' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Alguém chegou atrasado?</div>
            <div style={css.grid2}>
              <div style={yn(e.simAtrasado===false,'verde')}
                onClick={() => upd({ simAtrasado: false, atrasados: [], horariosAtrasados: {} })}>
                ✅<span style={css.ynLabel}>Não</span>
              </div>
              <div style={yn(e.simAtrasado===true,'vermelho')}
                onClick={() => upd({ simAtrasado: true })}>
                ⏰<span style={css.ynLabel}>Sim</span>
              </div>
            </div>
            {e.simAtrasado === true && (
              <div style={{ marginTop:20 }}>
                <span style={css.lbl}>Quem chegou atrasado?</span>
                <BuscaFunc todos={e.presentes} selecionados={e.atrasados} onChange={v => upd({ atrasados: v })} placeholder="Buscar..." />
                {e.atrasados.map((f:any) => (
                  <div key={f.id} style={{ marginTop:12 }}>
                    <div style={{ fontSize:13, color:'#374151', fontWeight:600, marginBottom:4 }}>{f.nome.split(' ')[0]} — horário de chegada:</div>
                    <input type="time" style={css.inp} value={e.horariosAtrasados[f.id]||''}
                      onChange={ev => upd({ horariosAtrasados: { ...e.horariosAtrasados, [f.id]: ev.target.value } })} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={css.bottom}>
            <Btn
              disabled={e.simAtrasado === null || (e.simAtrasado === true && (!e.atrasados.length || e.atrasados.some((f:any) => !e.horariosAtrasados[f.id])))}
              onClick={() => ir('saiu_cedo')}>Continuar →</Btn>
          </div>
        </>
      )}

      {/* SAIU CEDO */}
      {tela === 'saiu_cedo' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Alguém saiu mais cedo?</div>
            <div style={css.grid2}>
              <div style={yn(e.simSaiu===false,'verde')}
                onClick={() => upd({ simSaiu: false, saiuCedo: [], horariosSaiu: {} })}>
                ✅<span style={css.ynLabel}>Não</span>
              </div>
              <div style={yn(e.simSaiu===true,'vermelho')}
                onClick={() => upd({ simSaiu: true })}>
                🚪<span style={css.ynLabel}>Sim</span>
              </div>
            </div>
            {e.simSaiu === true && (
              <div style={{ marginTop:20 }}>
                <span style={css.lbl}>Quem saiu mais cedo?</span>
                <BuscaFunc todos={e.presentes} selecionados={e.saiuCedo} onChange={v => upd({ saiuCedo: v })} placeholder="Buscar..." />
                {e.saiuCedo.map((f:any) => (
                  <div key={f.id} style={{ marginTop:12 }}>
                    <div style={{ fontSize:13, color:'#374151', fontWeight:600, marginBottom:4 }}>{f.nome.split(' ')[0]} — horário de saída:</div>
                    <input type="time" style={css.inp} value={e.horariosSaiu[f.id]||''}
                      onChange={ev => upd({ horariosSaiu: { ...e.horariosSaiu, [f.id]: ev.target.value } })} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={css.bottom}>
            <Btn
              disabled={e.simSaiu === null || (e.simSaiu === true && (!e.saiuCedo.length || e.saiuCedo.some((f:any) => !e.horariosSaiu[f.id])))}
              onClick={() => ir('faltou')}>Continuar →</Btn>
          </div>
        </>
      )}

      {/* FALTOU */}
      {tela === 'faltou' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Alguém faltou?</div>
            <div style={css.grid2}>
              <div style={yn(e.simFaltou===false,'verde')}
                onClick={() => upd({ simFaltou: false, faltaram: [] })}>
                ✅<span style={css.ynLabel}>Não</span>
              </div>
              <div style={yn(e.simFaltou===true,'vermelho')}
                onClick={() => upd({ simFaltou: true })}>
                ❌<span style={css.ynLabel}>Sim</span>
              </div>
            </div>
            {e.simFaltou === true && (
              <div style={{ marginTop:20 }}>
                <span style={css.lbl}>Quem faltou?</span>
                <BuscaFunc todos={funcs} selecionados={e.faltaram} onChange={v => upd({ faltaram: v })} placeholder="Buscar..." />
              </div>
            )}
          </div>
          <div style={css.bottom}>
            <Btn
              disabled={e.simFaltou === null || (e.simFaltou === true && !e.faltaram.length)}
              onClick={() => ir('conta_obra')}>Continuar →</Btn>
          </div>
        </>
      )}

      {/* CONTA OBRA? */}
      {tela === 'conta_obra' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Teve diária por conta da obra?</div>
            <div style={css.sub}>Serviço extra solicitado pelo cliente</div>
            <div style={css.grid2}>
              <div style={yn(e.teveObra===true,'verde')} onClick={() => upd({ teveObra: true })}>
                ✅<span style={css.ynLabel}>Sim</span>
              </div>
              <div style={yn(e.teveObra===false,'vermelho')} onClick={() => upd({ teveObra: false, funcsObra: [] })}>
                ❌<span style={css.ynLabel}>Não</span>
              </div>
            </div>
          </div>
          <div style={css.bottom}>
            <Btn disabled={e.teveObra===null} onClick={() => ir(e.teveObra ? 'conta_obra_det' : 'conta_mg')}>Continuar →</Btn>
          </div>
        </>
      )}

      {/* CONTA OBRA DETALHES */}
      {tela === 'conta_obra_det' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Detalhes — Conta Obra</div>
            <span style={css.lbl}>Quem solicitou?</span>
            <input style={css.inp} value={e.solicitouObra} onChange={ev => upd({ solicitouObra: ev.target.value })} placeholder="Nome do responsável..." />
            <span style={css.lbl}>Período de realização</span>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <Period sel={e.periodoObra==='DIA_TODO'} onClick={() => upd({ periodoObra:'DIA_TODO' })} icon="☀️" label="Dia todo" />
              <Period sel={e.periodoObra==='METADE'} onClick={() => upd({ periodoObra:'METADE' })} icon="🌤" label="Metade" />
            </div>
            <span style={css.lbl}>Serviço executado</span>
            <textarea style={{ ...css.inp, height:80, resize:'none' as const }} value={e.servicoObra}
              onChange={ev => upd({ servicoObra: ev.target.value })} placeholder="Descreva o serviço..." />
            <span style={css.lbl}>Funcionários da diária ({e.funcsObra.length})</span>
            <BuscaFunc todos={e.presentes} selecionados={e.funcsObra} onChange={v => upd({ funcsObra: v })} placeholder="Buscar da lista de presentes..." />
          </div>
          <div style={css.bottom}>
            <Btn disabled={!e.solicitouObra||!e.periodoObra||!e.servicoObra||!e.funcsObra.length}
              onClick={() => ir('conta_mg')}>Continuar →</Btn>
          </div>
        </>
      )}

      {/* CONTA MG? */}
      {tela === 'conta_mg' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Teve diária por conta da MG?</div>
            <div style={css.sub}>Serviço extra solicitado pela MG Construções</div>
            <div style={css.grid2}>
              <div style={yn(e.teveMG===true,'verde')} onClick={() => upd({ teveMG: true })}>
                ✅<span style={css.ynLabel}>Sim</span>
              </div>
              <div style={yn(e.teveMG===false,'vermelho')} onClick={() => upd({ teveMG: false, funcsMG: [] })}>
                ❌<span style={css.ynLabel}>Não</span>
              </div>
            </div>
          </div>
          <div style={css.bottom}>
            <Btn disabled={e.teveMG===null} onClick={() => ir(e.teveMG ? 'conta_mg_det' : 'confirmacao')}>Continuar →</Btn>
          </div>
        </>
      )}

      {/* CONTA MG DETALHES */}
      {tela === 'conta_mg_det' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Detalhes — Conta MG</div>
            <span style={css.lbl}>Período de realização</span>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <Period sel={e.periodoMG==='DIA_TODO'} onClick={() => upd({ periodoMG:'DIA_TODO' })} icon="☀️" label="Dia todo" />
              <Period sel={e.periodoMG==='METADE'} onClick={() => upd({ periodoMG:'METADE' })} icon="🌤" label="Metade" />
            </div>
            <span style={css.lbl}>Serviço executado</span>
            <textarea style={{ ...css.inp, height:80, resize:'none' as const }} value={e.servicoMG}
              onChange={ev => upd({ servicoMG: ev.target.value })} placeholder="Descreva o serviço..." />
            <span style={css.lbl}>Funcionários da diária ({e.funcsMG.length})</span>
            <BuscaFunc todos={e.presentes} selecionados={e.funcsMG} onChange={v => upd({ funcsMG: v })} placeholder="Buscar da lista de presentes..." />
          </div>
          <div style={css.bottom}>
            <Btn disabled={!e.periodoMG||!e.servicoMG||!e.funcsMG.length} onClick={() => ir('confirmacao')}>Continuar →</Btn>
          </div>
        </>
      )}

      {/* CONFIRMAÇÃO */}
      {tela === 'confirmacao' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Confirmar lançamento</div>
            <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 16px', marginBottom:14 }}>
              <div style={css.confirmRow}>
                <span style={{ fontSize:13, color:'#6b7280', flexShrink:0 }}>Obra</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#1f2937', textAlign:'right' as const }}>{e.obra?.nome}</span>
              </div>
              <div style={css.confirmRow}>
                <span style={{ fontSize:13, color:'#6b7280', flexShrink:0 }}>Data</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{new Date(e.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</span>
              </div>
              <div style={css.confirmRow}>
                <span style={{ fontSize:13, color:'#6b7280', flexShrink:0 }}>Equipe</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{e.equipe}</span>
              </div>
              <div style={css.confirmRow}>
                <span style={{ fontSize:13, color:'#6b7280', flexShrink:0, minWidth:70 }}>Presentes</span>
                <span style={{ fontSize:12, fontWeight:600, color:'#166534', textAlign:'right' as const }}>{e.presentes.map((f:any)=>f.nome).join(', ')}</span>
              </div>
              {e.atrasados.length > 0 && (
                <div style={css.confirmRow}>
                  <span style={{ fontSize:13, color:'#6b7280', flexShrink:0, minWidth:70 }}>Atrasados</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'#92400e', textAlign:'right' as const }}>
                    {e.atrasados.map((f:any)=>`${f.nome} (${e.horariosAtrasados[f.id]||'?'})`).join(', ')}
                  </span>
                </div>
              )}
              {e.saiuCedo.length > 0 && (
                <div style={css.confirmRow}>
                  <span style={{ fontSize:13, color:'#6b7280', flexShrink:0, minWidth:70 }}>Saíram cedo</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'#92400e', textAlign:'right' as const }}>
                    {e.saiuCedo.map((f:any)=>`${f.nome} (${e.horariosSaiu[f.id]||'?'})`).join(', ')}
                  </span>
                </div>
              )}
              {e.faltaram.length > 0 && (
                <div style={css.confirmRow}>
                  <span style={{ fontSize:13, color:'#6b7280', flexShrink:0, minWidth:70 }}>Faltaram</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'#dc2626', textAlign:'right' as const }}>{e.faltaram.map((f:any)=>f.nome).join(', ')}</span>
                </div>
              )}
              {e.teveObra && <>
                <span style={css.secHead}>Conta Obra</span>
                <div style={css.confirmRow}><span style={{ fontSize:13, color:'#6b7280' }}>Solicitado por</span><span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{e.solicitouObra}</span></div>
                <div style={css.confirmRow}><span style={{ fontSize:13, color:'#6b7280' }}>Período</span><span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{e.periodoObra==='DIA_TODO'?'Dia todo':'Metade'}</span></div>
                <div style={css.confirmRow}><span style={{ fontSize:13, color:'#6b7280', flexShrink:0, minWidth:70 }}>Serviço</span><span style={{ fontSize:12, fontWeight:600, color:'#1f2937', textAlign:'right' as const }}>{e.servicoObra}</span></div>
                <div style={css.confirmRow}><span style={{ fontSize:13, color:'#6b7280', flexShrink:0, minWidth:70 }}>Funcionários</span><span style={{ fontSize:12, fontWeight:600, color:'#1f2937', textAlign:'right' as const }}>{e.funcsObra.map((f:any)=>f.nome).join(', ')}</span></div>
              </>}
              {e.teveMG && <>
                <span style={css.secHead}>Conta MG</span>
                <div style={css.confirmRow}><span style={{ fontSize:13, color:'#6b7280' }}>Período</span><span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{e.periodoMG==='DIA_TODO'?'Dia todo':'Metade'}</span></div>
                <div style={css.confirmRow}><span style={{ fontSize:13, color:'#6b7280', flexShrink:0, minWidth:70 }}>Serviço</span><span style={{ fontSize:12, fontWeight:600, color:'#1f2937', textAlign:'right' as const }}>{e.servicoMG}</span></div>
                <div style={css.confirmRow}><span style={{ fontSize:13, color:'#6b7280', flexShrink:0, minWidth:70 }}>Funcionários</span><span style={{ fontSize:12, fontWeight:600, color:'#1f2937', textAlign:'right' as const }}>{e.funcsMG.map((f:any)=>f.nome).join(', ')}</span></div>
              </>}
            </div>
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'12px 14px', fontSize:12, color:'#166534' }}>
              Após confirmar, os dados aparecem em tempo real no sistema principal.
            </div>
          </div>
          <div style={css.bottom}>
            <Btn disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : '✓ Confirmar e salvar'}</Btn>
            <BtnSec onClick={() => ir('dia')}>Voltar ao início</BtnSec>
          </div>
        </>
      )}
    </div>
  )
}
