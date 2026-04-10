'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tela = 'dia' | 'confirma_dia' | 'obra' | 'equipe' | 'funcionarios' |
  'atrasados' | 'saiu_cedo' |
  'conta_obra' | 'conta_obra_det' | 'conta_mg' | 'conta_mg_det' |
  'confirmacao' | 'sucesso'

const STEPS: Tela[] = ['dia','obra','equipe','funcionarios','atrasados','saiu_cedo','conta_obra','conta_mg','confirmacao']
const azul = '#1e3a8a'

const css = {
  page: { minHeight:'100vh', background:'#f8fafc', maxWidth:480, margin:'0 auto', display:'flex', flexDirection:'column' as const },
  top: { background:azul, padding:'16px 20px', display:'flex', alignItems:'center' as const, gap:12 },
  body: { flex:1, padding:'24px 20px' },
  bot: { padding:'16px 20px', background:'white', borderTop:'1px solid #e2e8f0' },
  h1: { fontSize:22, fontWeight:800, color:'#0f172a', marginBottom:12 },
  lbl: { fontSize:13, fontWeight:700, color:'#374151', display:'block' as const, marginBottom:6, marginTop:18 },
  sel: { width:'100%', padding:'14px 16px', fontSize:16, border:'2px solid #cbd5e1', borderRadius:12, background:'white', color:'#111', outline:'none' },
  inp: { width:'100%', padding:'14px 16px', fontSize:16, border:'2px solid #cbd5e1', borderRadius:12, background:'white', color:'#111', outline:'none', boxSizing:'border-box' as const },
  pbtn: (dis?:boolean): any => ({ width:'100%', padding:16, borderRadius:14, border:'none', background:dis?'#94a3b8':azul, color:'white', fontSize:16, fontWeight:700, cursor:dis?'not-allowed':'pointer' }),
  sbtn: { width:'100%', padding:14, borderRadius:14, border:'2px solid #e2e8f0', background:'white', color:'#374151', fontSize:15, fontWeight:600, cursor:'pointer', marginTop:10 } as any,
  yn: (sel:boolean, verde:boolean): any => ({ flex:1, padding:'18px 12px', borderRadius:14, textAlign:'center' as const, cursor:'pointer', border:sel?`2px solid ${verde?'#059669':'#dc2626'}`:'2px solid #e2e8f0', background:sel?(verde?'#d1fae5':'#fee2e2'):'white' }),
  row: { display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f1f5f9', gap:12 } as any,
  chk: { width:22, height:22, cursor:'pointer', accentColor:azul } as any,
}

export default function CampoLancar() {
  const [tela, setTela] = useState<Tela>('dia')
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [funcsDisp, setFuncsDisp] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)

  const [data, setData] = useState(new Date().toISOString().slice(0,10))
  const [obraId, setObraId] = useState('')
  const [equipe, setEquipe] = useState<'ARMAÇÃO'|'CARPINTARIA'|''>('')
  const [presentesIds, setPresentesIds] = useState<string[]>([])
  const [simAtrasado, setSimAtrasado] = useState<boolean|null>(null)
  const [atrasadosIds, setAtrasadosIds] = useState<string[]>([])
  const [horaAtrasado, setHoraAtrasado] = useState<Record<string,string>>({})
  const [simSaiu, setSimSaiu] = useState<boolean|null>(null)
  const [saiuIds, setSaiuIds] = useState<string[]>([])
  const [horaSaiu, setHoraSaiu] = useState<Record<string,string>>({})
  const [teveObra, setTeveObra] = useState<boolean|null>(null)
  const [solicitou, setSolicitou] = useState('')
  const [periodoObra, setPeriodoObra] = useState<'DIA_TODO'|'METADE'|''>('')
  const [servicoObra, setServicoObra] = useState('')
  const [funcsObraIds, setFuncsObraIds] = useState<string[]>([])
  const [teveMG, setTeveMG] = useState<boolean|null>(null)
  const [periodoMG, setPeriodoMG] = useState<'DIA_TODO'|'METADE'|''>('')
  const [servicoMG, setServicoMG] = useState('')
  const [funcsMGIds, setFuncsMGIds] = useState<string[]>([])

  useEffect(() => {
    supabase.from('obras').select('id,nome').eq('status','ATIVA').order('nome').then(({data})=>setObras(data||[]))
  }, [])

  useEffect(() => {
    if (!equipe) return
    supabase.from('funcionarios').select('id,nome').eq('ativo',true).eq('equipe',equipe).order('nome').then(({data})=>setFuncs(data||[]))
  }, [equipe])

  useEffect(() => {
    if (!obraId || !data || !funcs.length) { setFuncsDisp(funcs); return }
    supabase.from('presencas').select('funcionario_id').eq('data',data).eq('obra_id',obraId).then(({data:p})=>{
      const jaReg = new Set((p||[]).map((x:any)=>x.funcionario_id))
      setFuncsDisp(funcs.filter(f=>!jaReg.has(f.id)))
    })
  }, [obraId, data, funcs])

  const obra = obras.find(o=>o.id===obraId)
  const presentes = funcs.filter(f=>presentesIds.includes(f.id))
  const atrasados = funcs.filter(f=>atrasadosIds.includes(f.id))
  const saiuCedo = funcs.filter(f=>saiuIds.includes(f.id))
  const funcsObra = presentes.filter(f=>funcsObraIds.includes(f.id))
  const funcsMG = presentes.filter(f=>funcsMGIds.includes(f.id))
  const step = STEPS.indexOf(tela)+1

  function ir(t:Tela) { setTela(t) }
  function goBack() {
    if (tela==='confirma_dia') ir('dia')
    else if (tela==='conta_obra_det') ir('conta_obra')
    else if (tela==='conta_mg_det') ir('conta_mg')
    else { const i=STEPS.indexOf(tela); if(i>0) ir(STEPS[i-1] as Tela) }
  }

  function resetar() {
    setTela('dia'); setObraId(''); setEquipe(''); setPresentesIds([])
    setSimAtrasado(null); setAtrasadosIds([]); setHoraAtrasado({})
    setSimSaiu(null); setSaiuIds([]); setHoraSaiu({})
    setTeveObra(null); setSolicitou(''); setPeriodoObra(''); setServicoObra(''); setFuncsObraIds([])
    setTeveMG(null); setPeriodoMG(''); setServicoMG(''); setFuncsMGIds([])
  }

  async function salvar() {
    setSalvando(true)
    const mes = data.slice(0,7)
    let {data:comp} = await supabase.from('competencias').select('id').eq('mes_ano',mes).maybeSingle()
    if (!comp) {
      const {data:n} = await supabase.from('competencias').insert({mes_ano:mes,status:'ABERTA'}).select().single()
      comp = n
    }
    for (const f of presentes) {
      const at = atrasados.find(a=>a.id===f.id)
      const sc = saiuCedo.find(s=>s.id===f.id)
      await supabase.from('presencas').upsert({
        competencia_id:comp!.id, funcionario_id:f.id, data, obra_id:obraId, tipo:'NORMAL', fracao:(at||sc)?0.5:1
      },{onConflict:'funcionario_id,data,competencia_id'})
    }
    if (teveObra) {
      for (const f of funcsObra) {
        await supabase.from('diarias_extras').insert({
          obra_id:obraId, funcionario_id:f.id, data, tipo:'CONTA_OBRA',
          quantidade:periodoObra==='METADE'?0.5:1, servico:servicoObra,
          observacao:`Solicitado: ${solicitou}`, descontada_producao:false, recebida_medicao:false
        })
      }
    }
    if (teveMG) {
      for (const f of funcsMG) {
        await supabase.from('diarias_extras').insert({
          obra_id:obraId, funcionario_id:f.id, data, tipo:'CONTA_MG',
          quantidade:periodoMG==='METADE'?0.5:1, servico:servicoMG,
          descontada_producao:false, recebida_medicao:false
        })
      }
    }
    const resumo = [
      `Equipe: ${equipe}`,
      `Presentes (${presentes.length}): ${presentes.map(f=>f.nome).join(', ')}`,
      atrasados.length>0?`Atrasados: ${atrasados.map(f=>`${f.nome} (${horaAtrasado[f.id]||'?'})`).join(', ')}`:null,
      saiuCedo.length>0?`Saíram cedo: ${saiuCedo.map(f=>`${f.nome} (${horaSaiu[f.id]||'?'})`).join(', ')}`:null,
      teveObra?`Conta Obra: ${servicoObra} | ${periodoObra==='METADE'?'Metade':'Dia todo'} | ${solicitou} | ${funcsObra.map(f=>f.nome).join(', ')}`:null,
      teveMG?`Conta MG: ${servicoMG} | ${periodoMG==='METADE'?'Metade':'Dia todo'} | ${funcsMG.map(f=>f.nome).join(', ')}`:null,
    ].filter(Boolean).join('\n')
    await supabase.from('folhas_ponto').insert({
      obra_id:obraId, equipe, data, foto_url:'',
      tem_diaria_extra:!!(teveObra||teveMG), observacao:resumo, processada:false
    })
    setSalvando(false)
    ir('sucesso')
  }

  if (tela==='sucesso') return (
    <div style={css.page}>
      <div style={css.top}><span style={{color:'white',fontWeight:800,fontSize:18}}>MG Campo</span></div>
      <div style={{...css.body,display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',paddingTop:48}}>
        <div style={{width:96,height:96,borderRadius:'50%',background:'#d1fae5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:48,marginBottom:24}}>✅</div>
        <div style={{fontSize:26,fontWeight:800,color:'#0f172a',marginBottom:8}}>Salvo!</div>
        <div style={{fontSize:15,color:'#64748b',marginBottom:32}}>Lançamento registrado no sistema.</div>
        <button style={css.pbtn()} onClick={resetar}>Novo lançamento</button>
      </div>
    </div>
  )

  return (
    <div style={css.page}>
      <div style={css.top}>
        {tela!=='dia' && <button onClick={goBack} style={{width:38,height:38,borderRadius:10,border:'none',background:'rgba(255,255,255,.2)',color:'white',fontSize:20,cursor:'pointer',flexShrink:0}}>←</button>}
        <div>
          <div style={{color:'white',fontWeight:800,fontSize:17}}>MG Campo</div>
          {obra && <div style={{color:'rgba(255,255,255,.6)',fontSize:12}}>{obra.nome}</div>}
        </div>
      </div>
      <div style={{background:'#1e40af',padding:'0 20px 12px',display:'flex',gap:4}}>
        {STEPS.map((_,i)=><div key={i} style={{height:3,flex:1,borderRadius:2,background:i+1<step?'white':i+1===step?'#93c5fd':'rgba(255,255,255,.25)'}}/>)}
      </div>

      {tela==='dia' && (
        <div style={css.body}>
          <div style={css.h1}>Essa diária é de hoje?</div>
          <div style={{fontSize:14,color:'#64748b',marginBottom:24}}>{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
          <div style={{display:'flex',gap:12}}>
            <div style={css.yn(false,true)} onClick={()=>{setData(new Date().toISOString().slice(0,10));ir('obra')}}>
              <div style={{fontSize:36,marginBottom:8}}>✅</div><div style={{fontSize:15,fontWeight:700}}>Sim, hoje</div>
            </div>
            <div style={css.yn(false,false)} onClick={()=>ir('confirma_dia')}>
              <div style={{fontSize:36,marginBottom:8}}>📅</div><div style={{fontSize:15,fontWeight:700}}>Outro dia</div>
            </div>
          </div>
        </div>
      )}

      {tela==='confirma_dia' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Qual a data?</div>
            <span style={css.lbl}>Selecione o dia</span>
            <input type="date" style={{...css.inp,minHeight:54}} value={data} max={new Date().toISOString().slice(0,10)} onChange={ev=>setData(ev.target.value)} />
          </div>
          <div style={css.bot}><button style={css.pbtn(!data)} disabled={!data} onClick={()=>ir('obra')}>Confirmar →</button></div>
        </>
      )}

      {tela==='obra' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Qual a obra?</div>
            <span style={css.lbl}>Selecione a obra</span>
            <select style={css.sel} value={obraId} onChange={ev=>setObraId(ev.target.value)}>
              <option value="">-- Selecione --</option>
              {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div style={css.bot}><button style={css.pbtn(!obraId)} disabled={!obraId} onClick={()=>ir('equipe')}>Continuar →</button></div>
        </>
      )}

      {tela==='equipe' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Qual a equipe?</div>
            <div style={{display:'flex',gap:12}}>
              <div style={css.yn(equipe==='ARMAÇÃO',true)} onClick={()=>{setEquipe('ARMAÇÃO');setPresentesIds([])}}>
                <div style={{fontSize:36,marginBottom:8}}>🔩</div><div style={{fontSize:15,fontWeight:700,color:equipe==='ARMAÇÃO'?'#059669':'#374151'}}>Armação</div>
              </div>
              <div style={css.yn(equipe==='CARPINTARIA',true)} onClick={()=>{setEquipe('CARPINTARIA');setPresentesIds([])}}>
                <div style={{fontSize:36,marginBottom:8}}>🪵</div><div style={{fontSize:15,fontWeight:700,color:equipe==='CARPINTARIA'?'#059669':'#374151'}}>Carpintaria</div>
              </div>
            </div>
          </div>
          <div style={css.bot}><button style={css.pbtn(!equipe)} disabled={!equipe} onClick={()=>ir('funcionarios')}>Continuar →</button></div>
        </>
      )}

      {tela==='funcionarios' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Quem estava na obra?</div>
            {funcsDisp.length===0 && funcs.length>0 ? (
              <div style={{padding:32,background:'#d1fae5',borderRadius:14,textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                <div style={{fontWeight:700,color:'#059669'}}>Todos já registrados hoje!</div>
              </div>
            ) : funcsDisp.map(f=>(
              <label key={f.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 0',borderBottom:'1px solid #f1f5f9',cursor:'pointer'}}>
                <input type="checkbox" style={css.chk} checked={presentesIds.includes(f.id)}
                  onChange={ev=>setPresentesIds(prev=>ev.target.checked?[...prev,f.id]:prev.filter(id=>id!==f.id))} />
                <span style={{fontSize:16,color:'#0f172a'}}>{f.nome}</span>
              </label>
            ))}
          </div>
          <div style={css.bot}><button style={css.pbtn(!presentesIds.length)} disabled={!presentesIds.length} onClick={()=>ir('atrasados')}>Continuar →</button></div>
        </>
      )}

      {tela==='atrasados' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Alguém chegou atrasado?</div>
            <div style={{display:'flex',gap:12,marginBottom:20}}>
              <div style={css.yn(simAtrasado===false,false)} onClick={()=>{setSimAtrasado(false);setAtrasadosIds([]);setHoraAtrasado({})}}>
                <div style={{fontSize:36,marginBottom:8}}>❌</div><div style={{fontSize:15,fontWeight:700,color:simAtrasado===false?'#dc2626':'#374151'}}>Não</div>
              </div>
              <div style={css.yn(simAtrasado===true,true)} onClick={()=>setSimAtrasado(true)}>
                <div style={{fontSize:36,marginBottom:8}}>✅</div><div style={{fontSize:15,fontWeight:700,color:simAtrasado===true?'#059669':'#374151'}}>Sim</div>
              </div>
            </div>
            {simAtrasado===true && presentes.map(f=>(
              <div key={f.id}>
                <label style={{display:'flex',alignItems:'center',gap:14,padding:'12px 0',borderBottom:'1px solid #f1f5f9',cursor:'pointer'}}>
                  <input type="checkbox" style={css.chk} checked={atrasadosIds.includes(f.id)}
                    onChange={ev=>setAtrasadosIds(prev=>ev.target.checked?[...prev,f.id]:prev.filter(id=>id!==f.id))} />
                  <span style={{fontSize:16,color:'#0f172a'}}>{f.nome}</span>
                </label>
                {atrasadosIds.includes(f.id) && (
                  <div style={{paddingLeft:36,paddingBottom:10}}>
                    <span style={{fontSize:12,color:'#64748b',display:'block',marginBottom:4}}>Que horas chegou?</span>
                    <input type="time" style={{...css.inp,width:'auto'}} value={horaAtrasado[f.id]||''} onChange={ev=>setHoraAtrasado(prev=>({...prev,[f.id]:ev.target.value}))} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={css.bot}>
            <button style={css.pbtn(simAtrasado===null||(simAtrasado===true&&(!atrasadosIds.length||atrasadosIds.some(id=>!horaAtrasado[id]))))}
              disabled={simAtrasado===null||(simAtrasado===true&&(!atrasadosIds.length||atrasadosIds.some(id=>!horaAtrasado[id])))}
              onClick={()=>ir('saiu_cedo')}>Continuar →</button>
          </div>
        </>
      )}

      {tela==='saiu_cedo' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Alguém saiu mais cedo?</div>
            <div style={{display:'flex',gap:12,marginBottom:20}}>
              <div style={css.yn(simSaiu===false,false)} onClick={()=>{setSimSaiu(false);setSaiuIds([]);setHoraSaiu({})}}>
                <div style={{fontSize:36,marginBottom:8}}>❌</div><div style={{fontSize:15,fontWeight:700,color:simSaiu===false?'#dc2626':'#374151'}}>Não</div>
              </div>
              <div style={css.yn(simSaiu===true,true)} onClick={()=>setSimSaiu(true)}>
                <div style={{fontSize:36,marginBottom:8}}>✅</div><div style={{fontSize:15,fontWeight:700,color:simSaiu===true?'#059669':'#374151'}}>Sim</div>
              </div>
            </div>
            {simSaiu===true && presentes.map(f=>(
              <div key={f.id}>
                <label style={{display:'flex',alignItems:'center',gap:14,padding:'12px 0',borderBottom:'1px solid #f1f5f9',cursor:'pointer'}}>
                  <input type="checkbox" style={css.chk} checked={saiuIds.includes(f.id)}
                    onChange={ev=>setSaiuIds(prev=>ev.target.checked?[...prev,f.id]:prev.filter(id=>id!==f.id))} />
                  <span style={{fontSize:16,color:'#0f172a'}}>{f.nome}</span>
                </label>
                {saiuIds.includes(f.id) && (
                  <div style={{paddingLeft:36,paddingBottom:10}}>
                    <span style={{fontSize:12,color:'#64748b',display:'block',marginBottom:4}}>Que horas saiu?</span>
                    <input type="time" style={{...css.inp,width:'auto'}} value={horaSaiu[f.id]||''} onChange={ev=>setHoraSaiu(prev=>({...prev,[f.id]:ev.target.value}))} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={css.bot}>
            <button style={css.pbtn(simSaiu===null||(simSaiu===true&&(!saiuIds.length||saiuIds.some(id=>!horaSaiu[id]))))}
              disabled={simSaiu===null||(simSaiu===true&&(!saiuIds.length||saiuIds.some(id=>!horaSaiu[id])))}
              onClick={()=>ir('conta_obra')}>Continuar →</button>
          </div>
        </>
      )}

      {tela==='conta_obra' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Teve diária por conta da obra?</div>
            <div style={{fontSize:14,color:'#64748b',marginBottom:20}}>Serviço extra solicitado pelo cliente</div>
            <div style={{display:'flex',gap:12}}>
              <div style={css.yn(teveObra===false,false)} onClick={()=>{setTeveObra(false);setFuncsObraIds([])}}>
                <div style={{fontSize:36,marginBottom:8}}>❌</div><div style={{fontSize:15,fontWeight:700,color:teveObra===false?'#dc2626':'#374151'}}>Não</div>
              </div>
              <div style={css.yn(teveObra===true,true)} onClick={()=>setTeveObra(true)}>
                <div style={{fontSize:36,marginBottom:8}}>✅</div><div style={{fontSize:15,fontWeight:700,color:teveObra===true?'#059669':'#374151'}}>Sim</div>
              </div>
            </div>
          </div>
          <div style={css.bot}><button style={css.pbtn(teveObra===null)} disabled={teveObra===null} onClick={()=>ir(teveObra?'conta_obra_det':'conta_mg')}>Continuar →</button></div>
        </>
      )}

      {tela==='conta_obra_det' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Detalhes — Conta Obra</div>
            <span style={css.lbl}>Quem solicitou?</span>
            <input style={css.inp} value={solicitou} onChange={ev=>setSolicitou(ev.target.value)} placeholder="Nome do responsável..." />
            <span style={css.lbl}>Período</span>
            <div style={{display:'flex',gap:12}}>
              <div style={css.yn(periodoObra==='DIA_TODO',true)} onClick={()=>setPeriodoObra('DIA_TODO')}>
                <div style={{fontSize:28,marginBottom:6}}>☀️</div><div style={{fontSize:13,fontWeight:700}}>Dia todo</div>
              </div>
              <div style={css.yn(periodoObra==='METADE',true)} onClick={()=>setPeriodoObra('METADE')}>
                <div style={{fontSize:28,marginBottom:6}}>🌤</div><div style={{fontSize:13,fontWeight:700}}>Metade</div>
              </div>
            </div>
            <span style={css.lbl}>Serviço executado</span>
            <textarea style={{...css.inp,height:90,resize:'none' as const}} value={servicoObra} onChange={ev=>setServicoObra(ev.target.value)} placeholder="Descreva o serviço..." />
            <span style={css.lbl}>Funcionários</span>
            {presentes.map(f=>(
              <label key={f.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 0',borderBottom:'1px solid #f1f5f9',cursor:'pointer'}}>
                <input type="checkbox" style={css.chk} checked={funcsObraIds.includes(f.id)}
                  onChange={ev=>setFuncsObraIds(prev=>ev.target.checked?[...prev,f.id]:prev.filter(id=>id!==f.id))} />
                <span style={{fontSize:16,color:'#0f172a'}}>{f.nome}</span>
              </label>
            ))}
          </div>
          <div style={css.bot}>
            <button style={css.pbtn(!solicitou||!periodoObra||!servicoObra||!funcsObraIds.length)}
              disabled={!solicitou||!periodoObra||!servicoObra||!funcsObraIds.length}
              onClick={()=>ir('conta_mg')}>Continuar →</button>
          </div>
        </>
      )}

      {tela==='conta_mg' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Teve diária por conta da MG?</div>
            <div style={{fontSize:14,color:'#64748b',marginBottom:20}}>Serviço extra solicitado pela MG Construções</div>
            <div style={{display:'flex',gap:12}}>
              <div style={css.yn(teveMG===false,false)} onClick={()=>{setTeveMG(false);setFuncsMGIds([])}}>
                <div style={{fontSize:36,marginBottom:8}}>❌</div><div style={{fontSize:15,fontWeight:700,color:teveMG===false?'#dc2626':'#374151'}}>Não</div>
              </div>
              <div style={css.yn(teveMG===true,true)} onClick={()=>setTeveMG(true)}>
                <div style={{fontSize:36,marginBottom:8}}>✅</div><div style={{fontSize:15,fontWeight:700,color:teveMG===true?'#059669':'#374151'}}>Sim</div>
              </div>
            </div>
          </div>
          <div style={css.bot}><button style={css.pbtn(teveMG===null)} disabled={teveMG===null} onClick={()=>ir(teveMG?'conta_mg_det':'confirmacao')}>Continuar →</button></div>
        </>
      )}

      {tela==='conta_mg_det' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Detalhes — Conta MG</div>
            <span style={css.lbl}>Período</span>
            <div style={{display:'flex',gap:12}}>
              <div style={css.yn(periodoMG==='DIA_TODO',true)} onClick={()=>setPeriodoMG('DIA_TODO')}>
                <div style={{fontSize:28,marginBottom:6}}>☀️</div><div style={{fontSize:13,fontWeight:700}}>Dia todo</div>
              </div>
              <div style={css.yn(periodoMG==='METADE',true)} onClick={()=>setPeriodoMG('METADE')}>
                <div style={{fontSize:28,marginBottom:6}}>🌤</div><div style={{fontSize:13,fontWeight:700}}>Metade</div>
              </div>
            </div>
            <span style={css.lbl}>Serviço executado</span>
            <textarea style={{...css.inp,height:90,resize:'none' as const}} value={servicoMG} onChange={ev=>setServicoMG(ev.target.value)} placeholder="Descreva o serviço..." />
            <span style={css.lbl}>Funcionários</span>
            {presentes.map(f=>(
              <label key={f.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 0',borderBottom:'1px solid #f1f5f9',cursor:'pointer'}}>
                <input type="checkbox" style={css.chk} checked={funcsMGIds.includes(f.id)}
                  onChange={ev=>setFuncsMGIds(prev=>ev.target.checked?[...prev,f.id]:prev.filter(id=>id!==f.id))} />
                <span style={{fontSize:16,color:'#0f172a'}}>{f.nome}</span>
              </label>
            ))}
          </div>
          <div style={css.bot}>
            <button style={css.pbtn(!periodoMG||!servicoMG||!funcsMGIds.length)}
              disabled={!periodoMG||!servicoMG||!funcsMGIds.length}
              onClick={()=>ir('confirmacao')}>Continuar →</button>
          </div>
        </>
      )}

      {tela==='confirmacao' && (
        <>
          <div style={css.body}>
            <div style={css.h1}>Confirmar</div>
            <div style={{background:'white',border:'2px solid #e2e8f0',borderRadius:16,padding:16,marginBottom:14}}>
              <div style={css.row}><span style={{fontSize:13,color:'#64748b'}}>Obra</span><span style={{fontSize:13,fontWeight:700,color:azul}}>{obra?.nome}</span></div>
              <div style={css.row}><span style={{fontSize:13,color:'#64748b'}}>Data</span><span style={{fontSize:13,fontWeight:600}}>{new Date(data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</span></div>
              <div style={css.row}><span style={{fontSize:13,color:'#64748b'}}>Equipe</span><span style={{fontSize:13,fontWeight:600}}>{equipe}</span></div>
              <div style={css.row}><span style={{fontSize:13,color:'#64748b',minWidth:80}}>Presentes</span><span style={{fontSize:13,fontWeight:600,color:'#059669',textAlign:'right'}}>{presentes.map(f=>f.nome).join(', ')}</span></div>
              {atrasados.length>0&&<div style={css.row}><span style={{fontSize:13,color:'#64748b',minWidth:80}}>Atrasados</span><span style={{fontSize:13,fontWeight:600,color:'#92400e',textAlign:'right'}}>{atrasados.map(f=>`${f.nome} (${horaAtrasado[f.id]||'?'})`).join(', ')}</span></div>}
              {saiuCedo.length>0&&<div style={css.row}><span style={{fontSize:13,color:'#64748b',minWidth:80}}>Saíram cedo</span><span style={{fontSize:13,fontWeight:600,color:'#92400e',textAlign:'right'}}>{saiuCedo.map(f=>`${f.nome} (${horaSaiu[f.id]||'?'})`).join(', ')}</span></div>}
              {teveObra&&<>
                <div style={{fontSize:11,fontWeight:700,color:'#64748b',margin:'14px 0 8px',textTransform:'uppercase'}}>Conta Obra</div>
                <div style={css.row}><span style={{fontSize:13,color:'#64748b'}}>Solicitou</span><span style={{fontSize:13,fontWeight:600}}>{solicitou}</span></div>
                <div style={css.row}><span style={{fontSize:13,color:'#64748b'}}>Período</span><span style={{fontSize:13,fontWeight:600}}>{periodoObra==='DIA_TODO'?'Dia todo':'Metade'}</span></div>
                <div style={css.row}><span style={{fontSize:13,color:'#64748b',minWidth:80}}>Serviço</span><span style={{fontSize:13,fontWeight:600,textAlign:'right'}}>{servicoObra}</span></div>
                <div style={css.row}><span style={{fontSize:13,color:'#64748b',minWidth:80}}>Funcs</span><span style={{fontSize:13,fontWeight:600,textAlign:'right'}}>{funcsObra.map(f=>f.nome).join(', ')}</span></div>
              </>}
              {teveMG&&<>
                <div style={{fontSize:11,fontWeight:700,color:'#64748b',margin:'14px 0 8px',textTransform:'uppercase'}}>Conta MG</div>
                <div style={css.row}><span style={{fontSize:13,color:'#64748b'}}>Período</span><span style={{fontSize:13,fontWeight:600}}>{periodoMG==='DIA_TODO'?'Dia todo':'Metade'}</span></div>
                <div style={css.row}><span style={{fontSize:13,color:'#64748b',minWidth:80}}>Serviço</span><span style={{fontSize:13,fontWeight:600,textAlign:'right'}}>{servicoMG}</span></div>
                <div style={css.row}><span style={{fontSize:13,color:'#64748b',minWidth:80}}>Funcs</span><span style={{fontSize:13,fontWeight:600,textAlign:'right'}}>{funcsMG.map(f=>f.nome).join(', ')}</span></div>
              </>}
            </div>
          </div>
          <div style={css.bot}>
            <button style={css.pbtn(salvando)} disabled={salvando} onClick={salvar}>{salvando?'⏳ Salvando...':'✓ Confirmar e salvar'}</button>
            <button style={css.sbtn} onClick={()=>ir('dia')}>Voltar ao início</button>
          </div>
        </>
      )}
    </div>
  )
}






























