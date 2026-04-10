'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tela = 'dia' | 'confirma_dia' | 'obra' | 'equipe' | 'funcionarios' |
  'atrasados' | 'saiu_cedo' |
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
  obra: null, equipe: null, presentes: [],
  simAtrasado: null, atrasados: [], horariosAtrasados: {},
  simSaiu: null, saiuCedo: [], horariosSaiu: {},
  teveObra: null, solicitouObra: '', periodoObra: null, servicoObra: '', funcsObra: [],
  teveMG: null, periodoMG: null, servicoMG: '', funcsMG: [],
}

const STEPS: Tela[] = ['dia','obra','equipe','funcionarios','atrasados','saiu_cedo','conta_obra','conta_mg','confirmacao']

const C = {
  azul: '#1a3a6b',
  azulLight: '#2563eb',
  bg: '#f0f4f8',
  white: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  border: '#e2e8f0',
  verde: '#059669',
  vermelho: '#dc2626',
  verdeLight: '#d1fae5',
  vermelhoLight: '#fee2e2',
}

function BuscaFunc({ todos, selecionados, onChange, placeholder }: {
  todos: any[], selecionados: any[], onChange: (v: any[]) => void, placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const filtrados = todos.filter((f:any) => !selecionados.find((s:any) => s.id === f.id) && f.nome.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:C.muted }}>🔍</div>
        <input value={q} placeholder={placeholder||'Buscar pelo nome...'} autoComplete="off"
          style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:14, padding:'13px 14px 13px 42px', fontSize:15, outline:'none', background:C.white, color:C.text, boxSizing:'border-box' as const }}
          onChange={ev => { setQ(ev.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)} />
      </div>
      {open && q.length > 0 && filtrados.length > 0 && (
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:14, boxShadow:'0 8px 32px rgba(0,0,0,.12)', zIndex:50, maxHeight:220, overflowY:'auto', marginTop:6 }}>
          {filtrados.slice(0,8).map((f:any) => (
            <div key={f.id}
              style={{ padding:'13px 16px', cursor:'pointer', fontSize:14, color:C.text, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10 }}
              onMouseDown={() => { onChange([...selecionados, f]); setQ(''); setOpen(false) }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:C.azul, flexShrink:0 }}>
                {f.nome.split(' ').slice(0,2).map((n:string)=>n[0]).join('')}
              </div>
              <span>{f.nome}</span>
            </div>
          ))}
        </div>
      )}
      {selecionados.length > 0 && (
        <div style={{ marginTop:12, display:'flex', flexWrap:'wrap' as const, gap:8 }}>
          {selecionados.map((f:any) => (
            <div key={f.id} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px 7px 10px', borderRadius:20, background:'#dbeafe', fontSize:13, fontWeight:600 }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:C.azul, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'white' }}>
                {f.nome.split(' ').slice(0,2).map((n:string)=>n[0]).join('')}
              </div>
              <span style={{ color:C.azul }}>{f.nome.split(' ')[0]}</span>
              <span style={{ color:'#93c5fd', cursor:'pointer', fontWeight:700, fontSize:17, lineHeight:1 }}
                onMouseDown={() => onChange(selecionados.filter((s:any) => s.id !== f.id))}>×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CampoLancar() {
  const [tela, setTela] = useState<Tela>('dia')
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [funcsDisponiveis, setFuncsDisponiveis] = useState<any[]>([])
  const [buscaObra, setBuscaObra] = useState('')
  const [obraAberta, setObraAberta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [e, setE] = useState<Estado>(INIT)

  useEffect(() => {
    supabase.from('obras').select('id,nome,codigo').eq('status','ATIVA').order('nome')
      .then(({ data }) => setObras(data || []))
  }, [])

  useEffect(() => {
    if (e.equipe) {
      supabase.from('funcionarios').select('id,nome,equipe').eq('ativo',true).eq('equipe',e.equipe).order('nome')
        .then(({ data }) => setFuncs(data || []))
    }
  }, [e.equipe])

  // Filtrar quem já tem presença registrada nesse dia/obra
  useEffect(() => {
    if (!e.obra || !e.data || !funcs.length) { setFuncsDisponiveis(funcs); return }
    supabase.from('presencas')
      .select('funcionario_id')
      .eq('data', e.data)
      .eq('obra_id', e.obra.id)
      .then(({ data }) => {
        const jaRegistrados = new Set((data||[]).map((p:any) => p.funcionario_id))
        setFuncsDisponiveis(funcs.filter(f => !jaRegistrados.has(f.id)))
      })
  }, [e.obra, e.data, funcs])

  function upd(k: Partial<Estado>) { setE(prev => ({ ...prev, ...k })) }
  function ir(t: Tela) { setTela(t) }

  const step = STEPS.indexOf(tela) + 1
  const obrasFiltradas = obras.filter(o => o.nome.toLowerCase().includes(buscaObra.toLowerCase()))

  async function salvar() {
    setSalvando(true)
    const mes = e.data.slice(0,7)
    let { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status:'ABERTA' }).select().single()
      comp = nova
    }

    for (const f of e.presentes) {
      const atrasado = e.atrasados.find((a:any) => a.id === f.id)
      const saiu = e.saiuCedo.find((s:any) => s.id === f.id)
      const fracao = (atrasado || saiu) ? 0.5 : 1
      await supabase.from('presencas').upsert({
        competencia_id: comp!.id, funcionario_id: f.id,
        data: e.data, obra_id: e.obra.id, tipo: 'NORMAL', fracao,
      }, { onConflict: 'funcionario_id,data,competencia_id' })
    }

    if (e.teveObra) {
      for (const f of e.funcsObra) {
        await supabase.from('diarias_extras').insert({
          obra_id: e.obra.id, funcionario_id: f.id, data: e.data,
          tipo: 'CONTA_OBRA',
          quantidade: e.periodoObra === 'METADE' ? 0.5 : 1,
          servico: e.servicoObra,
          observacao: `Solicitado por: ${e.solicitouObra} | Período: ${e.periodoObra === 'METADE' ? 'Metade' : 'Dia todo'}`,
          descontada_producao: false, recebida_medicao: false,
        })
      }
    }

    if (e.teveMG) {
      for (const f of e.funcsMG) {
        await supabase.from('diarias_extras').insert({
          obra_id: e.obra.id, funcionario_id: f.id, data: e.data,
          tipo: 'CONTA_MG',
          quantidade: e.periodoMG === 'METADE' ? 0.5 : 1,
          servico: e.servicoMG,
          observacao: `Período: ${e.periodoMG === 'METADE' ? 'Metade' : 'Dia todo'}`,
          descontada_producao: false, recebida_medicao: false,
        })
      }
    }

    const resumo = [
      `Equipe: ${e.equipe}`,
      `Presentes (${e.presentes.length}): ${e.presentes.map((f:any) => f.nome).join(', ')}`,
      e.atrasados.length > 0 ? `Atrasados: ${e.atrasados.map((f:any) => `${f.nome} (${e.horariosAtrasados[f.id]||'?'})`).join(', ')}` : null,
      e.saiuCedo.length > 0 ? `Saíram cedo: ${e.saiuCedo.map((f:any) => `${f.nome} (${e.horariosSaiu[f.id]||'?'})`).join(', ')}` : null,
      e.teveObra ? `Diária Conta Obra: ${e.servicoObra} | ${e.periodoObra === 'METADE' ? 'Metade' : 'Dia todo'} | Solicitado: ${e.solicitouObra} | Funcs: ${e.funcsObra.map((f:any) => f.nome).join(', ')}` : null,
      e.teveMG ? `Diária Conta MG: ${e.servicoMG} | ${e.periodoMG === 'METADE' ? 'Metade' : 'Dia todo'} | Funcs: ${e.funcsMG.map((f:any) => f.nome).join(', ')}` : null,
    ].filter(Boolean).join('\n')

    await supabase.from('folhas_ponto').insert({
      obra_id: e.obra.id, equipe: e.equipe, data: e.data, foto_url: '',
      tem_diaria_extra: !!(e.teveObra || e.teveMG),
      observacao: resumo, processada: false,
    })

    setSalvando(false)
    ir('sucesso')
  }

  // Styles
  function Page({ children }: any) {
    return <div style={{ minHeight:'100vh', background:C.bg, maxWidth:480, margin:'0 auto', display:'flex', flexDirection:'column' }}>{children}</div>
  }

  function TopBar({ back, title, sub }: { back?: () => void, title: string, sub?: string }) {
    return (
      <div style={{ background:`linear-gradient(135deg, ${C.azul} 0%, #1e40af 100%)`, padding:'18px 20px', display:'flex', alignItems:'center', gap:12 }}>
        {back && (
          <button onClick={back} style={{ width:36, height:36, borderRadius:10, border:'none', background:'rgba(255,255,255,.15)', color:'white', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>←</button>
        )}
        <div style={{ flex:1 }}>
          <div style={{ color:'white', fontWeight:700, fontSize:17 }}>{title}</div>
          {sub && <div style={{ color:'rgba(255,255,255,.65)', fontSize:12, marginTop:2 }}>{sub}</div>}
        </div>
      </div>
    )
  }

  function ProgressBar() {
    return (
      <div style={{ background:'#1e40af', padding:'0 20px 16px', display:'flex', gap:4 }}>
        {STEPS.map((_,i) => (
          <div key={i} style={{ height:3, borderRadius:2, flex:1, background: i+1<step?'white':i+1===step?'#93c5fd':'rgba(255,255,255,.2)', transition:'all .3s' }} />
        ))}
      </div>
    )
  }

  function Body({ children }: any) {
    return <div style={{ flex:1, padding:'24px 20px', overflowY:'auto' as const }}>{children}</div>
  }

  function Bottom({ children }: any) {
    return <div style={{ padding:'16px 20px', background:C.white, borderTop:`1px solid ${C.border}`, display:'flex', flexDirection:'column' as const, gap:10 }}>{children}</div>
  }

  function H1({ children }: any) {
    return <div style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:8, lineHeight:'1.2' }}>{children}</div>
  }

  function Sub({ children }: any) {
    return <div style={{ fontSize:14, color:C.muted, marginBottom:24, lineHeight:'1.5' }}>{children}</div>
  }

  function Label({ children }: any) {
    return <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:8, marginTop:20, textTransform:'uppercase' as const, letterSpacing:'0.08em' }}>{children}</div>
  }

  const inp = { width:'100%', border:`1.5px solid ${C.border}`, borderRadius:14, padding:'13px 16px', fontSize:15, outline:'none', background:C.white, color:C.text, boxSizing:'border-box' as const }

  function YNCard({ sel, type, emoji, label, onClick }: { sel: boolean, type: 'sim'|'nao', emoji: string, label: string, onClick: () => void }) {
    const isSim = type === 'sim'
    return (
      <div onClick={onClick} style={{
        flex:1, padding:'22px 16px', borderRadius:18, cursor:'pointer', textAlign:'center' as const,
        border: sel ? `2px solid ${isSim ? C.verde : C.vermelho}` : `1.5px solid ${C.border}`,
        background: sel ? (isSim ? C.verdeLight : C.vermelhoLight) : C.white,
        transition:'all .15s', boxShadow: sel ? `0 4px 12px ${isSim?'rgba(5,150,105,.15)':'rgba(220,38,38,.15)'}` : 'none'
      }}>
        <div style={{ fontSize:32, marginBottom:8 }}>{emoji}</div>
        <div style={{ fontSize:15, fontWeight:700, color: sel ? (isSim?C.verde:C.vermelho) : C.text }}>{label}</div>
      </div>
    )
  }

  function PrimaryBtn({ disabled, onClick, children }: any) {
    return (
      <button disabled={disabled} onClick={onClick} style={{
        width:'100%', padding:'16px', borderRadius:14, border:'none',
        background: disabled ? '#cbd5e1' : `linear-gradient(135deg, ${C.azul} 0%, #2563eb 100%)`,
        color:'white', fontSize:16, fontWeight:700, cursor: disabled?'not-allowed':'pointer',
        boxShadow: disabled ? 'none' : '0 4px 14px rgba(37,99,235,.3)',
        transition:'all .2s'
      }}>{children}</button>
    )
  }

  function SecBtn({ onClick, children }: any) {
    return (
      <button onClick={onClick} style={{ width:'100%', padding:'14px', borderRadius:14, border:`1.5px solid ${C.border}`, background:C.white, color:C.text, fontSize:14, fontWeight:600, cursor:'pointer' }}>{children}</button>
    )
  }

  function PeriodCard({ sel, onClick, icon, label }: any) {
    return (
      <div onClick={onClick} style={{
        flex:1, padding:'18px 12px', borderRadius:16, border: sel?`2px solid ${C.azulLight}`:`1.5px solid ${C.border}`,
        background: sel?'#dbeafe':C.white, cursor:'pointer', textAlign:'center' as const, transition:'all .15s'
      }}>
        <div style={{ fontSize:28, marginBottom:6 }}>{icon}</div>
        <div style={{ fontSize:13, fontWeight:700, color: sel?C.azulLight:C.text }}>{label}</div>
      </div>
    )
  }

  function ConfirmRow({ label, value, color }: { label: string, value: string, color?: string }) {
    return (
      <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${C.border}`, gap:16 }}>
        <span style={{ fontSize:13, color:C.muted, flexShrink:0, minWidth:80 }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:600, color:color||C.text, textAlign:'right' as const }}>{value}</span>
      </div>
    )
  }

  if (tela === 'sucesso') return (
    <Page>
      <div style={{ background:`linear-gradient(135deg, ${C.azul} 0%, #1e40af 100%)`, padding:'18px 20px' }}>
        <div style={{ color:'white', fontWeight:700, fontSize:17 }}>MG Campo</div>
      </div>
      <Body>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', paddingTop:40 }}>
          <div style={{ width:96, height:96, borderRadius:'50%', background:'#d1fae5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:48, marginBottom:24, boxShadow:'0 8px 32px rgba(5,150,105,.2)' }}>✅</div>
          <div style={{ fontSize:26, fontWeight:800, color:C.text, marginBottom:10 }}>Tudo salvo!</div>
          <div style={{ fontSize:15, color:C.muted, lineHeight:'1.6', marginBottom:40, maxWidth:280 }}>
            Lançamento registrado com sucesso no sistema principal.
          </div>
          <div style={{ background:C.white, borderRadius:16, padding:'14px 20px', border:`1px solid ${C.border}`, width:'100%', marginBottom:24, textAlign:'left' as const }}>
            <div style={{ fontSize:12, color:C.muted, fontWeight:600, marginBottom:8 }}>RESUMO</div>
            <div style={{ fontSize:14, color:C.text, fontWeight:600 }}>{e.obra?.nome}</div>
            <div style={{ fontSize:13, color:C.muted }}>{e.equipe} · {new Date(e.data+'T12:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long'})}</div>
            <div style={{ fontSize:13, color:C.verde, marginTop:6 }}>{e.presentes.length} presentes{e.teveObra||e.teveMG ? ' · ⚡ com diária extra':''}</div>
          </div>
          <button onClick={() => { setE(INIT); ir('dia') }}
            style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', background:`linear-gradient(135deg, ${C.azul} 0%, #2563eb 100%)`, color:'white', fontSize:16, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(37,99,235,.3)' }}>
            Novo lançamento
          </button>
        </div>
      </Body>
    </Page>
  )

  return (
    <Page>
      <TopBar
        back={tela !== 'dia' ? () => {
          if (tela==='confirma_dia') ir('dia')
          else if (tela==='conta_obra_det') ir('conta_obra')
          else if (tela==='conta_mg_det') ir('conta_mg')
          else { const i=STEPS.indexOf(tela); if(i>0) ir(STEPS[i-1]) }
        } : undefined}
        title="MG Campo"
        sub={e.obra ? e.obra.nome : 'Lançamento diário'}
      />
      <ProgressBar />

      {/* DIA */}
      {tela === 'dia' && (
        <Body>
          <H1>Essa diária é de hoje?</H1>
          <Sub>{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</Sub>
          <div style={{ display:'flex', gap:12 }}>
            <YNCard sel={false} type="sim" emoji="✅" label="Sim, hoje" onClick={() => { upd({ data: new Date().toISOString().slice(0,10) }); ir('obra') }} />
            <YNCard sel={false} type="nao" emoji="📅" label="Outro dia" onClick={() => ir('confirma_dia')} />
          </div>
        </Body>
      )}

      {/* CONFIRMA DIA */}
      {tela === 'confirma_dia' && (
        <>
          <Body>
            <H1>Qual a data?</H1>
            <Label>Selecione o dia</Label>
            <input
              type="date"
              style={{ ...inp, fontSize:16, WebkitAppearance:'none' as any, appearance:'none' }}
              value={e.data}
              max={new Date().toISOString().slice(0,10)}
              onChange={ev => upd({ data: ev.target.value })}
            />
            {e.data && (
              <div style={{ marginTop:12, padding:'12px 16px', background:'#dbeafe', borderRadius:12, fontSize:14, fontWeight:600, color:C.azul }}>
                📅 {new Date(e.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
              </div>
            )}
          </Body>
          <Bottom><PrimaryBtn disabled={!e.data} onClick={() => ir('obra')}>Confirmar →</PrimaryBtn></Bottom>
        </>
      )}

      {/* OBRA */}
      {tela === 'obra' && (
        <>
          <Body>
            <H1>Qual a obra?</H1>
            <Sub>Digite para buscar</Sub>
            <div style={{ position:'relative' }}>
              <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:C.muted }}>🏗</div>
              <input style={{ ...inp, paddingLeft:42 }} value={buscaObra} placeholder="Ex: Barreiro, Savassi..."
                onChange={ev => { setBuscaObra(ev.target.value); setObraAberta(true) }}
                onFocus={() => setObraAberta(true)}
                onBlur={() => setTimeout(() => setObraAberta(false), 200)} />
            </div>
            {obraAberta && obrasFiltradas.length > 0 && (
              <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:14, boxShadow:'0 8px 32px rgba(0,0,0,.12)', marginTop:6, maxHeight:240, overflowY:'auto' }}>
                {obrasFiltradas.map(o => (
                  <div key={o.id} style={{ padding:'14px 16px', cursor:'pointer', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10 }}
                    onMouseDown={() => { upd({ obra: o }); setBuscaObra(o.nome); setObraAberta(false) }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🏗</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{o.nome}</div>
                      <div style={{ fontSize:12, color:C.muted }}>{o.codigo}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {e.obra && (
              <div style={{ marginTop:14, padding:'14px 16px', background:'#dbeafe', borderRadius:14, border:`2px solid ${C.azulLight}`, display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:20 }}>✓</span>
                <span style={{ fontWeight:700, color:C.azul }}>{e.obra.nome}</span>
              </div>
            )}
          </Body>
          <Bottom><PrimaryBtn disabled={!e.obra} onClick={() => ir('equipe')}>Continuar →</PrimaryBtn></Bottom>
        </>
      )}

      {/* EQUIPE */}
      {tela === 'equipe' && (
        <>
          <Body>
            <H1>Qual a equipe?</H1>
            <Sub>Selecione a equipe que está na obra hoje</Sub>
            <div style={{ display:'flex', gap:12 }}>
              <YNCard sel={e.equipe==='ARMAÇÃO'} type="sim" emoji="🔩" label="Armação" onClick={() => upd({ equipe:'ARMAÇÃO', presentes:[] })} />
              <YNCard sel={e.equipe==='CARPINTARIA'} type="sim" emoji="🪵" label="Carpintaria" onClick={() => upd({ equipe:'CARPINTARIA', presentes:[] })} />
            </div>
          </Body>
          <Bottom><PrimaryBtn disabled={!e.equipe} onClick={() => ir('funcionarios')}>Continuar →</PrimaryBtn></Bottom>
        </>
      )}

      {/* FUNCIONÁRIOS */}
      {tela === 'funcionarios' && (
        <>
          <Body>
            <H1>Quem estava na obra?</H1>
            <Sub>
              {funcsDisponiveis.length < funcs.length
                ? `${funcs.length - funcsDisponiveis.length} já registrado(s) hoje — mostrando quem ainda não foi lançado`
                : 'Selecione os funcionários presentes'}
            </Sub>
            <BuscaFunc todos={funcsDisponiveis} selecionados={e.presentes} onChange={v => upd({ presentes: v })} placeholder="Buscar funcionário..." />
            {funcsDisponiveis.length === 0 && (
              <div style={{ marginTop:20, padding:'20px', background:'#f0fdf4', borderRadius:14, border:'1px solid #bbf7d0', textAlign:'center' as const }}>
                <div style={{ fontSize:24, marginBottom:8 }}>✅</div>
                <div style={{ fontSize:14, fontWeight:600, color:C.verde }}>Todos já registrados hoje!</div>
              </div>
            )}
          </Body>
          <Bottom><PrimaryBtn disabled={!e.presentes.length} onClick={() => ir('atrasados')}>Continuar →</PrimaryBtn></Bottom>
        </>
      )}

      {/* ATRASADOS */}
      {tela === 'atrasados' && (
        <>
          <Body>
            <H1>Alguém chegou atrasado?</H1>
            <div style={{ display:'flex', gap:12, marginBottom:20 }}>
              <YNCard sel={e.simAtrasado===false} type="nao" emoji="❌" label="Não" onClick={() => upd({ simAtrasado: false, atrasados: [], horariosAtrasados: {} })} />
              <YNCard sel={e.simAtrasado===true} type="sim" emoji="✅" label="Sim" onClick={() => upd({ simAtrasado: true })} />
            </div>
            {e.simAtrasado === true && (
              <>
                <Label>Quem chegou atrasado?</Label>
                <BuscaFunc todos={e.presentes} selecionados={e.atrasados} onChange={v => upd({ atrasados: v })} placeholder="Buscar..." />
                {e.atrasados.map((f:any) => (
                  <div key={f.id} style={{ marginTop:14, background:C.white, borderRadius:14, padding:'14px 16px', border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:13, color:C.text, fontWeight:700, marginBottom:8 }}>⏰ {f.nome.split(' ')[0]} — que horas chegou?</div>
                    <input type="time" style={inp} value={e.horariosAtrasados[f.id]||''}
                      onChange={ev => upd({ horariosAtrasados: { ...e.horariosAtrasados, [f.id]: ev.target.value } })} />
                  </div>
                ))}
              </>
            )}
          </Body>
          <Bottom>
            <PrimaryBtn
              disabled={e.simAtrasado===null || (e.simAtrasado===true && (!e.atrasados.length || e.atrasados.some((f:any)=>!e.horariosAtrasados[f.id])))}
              onClick={() => ir('saiu_cedo')}>Continuar →</PrimaryBtn>
          </Bottom>
        </>
      )}

      {/* SAIU CEDO */}
      {tela === 'saiu_cedo' && (
        <>
          <Body>
            <H1>Alguém saiu mais cedo?</H1>
            <div style={{ display:'flex', gap:12, marginBottom:20 }}>
              <YNCard sel={e.simSaiu===false} type="nao" emoji="❌" label="Não" onClick={() => upd({ simSaiu: false, saiuCedo: [], horariosSaiu: {} })} />
              <YNCard sel={e.simSaiu===true} type="sim" emoji="✅" label="Sim" onClick={() => upd({ simSaiu: true })} />
            </div>
            {e.simSaiu === true && (
              <>
                <Label>Quem saiu mais cedo?</Label>
                <BuscaFunc todos={e.presentes} selecionados={e.saiuCedo} onChange={v => upd({ saiuCedo: v })} placeholder="Buscar..." />
                {e.saiuCedo.map((f:any) => (
                  <div key={f.id} style={{ marginTop:14, background:C.white, borderRadius:14, padding:'14px 16px', border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:13, color:C.text, fontWeight:700, marginBottom:8 }}>🚪 {f.nome.split(' ')[0]} — que horas saiu?</div>
                    <input type="time" style={inp} value={e.horariosSaiu[f.id]||''}
                      onChange={ev => upd({ horariosSaiu: { ...e.horariosSaiu, [f.id]: ev.target.value } })} />
                  </div>
                ))}
              </>
            )}
          </Body>
          <Bottom>
            <PrimaryBtn
              disabled={e.simSaiu===null || (e.simSaiu===true && (!e.saiuCedo.length || e.saiuCedo.some((f:any)=>!e.horariosSaiu[f.id])))}
              onClick={() => ir('conta_obra')}>Continuar →</PrimaryBtn>
          </Bottom>
        </>
      )}

      {/* CONTA OBRA? */}
      {tela === 'conta_obra' && (
        <>
          <Body>
            <H1>Teve diária por conta da obra?</H1>
            <Sub>Serviço extra solicitado pelo cliente</Sub>
            <div style={{ display:'flex', gap:12 }}>
              <YNCard sel={e.teveObra===false} type="nao" emoji="❌" label="Não" onClick={() => upd({ teveObra: false, funcsObra: [] })} />
              <YNCard sel={e.teveObra===true} type="sim" emoji="✅" label="Sim" onClick={() => upd({ teveObra: true })} />
            </div>
          </Body>
          <Bottom><PrimaryBtn disabled={e.teveObra===null} onClick={() => ir(e.teveObra ? 'conta_obra_det' : 'conta_mg')}>Continuar →</PrimaryBtn></Bottom>
        </>
      )}

      {/* CONTA OBRA DETALHES */}
      {tela === 'conta_obra_det' && (
        <>
          <Body>
            <H1>Detalhes — Conta Obra</H1>
            <Label>Quem solicitou?</Label>
            <input style={inp} value={e.solicitouObra} onChange={ev => upd({ solicitouObra: ev.target.value })} placeholder="Nome do responsável..." />
            <Label>Período</Label>
            <div style={{ display:'flex', gap:12 }}>
              <PeriodCard sel={e.periodoObra==='DIA_TODO'} onClick={() => upd({ periodoObra:'DIA_TODO' })} icon="☀️" label="Dia todo" />
              <PeriodCard sel={e.periodoObra==='METADE'} onClick={() => upd({ periodoObra:'METADE' })} icon="🌤" label="Metade" />
            </div>
            <Label>Serviço executado</Label>
            <textarea style={{ ...inp, height:88, resize:'none' as const }} value={e.servicoObra}
              onChange={ev => upd({ servicoObra: ev.target.value })} placeholder="Descreva o serviço..." />
            <Label>Funcionários da diária ({e.funcsObra.length})</Label>
            <BuscaFunc todos={e.presentes} selecionados={e.funcsObra} onChange={v => upd({ funcsObra: v })} placeholder="Buscar da lista de presentes..." />
          </Body>
          <Bottom><PrimaryBtn disabled={!e.solicitouObra||!e.periodoObra||!e.servicoObra||!e.funcsObra.length} onClick={() => ir('conta_mg')}>Continuar →</PrimaryBtn></Bottom>
        </>
      )}

      {/* CONTA MG? */}
      {tela === 'conta_mg' && (
        <>
          <Body>
            <H1>Teve diária por conta da MG?</H1>
            <Sub>Serviço extra solicitado pela MG Construções</Sub>
            <div style={{ display:'flex', gap:12 }}>
              <YNCard sel={e.teveMG===false} type="nao" emoji="❌" label="Não" onClick={() => upd({ teveMG: false, funcsMG: [] })} />
              <YNCard sel={e.teveMG===true} type="sim" emoji="✅" label="Sim" onClick={() => upd({ teveMG: true })} />
            </div>
          </Body>
          <Bottom><PrimaryBtn disabled={e.teveMG===null} onClick={() => ir(e.teveMG ? 'conta_mg_det' : 'confirmacao')}>Continuar →</PrimaryBtn></Bottom>
        </>
      )}

      {/* CONTA MG DETALHES */}
      {tela === 'conta_mg_det' && (
        <>
          <Body>
            <H1>Detalhes — Conta MG</H1>
            <Label>Período</Label>
            <div style={{ display:'flex', gap:12 }}>
              <PeriodCard sel={e.periodoMG==='DIA_TODO'} onClick={() => upd({ periodoMG:'DIA_TODO' })} icon="☀️" label="Dia todo" />
              <PeriodCard sel={e.periodoMG==='METADE'} onClick={() => upd({ periodoMG:'METADE' })} icon="🌤" label="Metade" />
            </div>
            <Label>Serviço executado</Label>
            <textarea style={{ ...inp, height:88, resize:'none' as const }} value={e.servicoMG}
              onChange={ev => upd({ servicoMG: ev.target.value })} placeholder="Descreva o serviço..." />
            <Label>Funcionários da diária ({e.funcsMG.length})</Label>
            <BuscaFunc todos={e.presentes} selecionados={e.funcsMG} onChange={v => upd({ funcsMG: v })} placeholder="Buscar da lista de presentes..." />
          </Body>
          <Bottom><PrimaryBtn disabled={!e.periodoMG||!e.servicoMG||!e.funcsMG.length} onClick={() => ir('confirmacao')}>Continuar →</PrimaryBtn></Bottom>
        </>
      )}

      {/* CONFIRMAÇÃO */}
      {tela === 'confirmacao' && (
        <>
          <Body>
            <H1>Confirmar</H1>
            <Sub>Revise antes de salvar</Sub>
            <div style={{ background:C.white, borderRadius:16, padding:'16px', border:`1px solid ${C.border}`, marginBottom:14 }}>
              <ConfirmRow label="Obra" value={e.obra?.nome} color={C.azul} />
              <ConfirmRow label="Data" value={new Date(e.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})} />
              <ConfirmRow label="Equipe" value={e.equipe||''} />
              <ConfirmRow label="Presentes" value={e.presentes.map((f:any)=>f.nome).join(', ')} color={C.verde} />
              {e.atrasados.length>0 && <ConfirmRow label="Atrasados" value={e.atrasados.map((f:any)=>`${f.nome} (${e.horariosAtrasados[f.id]||'?'})`).join(', ')} color="#92400e" />}
              {e.saiuCedo.length>0 && <ConfirmRow label="Saíram cedo" value={e.saiuCedo.map((f:any)=>`${f.nome} (${e.horariosSaiu[f.id]||'?'})`).join(', ')} color="#92400e" />}

              {e.teveObra && (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:C.muted, margin:'16px 0 8px', textTransform:'uppercase' as const, letterSpacing:'0.08em' }}>Conta Obra</div>
                  <ConfirmRow label="Solicitou" value={e.solicitouObra} />
                  <ConfirmRow label="Período" value={e.periodoObra==='DIA_TODO'?'Dia todo':'Metade'} />
                  <ConfirmRow label="Serviço" value={e.servicoObra} />
                  <ConfirmRow label="Funcionários" value={e.funcsObra.map((f:any)=>f.nome).join(', ')} />
                </>
              )}
              {e.teveMG && (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:C.muted, margin:'16px 0 8px', textTransform:'uppercase' as const, letterSpacing:'0.08em' }}>Conta MG</div>
                  <ConfirmRow label="Período" value={e.periodoMG==='DIA_TODO'?'Dia todo':'Metade'} />
                  <ConfirmRow label="Serviço" value={e.servicoMG} />
                  <ConfirmRow label="Funcionários" value={e.funcsMG.map((f:any)=>f.nome).join(', ')} />
                </>
              )}
            </div>
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'12px 16px', fontSize:12, color:C.verde, display:'flex', gap:8, alignItems:'center' }}>
              <span>🔄</span>
              <span>Aparece em tempo real no sistema principal ao salvar.</span>
            </div>
          </Body>
          <Bottom>
            <PrimaryBtn disabled={salvando} onClick={salvar}>{salvando ? '⏳ Salvando...' : '✓ Confirmar e salvar'}</PrimaryBtn>
            <SecBtn onClick={() => ir('dia')}>Voltar ao início</SecBtn>
          </Bottom>
        </>
      )}
    </Page>
  )
}
