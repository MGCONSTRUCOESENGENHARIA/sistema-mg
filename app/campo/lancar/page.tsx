'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function CampoLancar() {
  const [tela, setTela] = useState(0)
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)

  const [data, setData] = useState(new Date().toISOString().slice(0,10))
  const [obraId, setObraId] = useState('')
  const [equipe, setEquipe] = useState('')
  const [presentes, setPresentes] = useState<string[]>([])
  const [simAtrasado, setSimAtrasado] = useState('')
  const [atrasados, setAtrasados] = useState<string[]>([])
  const [horaAt, setHoraAt] = useState<Record<string,string>>({})
  const [simSaiu, setSimSaiu] = useState('')
  const [saiuCedo, setSaiuCedo] = useState<string[]>([])
  const [horaSc, setHoraSc] = useState<Record<string,string>>({})
  const [teveObra, setTeveObra] = useState('')
  const [solicitou, setSolicitou] = useState('')
  const [periodoObra, setPeriodoObra] = useState('')
  const [servicoObra, setServicoObra] = useState('')
  const [funcsObra, setFuncsObra] = useState<string[]>([])
  const [teveMG, setTeveMG] = useState('')
  const [periodoMG, setPeriodoMG] = useState('')
  const [servicoMG, setServicoMG] = useState('')
  const [funcsMG, setFuncsMG] = useState<string[]>([])

  useEffect(() => {
    supabase.from('obras').select('id,nome').eq('status','ATIVA').order('nome').then(({data:d})=>setObras(d||[]))
  }, [])

  useEffect(() => {
    if (!equipe) return
    supabase.from('funcionarios').select('id,nome').eq('ativo',true).eq('equipe',equipe).order('nome').then(({data:d})=>setFuncs(d||[]))
  }, [equipe])

  const obra = obras.find(o=>o.id===obraId)
  const presentesFuncs = funcs.filter(f=>presentes.includes(f.id))
  const atrasadosFuncs = funcs.filter(f=>atrasados.includes(f.id))
  const saiuFuncs = funcs.filter(f=>saiuCedo.includes(f.id))
  const funcsObraList = funcs.filter(f=>funcsObra.includes(f.id))
  const funcsMGList = funcs.filter(f=>funcsMG.includes(f.id))

  const azul = '#1e3a8a'
  const s = {
    page: {minHeight:'100vh',background:'#f1f5f9',fontFamily:'system-ui,sans-serif'},
    top: {background:azul,padding:'16px 20px',display:'flex',alignItems:'center' as const,gap:12},
    body: {padding:'24px 20px'},
    h1: {fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:16},
    btn: (ok:boolean):any => ({width:'100%',padding:16,borderRadius:12,border:'none',background:ok?azul:'#94a3b8',color:'white',fontSize:16,fontWeight:700,cursor:ok?'pointer':'not-allowed',marginTop:16}),
    sel: {width:'100%',padding:'14px 16px',fontSize:16,borderRadius:12,border:'2px solid #cbd5e1',background:'white',color:'#111',marginTop:8} as any,
    inp: {width:'100%',padding:'14px 16px',fontSize:16,borderRadius:12,border:'2px solid #cbd5e1',background:'white',color:'#111',boxSizing:'border-box' as const,marginTop:8},
    chk: (sel:boolean):any => ({display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderRadius:12,border:`2px solid ${sel?azul:'#e2e8f0'}`,background:sel?'#eff6ff':'white',cursor:'pointer',marginTop:8}),
    yn: (sel:boolean,verde:boolean):any => ({flex:1,padding:'20px 12px',borderRadius:14,textAlign:'center' as const,cursor:'pointer',border:`2px solid ${sel?(verde?'#059669':'#dc2626'):'#e2e8f0'}`,background:sel?(verde?'#d1fae5':'#fee2e2'):'white'}),
    lbl: {fontSize:13,fontWeight:700,color:'#374151',display:'block' as const,marginTop:20,marginBottom:4},
  }

  function toggle(list:string[], setList:any, id:string) {
    setList((prev:string[]) => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])
  }

  async function salvar() {
    setSalvando(true)
    const mes = data.slice(0,7)
    let {data:comp} = await supabase.from('competencias').select('id').eq('mes_ano',mes).maybeSingle()
    if (!comp) { const {data:n} = await supabase.from('competencias').insert({mes_ano:mes,status:'ABERTA'}).select().single(); comp=n }

    for (const f of presentesFuncs) {
      const at = atrasadosFuncs.find(a=>a.id===f.id)
      const sc = saiuFuncs.find(s=>s.id===f.id)
      await supabase.from('presencas').upsert({
        competencia_id:comp!.id,funcionario_id:f.id,data,obra_id:obraId,tipo:'NORMAL',fracao:(at||sc)?0.5:1
      },{onConflict:'funcionario_id,data,competencia_id'})
    }
    if (teveObra==='sim') {
      for (const f of funcsObraList) {
        await supabase.from('diarias_extras').insert({
          obra_id:obraId,funcionario_id:f.id,data,tipo:'CONTA_OBRA',
          quantidade:periodoObra==='metade'?0.5:1,servico:servicoObra,
          observacao:`Solicitado: ${solicitou}`,descontada_producao:false,recebida_medicao:false
        })
      }
    }
    if (teveMG==='sim') {
      for (const f of funcsMGList) {
        await supabase.from('diarias_extras').insert({
          obra_id:obraId,funcionario_id:f.id,data,tipo:'CONTA_MG',
          quantidade:periodoMG==='metade'?0.5:1,servico:servicoMG,
          descontada_producao:false,recebida_medicao:false
        })
      }
    }
    await supabase.from('folhas_ponto').insert({
      obra_id:obraId,equipe,data,foto_url:'',
      tem_diaria_extra:!!(teveObra==='sim'||teveMG==='sim'),
      observacao:[
        `Equipe: ${equipe}`,
        `Presentes: ${presentesFuncs.map(f=>f.nome).join(', ')}`,
        atrasadosFuncs.length?`Atrasados: ${atrasadosFuncs.map(f=>`${f.nome}(${horaAt[f.id]||'?'})`).join(', ')}`:null,
        saiuFuncs.length?`Saíram cedo: ${saiuFuncs.map(f=>`${f.nome}(${horaSc[f.id]||'?'})`).join(', ')}`:null,
        teveObra==='sim'?`Conta Obra: ${servicoObra} | ${periodoObra} | ${solicitou} | ${funcsObraList.map(f=>f.nome).join(', ')}`:null,
        teveMG==='sim'?`Conta MG: ${servicoMG} | ${periodoMG} | ${funcsMGList.map(f=>f.nome).join(', ')}`:null,
      ].filter(Boolean).join('\n'),
      processada:false
    })
    setSalvando(false)
    setTela(99)
  }

  if (tela===99) return (
    <div style={s.page}>
      <div style={s.top}><span style={{color:'white',fontWeight:800,fontSize:18}}>MG Campo</span></div>
      <div style={{...s.body,textAlign:'center',paddingTop:60}}>
        <div style={{fontSize:60,marginBottom:16}}>✅</div>
        <div style={{fontSize:24,fontWeight:800,marginBottom:8}}>Salvo!</div>
        <div style={{fontSize:15,color:'#64748b',marginBottom:32}}>Lançamento registrado com sucesso.</div>
        <button style={s.btn(true)} onClick={()=>{
          setTela(0);setObraId('');setEquipe('');setPresentes([]);setSimAtrasado('');setAtrasados({} as any);setHoraAt({});setSimSaiu('');setSaiuCedo([]);setHoraSc({});setTeveObra('');setSolicitou('');setPeriodoObra('');setServicoObra('');setFuncsObra([]);setTeveMG('');setPeriodoMG('');setServicoMG('');setFuncsMG([])
        }}>Novo lançamento</button>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.top}>
        {tela>0 && <button onClick={()=>setTela(t=>t-1)} style={{background:'rgba(255,255,255,.2)',border:'none',color:'white',width:36,height:36,borderRadius:8,fontSize:18,cursor:'pointer'}}>←</button>}
        <span style={{color:'white',fontWeight:800,fontSize:17}}>MG Campo</span>
      </div>

      {/* TELA 0: DIA */}
      {tela===0 && (
        <div style={s.body}>
          <div style={s.h1}>Essa diária é de hoje?</div>
          <div style={{display:'flex',gap:12}}>
            <div style={s.yn(false,true)} onClick={()=>{setData(new Date().toISOString().slice(0,10));setTela(1)}}>
              <div style={{fontSize:36}}>✅</div><div style={{fontWeight:700,marginTop:8}}>Sim, hoje</div>
            </div>
            <div style={s.yn(false,false)} onClick={()=>setTela(-1)}>
              <div style={{fontSize:36}}>📅</div><div style={{fontWeight:700,marginTop:8}}>Outro dia</div>
            </div>
          </div>
        </div>
      )}

      {/* TELA -1: DATA */}
      {tela===-1 && (
        <div style={s.body}>
          <div style={s.h1}>Qual a data?</div>
          <input type="date" style={{...s.inp,fontSize:18,minHeight:54}} value={data} max={new Date().toISOString().slice(0,10)} onChange={ev=>setData(ev.target.value)} />
          <button style={s.btn(!!data)} disabled={!data} onClick={()=>setTela(1)}>Confirmar →</button>
        </div>
      )}

      {/* TELA 1: OBRA */}
      {tela===1 && (
        <div style={s.body}>
          <div style={s.h1}>Qual a obra?</div>
          <select style={s.sel} value={obraId} onChange={ev=>setObraId(ev.target.value)}>
            <option value="">-- Selecione --</option>
            {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <button style={s.btn(!!obraId)} disabled={!obraId} onClick={()=>setTela(2)}>Continuar →</button>
        </div>
      )}

      {/* TELA 2: EQUIPE */}
      {tela===2 && (
        <div style={s.body}>
          <div style={s.h1}>Qual a equipe?</div>
          <div style={{display:'flex',gap:12}}>
            <div style={s.yn(equipe==='ARMAÇÃO',true)} onClick={()=>setEquipe('ARMAÇÃO')}>
              <div style={{fontSize:36}}>🔩</div><div style={{fontWeight:700,marginTop:8}}>Armação</div>
            </div>
            <div style={s.yn(equipe==='CARPINTARIA',true)} onClick={()=>setEquipe('CARPINTARIA')}>
              <div style={{fontSize:36}}>🪵</div><div style={{fontWeight:700,marginTop:8}}>Carpintaria</div>
            </div>
          </div>
          <button style={s.btn(!!equipe)} disabled={!equipe} onClick={()=>setTela(3)}>Continuar →</button>
        </div>
      )}

      {/* TELA 3: FUNCIONÁRIOS */}
      {tela===3 && (
        <div style={s.body}>
          <div style={s.h1}>Quem estava na obra?</div>
          {funcs.map(f=>(
            <div key={f.id} style={s.chk(presentes.includes(f.id))} onClick={()=>toggle(presentes,setPresentes,f.id)}>
              <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${presentes.includes(f.id)?azul:'#cbd5e1'}`,background:presentes.includes(f.id)?azul:'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {presentes.includes(f.id)&&<span style={{color:'white',fontSize:14,fontWeight:700}}>✓</span>}
              </div>
              <span style={{fontSize:16,color:'#0f172a'}}>{f.nome}</span>
            </div>
          ))}
          <button style={s.btn(presentes.length>0)} disabled={presentes.length===0} onClick={()=>setTela(4)}>Continuar →</button>
        </div>
      )}

      {/* TELA 4: ATRASADOS */}
      {tela===4 && (
        <div style={s.body}>
          <div style={s.h1}>Alguém chegou atrasado?</div>
          <div style={{display:'flex',gap:12}}>
            <div style={s.yn(simAtrasado==='nao',false)} onClick={()=>{setSimAtrasado('nao');setAtrasados([])}}>
              <div style={{fontSize:36}}>❌</div><div style={{fontWeight:700,marginTop:8}}>Não</div>
            </div>
            <div style={s.yn(simAtrasado==='sim',true)} onClick={()=>setSimAtrasado('sim')}>
              <div style={{fontSize:36}}>✅</div><div style={{fontWeight:700,marginTop:8}}>Sim</div>
            </div>
          </div>
          {simAtrasado==='sim' && (
            <div style={{marginTop:16}}>
              {presentesFuncs.map(f=>(
                <div key={f.id}>
                  <div style={s.chk(atrasados.includes(f.id))} onClick={()=>toggle(atrasados,setAtrasados,f.id)}>
                    <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${atrasados.includes(f.id)?azul:'#cbd5e1'}`,background:atrasados.includes(f.id)?azul:'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {atrasados.includes(f.id)&&<span style={{color:'white',fontSize:14}}>✓</span>}
                    </div>
                    <span style={{fontSize:16}}>{f.nome}</span>
                  </div>
                  {atrasados.includes(f.id)&&(
                    <div style={{paddingLeft:16,marginTop:4,marginBottom:8}}>
                      <span style={{fontSize:12,color:'#64748b'}}>Horário de chegada:</span>
                      <input type="time" style={{...s.inp,marginTop:4}} value={horaAt[f.id]||''} onChange={ev=>setHoraAt(p=>({...p,[f.id]:ev.target.value}))} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <button style={s.btn(simAtrasado==='nao'||(simAtrasado==='sim'&&atrasados.length>0&&atrasados.every(id=>horaAt[id])))}
            disabled={!(simAtrasado==='nao'||(simAtrasado==='sim'&&atrasados.length>0&&atrasados.every(id=>horaAt[id])))}
            onClick={()=>setTela(5)}>Continuar →</button>
        </div>
      )}

      {/* TELA 5: SAIU CEDO */}
      {tela===5 && (
        <div style={s.body}>
          <div style={s.h1}>Alguém saiu mais cedo?</div>
          <div style={{display:'flex',gap:12}}>
            <div style={s.yn(simSaiu==='nao',false)} onClick={()=>{setSimSaiu('nao');setSaiuCedo([])}}>
              <div style={{fontSize:36}}>❌</div><div style={{fontWeight:700,marginTop:8}}>Não</div>
            </div>
            <div style={s.yn(simSaiu==='sim',true)} onClick={()=>setSimSaiu('sim')}>
              <div style={{fontSize:36}}>✅</div><div style={{fontWeight:700,marginTop:8}}>Sim</div>
            </div>
          </div>
          {simSaiu==='sim' && (
            <div style={{marginTop:16}}>
              {presentesFuncs.map(f=>(
                <div key={f.id}>
                  <div style={s.chk(saiuCedo.includes(f.id))} onClick={()=>toggle(saiuCedo,setSaiuCedo,f.id)}>
                    <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${saiuCedo.includes(f.id)?azul:'#cbd5e1'}`,background:saiuCedo.includes(f.id)?azul:'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {saiuCedo.includes(f.id)&&<span style={{color:'white',fontSize:14}}>✓</span>}
                    </div>
                    <span style={{fontSize:16}}>{f.nome}</span>
                  </div>
                  {saiuCedo.includes(f.id)&&(
                    <div style={{paddingLeft:16,marginTop:4,marginBottom:8}}>
                      <span style={{fontSize:12,color:'#64748b'}}>Horário de saída:</span>
                      <input type="time" style={{...s.inp,marginTop:4}} value={horaSc[f.id]||''} onChange={ev=>setHoraSc(p=>({...p,[f.id]:ev.target.value}))} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <button style={s.btn(simSaiu==='nao'||(simSaiu==='sim'&&saiuCedo.length>0&&saiuCedo.every(id=>horaSc[id])))}
            disabled={!(simSaiu==='nao'||(simSaiu==='sim'&&saiuCedo.length>0&&saiuCedo.every(id=>horaSc[id])))}
            onClick={()=>setTela(6)}>Continuar →</button>
        </div>
      )}

      {/* TELA 6: CONTA OBRA */}
      {tela===6 && (
        <div style={s.body}>
          <div style={s.h1}>Teve diária por conta da obra?</div>
          <div style={{display:'flex',gap:12}}>
            <div style={s.yn(teveObra==='nao',false)} onClick={()=>setTeveObra('nao')}>
              <div style={{fontSize:36}}>❌</div><div style={{fontWeight:700,marginTop:8}}>Não</div>
            </div>
            <div style={s.yn(teveObra==='sim',true)} onClick={()=>setTeveObra('sim')}>
              <div style={{fontSize:36}}>✅</div><div style={{fontWeight:700,marginTop:8}}>Sim</div>
            </div>
          </div>
          {teveObra==='sim' && (
            <div>
              <span style={s.lbl}>Quem solicitou?</span>
              <input style={s.inp} value={solicitou} onChange={ev=>setSolicitou(ev.target.value)} placeholder="Nome do responsável..." />
              <span style={s.lbl}>Período</span>
              <div style={{display:'flex',gap:12,marginTop:8}}>
                <div style={s.yn(periodoObra==='dia_todo',true)} onClick={()=>setPeriodoObra('dia_todo')}>
                  <div style={{fontSize:28}}>☀️</div><div style={{fontWeight:700,marginTop:6,fontSize:13}}>Dia todo</div>
                </div>
                <div style={s.yn(periodoObra==='metade',true)} onClick={()=>setPeriodoObra('metade')}>
                  <div style={{fontSize:28}}>🌤</div><div style={{fontWeight:700,marginTop:6,fontSize:13}}>Metade</div>
                </div>
              </div>
              <span style={s.lbl}>Serviço executado</span>
              <textarea style={{...s.inp,height:80,resize:'none'}} value={servicoObra} onChange={ev=>setServicoObra(ev.target.value)} placeholder="Descreva o serviço..." />
              <span style={s.lbl}>Funcionários</span>
              {presentesFuncs.map(f=>(
                <div key={f.id} style={s.chk(funcsObra.includes(f.id))} onClick={()=>toggle(funcsObra,setFuncsObra,f.id)}>
                  <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${funcsObra.includes(f.id)?azul:'#cbd5e1'}`,background:funcsObra.includes(f.id)?azul:'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {funcsObra.includes(f.id)&&<span style={{color:'white',fontSize:14}}>✓</span>}
                  </div>
                  <span style={{fontSize:16}}>{f.nome}</span>
                </div>
              ))}
            </div>
          )}
          <button style={s.btn(teveObra==='nao'||(teveObra==='sim'&&!!solicitou&&!!periodoObra&&!!servicoObra&&funcsObra.length>0))}
            disabled={!(teveObra==='nao'||(teveObra==='sim'&&!!solicitou&&!!periodoObra&&!!servicoObra&&funcsObra.length>0))}
            onClick={()=>setTela(7)}>Continuar →</button>
        </div>
      )}

      {/* TELA 7: CONTA MG */}
      {tela===7 && (
        <div style={s.body}>
          <div style={s.h1}>Teve diária por conta da MG?</div>
          <div style={{display:'flex',gap:12}}>
            <div style={s.yn(teveMG==='nao',false)} onClick={()=>setTeveMG('nao')}>
              <div style={{fontSize:36}}>❌</div><div style={{fontWeight:700,marginTop:8}}>Não</div>
            </div>
            <div style={s.yn(teveMG==='sim',true)} onClick={()=>setTeveMG('sim')}>
              <div style={{fontSize:36}}>✅</div><div style={{fontWeight:700,marginTop:8}}>Sim</div>
            </div>
          </div>
          {teveMG==='sim' && (
            <div>
              <span style={s.lbl}>Período</span>
              <div style={{display:'flex',gap:12,marginTop:8}}>
                <div style={s.yn(periodoMG==='dia_todo',true)} onClick={()=>setPeriodoMG('dia_todo')}>
                  <div style={{fontSize:28}}>☀️</div><div style={{fontWeight:700,marginTop:6,fontSize:13}}>Dia todo</div>
                </div>
                <div style={s.yn(periodoMG==='metade',true)} onClick={()=>setPeriodoMG('metade')}>
                  <div style={{fontSize:28}}>🌤</div><div style={{fontWeight:700,marginTop:6,fontSize:13}}>Metade</div>
                </div>
              </div>
              <span style={s.lbl}>Serviço executado</span>
              <textarea style={{...s.inp,height:80,resize:'none'}} value={servicoMG} onChange={ev=>setServicoMG(ev.target.value)} placeholder="Descreva o serviço..." />
              <span style={s.lbl}>Funcionários</span>
              {presentesFuncs.map(f=>(
                <div key={f.id} style={s.chk(funcsMG.includes(f.id))} onClick={()=>toggle(funcsMG,setFuncsMG,f.id)}>
                  <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${funcsMG.includes(f.id)?azul:'#cbd5e1'}`,background:funcsMG.includes(f.id)?azul:'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {funcsMG.includes(f.id)&&<span style={{color:'white',fontSize:14}}>✓</span>}
                  </div>
                  <span style={{fontSize:16}}>{f.nome}</span>
                </div>
              ))}
            </div>
          )}
          <button style={s.btn(teveMG==='nao'||(teveMG==='sim'&&!!periodoMG&&!!servicoMG&&funcsMG.length>0))}
            disabled={!(teveMG==='nao'||(teveMG==='sim'&&!!periodoMG&&!!servicoMG&&funcsMG.length>0))}
            onClick={()=>setTela(8)}>Continuar →</button>
        </div>
      )}

      {/* TELA 8: CONFIRMAÇÃO */}
      {tela===8 && (
        <div style={s.body}>
          <div style={s.h1}>Confirmar</div>
          <div style={{background:'white',borderRadius:14,padding:16,border:'2px solid #e2e8f0'}}>
            <div style={{padding:'8px 0',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b',fontSize:13}}>Obra</span><span style={{fontWeight:700,color:'#1e3a8a',fontSize:13}}>{obra?.nome}</span></div>
            <div style={{padding:'8px 0',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b',fontSize:13}}>Data</span><span style={{fontWeight:600,fontSize:13}}>{new Date(data+'T12:00').toLocaleDateString('pt-BR')}</span></div>
            <div style={{padding:'8px 0',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between'}}><span style={{color:'#64748b',fontSize:13}}>Equipe</span><span style={{fontWeight:600,fontSize:13}}>{equipe}</span></div>
            <div style={{padding:'8px 0',borderBottom:'1px solid #f1f5f9',display:'flex',gap:12,justifyContent:'space-between'}}><span style={{color:'#64748b',fontSize:13,flexShrink:0}}>Presentes</span><span style={{fontWeight:600,fontSize:13,color:'#059669',textAlign:'right'}}>{presentesFuncs.map(f=>f.nome).join(', ')}</span></div>
            {atrasadosFuncs.length>0&&<div style={{padding:'8px 0',borderBottom:'1px solid #f1f5f9',display:'flex',gap:12,justifyContent:'space-between'}}><span style={{color:'#64748b',fontSize:13,flexShrink:0}}>Atrasados</span><span style={{fontWeight:600,fontSize:13,color:'#92400e',textAlign:'right'}}>{atrasadosFuncs.map(f=>`${f.nome}(${horaAt[f.id]||'?'})`).join(', ')}</span></div>}
            {saiuFuncs.length>0&&<div style={{padding:'8px 0',borderBottom:'1px solid #f1f5f9',display:'flex',gap:12,justifyContent:'space-between'}}><span style={{color:'#64748b',fontSize:13,flexShrink:0}}>Saíram cedo</span><span style={{fontWeight:600,fontSize:13,color:'#92400e',textAlign:'right'}}>{saiuFuncs.map(f=>`${f.nome}(${horaSc[f.id]||'?'})`).join(', ')}</span></div>}
            {teveObra==='sim'&&<><div style={{fontSize:11,fontWeight:700,color:'#64748b',margin:'12px 0 4px',textTransform:'uppercase'}}>Conta Obra</div>
              <div style={{padding:'4px 0',fontSize:13}}>{servicoObra} | {periodoObra==='dia_todo'?'Dia todo':'Metade'} | {solicitou}</div>
              <div style={{padding:'4px 0',fontSize:13,color:'#059669'}}>{funcsObraList.map(f=>f.nome).join(', ')}</div></>}
            {teveMG==='sim'&&<><div style={{fontSize:11,fontWeight:700,color:'#64748b',margin:'12px 0 4px',textTransform:'uppercase'}}>Conta MG</div>
              <div style={{padding:'4px 0',fontSize:13}}>{servicoMG} | {periodoMG==='dia_todo'?'Dia todo':'Metade'}</div>
              <div style={{padding:'4px 0',fontSize:13,color:'#059669'}}>{funcsMGList.map(f=>f.nome).join(', ')}</div></>}
          </div>
          <button style={s.btn(!salvando)} disabled={salvando} onClick={salvar}>{salvando?'Salvando...':'✓ Confirmar e salvar'}</button>
          <button onClick={()=>setTela(0)} style={{width:'100%',padding:14,borderRadius:12,border:'2px solid #e2e8f0',background:'white',color:'#374151',fontSize:15,fontWeight:600,cursor:'pointer',marginTop:10}}>Voltar ao início</button>
        </div>
      )}
    </div>
  )
}
