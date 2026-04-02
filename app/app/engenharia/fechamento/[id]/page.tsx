'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'
import Link from 'next/link'

interface Producao { id: string; servico: string; pavimento: string; unidade: string; quantidade: number; valor_unitario: number; percentual_medido: number; ordem: number }
interface Diaria { id: string; funcionario_id: string; nome: string; qtd_total: number; diarias_descontadas: number; valor_diaria: number; valor_passagem: number; complemento_passagem: number; total: number }
interface Distribuicao { id: string; nome: string; valor: number; observacao: string }

export default function FechamentoPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [fechamento, setFechamento] = useState<any>(null)
  const [producao, setProducao] = useState<Producao[]>([])
  const [diarias, setDiarias] = useState<Diaria[]>([])
  const [distribuicao, setDistribuicao] = useState<Distribuicao[]>([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<'producao'|'diarias'|'distribuicao'>('producao')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [novaLinha, setNovaLinha] = useState({ servico:'', pavimento:'', unidade:'KG', quantidade:'', valor_unitario:'', percentual_medido:'' })
  const [novaDist, setNovaDist] = useState({ nome:'', valor:'', observacao:'' })

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    setLoading(true)
    const [{ data: fech }, { data: prod }, { data: diar }, { data: dist }] = await Promise.all([
      supabase.from('fechamentos').select('*, obras(id,nome,codigo)').eq('id', id).single(),
      supabase.from('fechamento_producao').select('*').eq('fechamento_id', id).order('ordem'),
      supabase.from('fechamento_diarias').select('*, funcionarios(nome)').eq('fechamento_id', id).order('total', { ascending: false }),
      supabase.from('fechamento_distribuicao').select('*').eq('fechamento_id', id),
    ])
    setFechamento(fech)
    setProducao(prod || [])
    setDiarias((diar || []).map((d: any) => ({ ...d, nome: d.funcionarios?.nome || '' })))
    setDistribuicao(dist || [])
    setLoading(false)
  }

  const saldoProducao = producao.reduce((s, p) => s + ((p.quantidade||0) * (p.valor_unitario||0)), 0)
  const totalDiarias = diarias.reduce((s, d) => s + (d.total||0), 0)
  const saldoDistribuir = saldoProducao - totalDiarias
  const totalDistribuido = distribuicao.reduce((s, d) => s + (d.valor||0), 0)
  const saldoRestante = saldoDistribuir - totalDistribuido

  async function atualizarTotais(sp: number, td: number) {
    await supabase.from('fechamentos').update({ saldo_producao: sp, total_diarias: td, saldo_distribuir: sp - td }).eq('id', id)
  }

  async function addProducao() {
    if (!novaLinha.servico || !novaLinha.quantidade || !novaLinha.valor_unitario) {
      setMsg('⚠️ Preencha serviço, quantidade e valor.'); setTimeout(()=>setMsg(''),3000); return
    }
    const ordem = (producao.length || 0) + 1
    const { error } = await supabase.from('fechamento_producao').insert({
      fechamento_id: id,
      item: ordem,
      servico: novaLinha.servico,
      pavimento: novaLinha.pavimento,
      unidade: novaLinha.unidade,
      quantidade: parseFloat(novaLinha.quantidade),
      valor_unitario: parseFloat(novaLinha.valor_unitario),
      percentual_medido: parseFloat(novaLinha.percentual_medido) || 0,
      ordem,
    })
    if (error) { setMsg('Erro: ' + error.message); return }
    setNovaLinha({ servico:'', pavimento:'', unidade:'KG', quantidade:'', valor_unitario:'', percentual_medido:'' })
    await carregar()
    const sp = producao.reduce((s,p) => s+(p.quantidade||0)*(p.valor_unitario||0), 0) + parseFloat(novaLinha.quantidade) * parseFloat(novaLinha.valor_unitario)
    await atualizarTotais(sp, totalDiarias)
  }

  async function removeProducao(pid: string) {
    await supabase.from('fechamento_producao').delete().eq('id', pid)
    await carregar()
  }

  async function editProducao(pid: string, field: string, val: string) {
    await supabase.from('fechamento_producao').update({ [field]: parseFloat(val) || 0 }).eq('id', pid)
    await carregar()
  }

  async function carregarDiarias() {
    if (!fechamento) return
    setSalvando(true); setMsg('Buscando presenças no período...')
    
    const obraId = (fechamento.obras as any)?.id || fechamento.obra_id
    
    const { data: presencas, error: presError } = await supabase
      .from('presencas')
      .select('funcionario_id, fracao, fracao2, tipo, obra_id, funcionarios(nome, valor_diaria)')
      .gte('data', fechamento.periodo_inicio)
      .lte('data', fechamento.periodo_fim)

    if (presError) { setMsg('Erro ao buscar presenças: ' + presError.message); setSalvando(false); return }

    // Filtrar pela obra
    const presObra = (presencas || []).filter((p: any) => p.obra_id === obraId)

    if (presObra.length === 0) {
      setMsg('⚠️ Nenhuma presença encontrada nesta obra no período selecionado.')
      setSalvando(false); setTimeout(()=>setMsg(''),5000); return
    }

    // Agrupar por funcionário
    const mapa: Record<string, { nome:string; dias:number; diaria:number }> = {}
    presObra.forEach((p: any) => {
      if (['FALTA','ATESTADO','AUSENTE','SAIU'].includes(p.tipo)) return
      const soma = (p.fracao||0) + (p.fracao2||0)
      if (!mapa[p.funcionario_id]) mapa[p.funcionario_id] = { nome: (p.funcionarios as any)?.nome||'', dias:0, diaria: (p.funcionarios as any)?.valor_diaria||0 }
      mapa[p.funcionario_id].dias += soma
    })

    if (Object.keys(mapa).length === 0) {
      setMsg('⚠️ Nenhum dia válido encontrado no período.'); setSalvando(false); setTimeout(()=>setMsg(''),5000); return
    }

    // Buscar passagens
    const funcIds = Object.keys(mapa)
    const { data: passagens } = await supabase
      .from('funcionario_obra_passagem')
      .select('funcionario_id,valor_passagem,tipo_passagem')
      .eq('obra_id', obraId)
      .in('funcionario_id', funcIds)

    const passMap: Record<string,number> = {}
    passagens?.forEach((p: any) => { passMap[p.funcionario_id] = p.tipo_passagem === 'PRA FRENTE' ? (p.valor_passagem||0) : 0 })

    // Inserir ou atualizar
    let inseridos = 0
    for (const [funcId, info] of Object.entries(mapa)) {
      const passagem = passMap[funcId] || 0
      const total = info.dias * (info.diaria + passagem)
      const { data: ex } = await supabase.from('fechamento_diarias').select('id').eq('fechamento_id', id).eq('funcionario_id', funcId).maybeSingle()
      if (ex) {
        await supabase.from('fechamento_diarias').update({ qtd_total: info.dias, valor_diaria: info.diaria, valor_passagem: passagem, total }).eq('id', ex.id)
      } else {
        await supabase.from('fechamento_diarias').insert({ fechamento_id: id, funcionario_id: funcId, qtd_total: info.dias, diarias_descontadas: 0, valor_diaria: info.diaria, valor_passagem: passagem, complemento_passagem: 0, total })
      }
      inseridos++
    }

    // Auto-preencher distribuição com os funcionários encontrados
    for (const [funcId, info] of Object.entries(mapa)) {
      const { data: exDist } = await supabase.from('fechamento_distribuicao')
        .select('id').eq('fechamento_id', id).eq('funcionario_id', funcId).maybeSingle()
      if (!exDist) {
        await supabase.from('fechamento_distribuicao').insert({
          fechamento_id: id, funcionario_id: funcId, nome: info.nome, valor: 0, observacao: ''
        })
      }
    }

    await carregar()
    setMsg(`✅ ${inseridos} funcionários carregados! Distribuição preenchida automaticamente.`)
    setTimeout(()=>setMsg(''),4000)
    setSalvando(false)
    setAba('diarias')
  }

  async function updateDiaria(did: string, field: string, val: number) {
    const d = diarias.find(d => d.id === did); if (!d) return
    const upd: any = { ...d, [field]: val }
    const dias = Math.max(0, upd.qtd_total - upd.diarias_descontadas)
    const total = dias * (upd.valor_diaria + upd.valor_passagem + upd.complemento_passagem)
    await supabase.from('fechamento_diarias').update({ [field]: val, total: Math.max(0, total) }).eq('id', did)
    await carregar()
    const td = diarias.map(d2 => d2.id === did ? total : d2.total).reduce((s,v) => s+v, 0)
    await atualizarTotais(saldoProducao, td)
  }

  async function addDistribuicao() {
    if (!novaDist.nome || !novaDist.valor) return
    await supabase.from('fechamento_distribuicao').insert({ fechamento_id: id, nome: novaDist.nome, valor: parseFloat(novaDist.valor), observacao: novaDist.observacao })
    setNovaDist({ nome:'', valor:'', observacao:'' })
    await carregar()
  }

  async function removeDist(did: string) { await supabase.from('fechamento_distribuicao').delete().eq('id', did); await carregar() }
  async function mudarStatus(status: string) { await supabase.from('fechamentos').update({ status }).eq('id', id); await carregar() }

  if (loading) return <div style={{textAlign:'center',padding:48,color:'#9ca3af'}}>Carregando...</div>
  if (!fechamento) return <div style={{textAlign:'center',padding:48}}>Não encontrado.</div>

  const dataI = new Date(fechamento.periodo_inicio+'T12:00').toLocaleDateString('pt-BR')
  const dataF = new Date(fechamento.periodo_fim+'T12:00').toLocaleDateString('pt-BR')
  const inpStyle = { border:'1.5px solid #fbbf24', borderRadius:6, padding:'5px 8px', fontSize:12, background:'#fefce8', textAlign:'right' as const, outline:'none', width:'100%' }
  const inpRed = { ...inpStyle, border:'1.5px solid #fca5a5', background:'#fef2f2' }

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <Link href="/app/engenharia">
            <button style={{background:'white',border:'1px solid #e5e7eb',borderRadius:8,padding:'7px 14px',cursor:'pointer',color:'#6b7280',fontSize:13,display:'flex',alignItems:'center',gap:6}}>
              ← Voltar
            </button>
          </Link>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <h1 style={{fontSize:20,fontWeight:800,color:'#1f2937'}}>
                Fechamento #{String(fechamento.numero).padStart(2,'0')} — {(fechamento.obras as any)?.nome}
              </h1>
              <span style={{fontSize:11,fontWeight:700,padding:'3px 12px',borderRadius:20,background:fechamento.status==='APROVADO'?'#d1fae5':fechamento.status==='FECHADO'?'#f3f4f6':'#fef3c7',color:fechamento.status==='APROVADO'?'#065f46':fechamento.status==='FECHADO'?'#6b7280':'#92400e'}}>
                {fechamento.status}
              </span>
            </div>
            <p style={{fontSize:13,color:'#9ca3af',marginTop:3}}>
              {dataI} até {dataF}{fechamento.encarregado?` · Enc: ${fechamento.encarregado}`:''}{fechamento.descricao?` · ${fechamento.descricao}`:''}
            </p>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {fechamento.status==='ABERTO' && <button onClick={()=>mudarStatus('APROVADO')} style={{background:'#059669',color:'white',border:'none',borderRadius:8,padding:'8px 18px',cursor:'pointer',fontSize:13,fontWeight:600}}>✓ Aprovar</button>}
          {fechamento.status==='APROVADO' && <button onClick={()=>mudarStatus('FECHADO')} style={{background:'#6b7280',color:'white',border:'none',borderRadius:8,padding:'8px 18px',cursor:'pointer',fontSize:13,fontWeight:600}}>🔒 Fechar</button>}
          {fechamento.status==='FECHADO' && <button onClick={()=>mudarStatus('ABERTO')} style={{background:'#1e3a8a',color:'white',border:'none',borderRadius:8,padding:'8px 18px',cursor:'pointer',fontSize:13,fontWeight:600}}>🔓 Reabrir</button>}
          <button onClick={()=>window.print()} style={{background:'white',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontSize:13,color:'#6b7280'}}>🖨 Imprimir</button>
        </div>
      </div>

      {msg && <div style={{background:msg.includes('✅')?'#f0fdf4':msg.includes('⚠')?'#fffbeb':'#fef2f2',border:`1px solid ${msg.includes('✅')?'#bbf7d0':msg.includes('⚠')?'#fde68a':'#fecaca'}`,borderRadius:10,padding:'10px 16px',marginBottom:14,fontSize:13,color:msg.includes('✅')?'#166534':msg.includes('⚠')?'#92400e':'#991b1b'}}>{msg}</div>}

      {/* Cards resumo */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {label:'Saldo da Produção',val:saldoProducao,color:'#1e3a8a',bg:'#eff6ff'},
          {label:'Total das Diárias',val:totalDiarias,color:'#dc2626',bg:'#fef2f2',neg:true},
          {label:'Saldo p/ Distribuir',val:saldoDistribuir,color:saldoDistribuir>=0?'#059669':'#dc2626',bg:saldoDistribuir>=0?'#f0fdf4':'#fef2f2'},
          {label:'Saldo Restante',val:saldoRestante,color:saldoRestante>=0?'#059669':'#dc2626',bg:saldoRestante>=0?'#f0fdf4':'#fef2f2'},
        ].map((c,i)=>(
          <div key={i} style={{background:c.bg,borderRadius:12,padding:'16px 18px',border:`1px solid ${c.color}22`}}>
            <div style={{fontSize:11,color:'#9ca3af',marginBottom:4}}>{c.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:c.color}}>{(c as any).neg&&totalDiarias>0?'-':''}{formatR$(Math.abs(c.val))}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{display:'flex',gap:0,marginBottom:0,borderBottom:'2px solid #e5e7eb'}}>
        {([{key:'producao',label:'📊 Levantamento de Produção'},{key:'diarias',label:'👷 Desconto de Diárias'},{key:'distribuicao',label:'💰 Distribuição do Saldo'}] as const).map(a=>(
          <button key={a.key} onClick={()=>setAba(a.key)} style={{padding:'11px 22px',border:'none',background:'transparent',cursor:'pointer',fontSize:13,fontWeight:aba===a.key?700:400,color:aba===a.key?'#1e3a8a':'#6b7280',borderBottom:aba===a.key?'2px solid #1e3a8a':'2px solid transparent',marginBottom:-2,transition:'all .15s'}}>
            {a.label}
          </button>
        ))}
      </div>

      <div style={{marginTop:16}}>

        {/* ── PRODUÇÃO ── */}
        {aba==='producao'&&(
          <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:12,overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
              <colgroup>
                <col style={{width:50}}/>
                <col style={{width:'25%'}}/>
                <col style={{width:'20%'}}/>
                <col style={{width:60}}/>
                <col style={{width:80}}/>
                <col style={{width:110}}/>
                <col style={{width:110}}/>
                <col style={{width:120}}/>
                <col style={{width:50}}/>
              </colgroup>
              <thead>
                <tr style={{background:'#1e3a8a'}}>
                  {['Item','Serviço Executado','Pavimento','Un.','% Med.','Quantidade','Valor Unit.','Valor Parcial',''].map((h,i)=>(
                    <th key={i} style={{color:'white',padding:'10px 12px',textAlign:i>=4&&i<=7?'right':'left',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {producao.map((p,fi)=>(
                  <tr key={p.id} style={{background:fi%2===0?'white':'#f9fafb',borderBottom:'1px solid #f3f4f6'}}>
                    <td style={{padding:'8px 12px',fontSize:12,color:'#9ca3af',textAlign:'center'}}>{fi+1}</td>
                    <td style={{padding:'8px 12px',fontSize:13,fontWeight:500,color:'#1f2937',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.servico}</td>
                    <td style={{padding:'8px 12px',fontSize:12,color:'#6b7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.pavimento}</td>
                    <td style={{padding:'8px 12px',fontSize:12,textAlign:'center'}}>{p.unidade}</td>
                    <td style={{padding:'6px 8px',textAlign:'right'}}>
                      <input type="number" step="0.1" defaultValue={p.percentual_medido||''} placeholder="0" style={inpStyle} onBlur={e=>editProducao(p.id,'percentual_medido',e.target.value)}/>
                    </td>
                    <td style={{padding:'6px 8px',textAlign:'right'}}>
                      <input type="number" step="0.01" defaultValue={p.quantidade} style={inpStyle} onBlur={e=>editProducao(p.id,'quantidade',e.target.value)}/>
                    </td>
                    <td style={{padding:'6px 8px',textAlign:'right'}}>
                      <input type="number" step="0.01" defaultValue={p.valor_unitario} style={inpStyle} onBlur={e=>editProducao(p.id,'valor_unitario',e.target.value)}/>
                    </td>
                    <td style={{padding:'8px 12px',textAlign:'right',fontWeight:700,color:'#1e3a8a',fontSize:13}}>{formatR$((p.quantidade||0)*(p.valor_unitario||0))}</td>
                    <td style={{padding:'8px 12px',textAlign:'center'}}>
                      <button onClick={()=>removeProducao(p.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:18,lineHeight:1}}>×</button>
                    </td>
                  </tr>
                ))}
                {/* Nova linha */}
                <tr style={{background:'#f0f9ff',borderTop:'2px dashed #bfdbfe'}}>
                  <td style={{padding:'8px 12px',fontSize:12,color:'#9ca3af',textAlign:'center'}}>+</td>
                  <td style={{padding:'6px 8px'}}>
                    <input placeholder="Serviço executado..." style={{border:'1px solid #d1d5db',borderRadius:6,padding:'6px 8px',fontSize:12,width:'100%',outline:'none'}} value={novaLinha.servico} onChange={e=>setNovaLinha(n=>({...n,servico:e.target.value}))}/>
                  </td>
                  <td style={{padding:'6px 8px'}}>
                    <input placeholder="Pavimento..." style={{border:'1px solid #d1d5db',borderRadius:6,padding:'6px 8px',fontSize:12,width:'100%',outline:'none'}} value={novaLinha.pavimento} onChange={e=>setNovaLinha(n=>({...n,pavimento:e.target.value}))}/>
                  </td>
                  <td style={{padding:'6px 8px'}}>
                    <select style={{border:'1px solid #d1d5db',borderRadius:6,padding:'6px 4px',fontSize:12,width:'100%'}} value={novaLinha.unidade} onChange={e=>setNovaLinha(n=>({...n,unidade:e.target.value}))}>
                      <option>KG</option><option>M²</option><option>M³</option><option>M</option><option>UN</option>
                    </select>
                  </td>
                  <td style={{padding:'6px 8px'}}>
                    <input type="number" placeholder="0" style={{border:'1px solid #d1d5db',borderRadius:6,padding:'6px 8px',fontSize:12,width:'100%',textAlign:'right',outline:'none'}} value={novaLinha.percentual_medido} onChange={e=>setNovaLinha(n=>({...n,percentual_medido:e.target.value}))}/>
                  </td>
                  <td style={{padding:'6px 8px'}}>
                    <input type="number" placeholder="0" style={{border:'1px solid #d1d5db',borderRadius:6,padding:'6px 8px',fontSize:12,width:'100%',textAlign:'right',outline:'none'}} value={novaLinha.quantidade} onChange={e=>setNovaLinha(n=>({...n,quantidade:e.target.value}))}/>
                  </td>
                  <td style={{padding:'6px 8px'}}>
                    <input type="number" placeholder="0,00" style={{border:'1px solid #d1d5db',borderRadius:6,padding:'6px 8px',fontSize:12,width:'100%',textAlign:'right',outline:'none'}} value={novaLinha.valor_unitario} onChange={e=>setNovaLinha(n=>({...n,valor_unitario:e.target.value}))}/>
                  </td>
                  <td style={{padding:'8px 12px',textAlign:'right',fontSize:12,color:'#6b7280',fontWeight:600}}>
                    {novaLinha.quantidade&&novaLinha.valor_unitario?formatR$(parseFloat(novaLinha.quantidade)*parseFloat(novaLinha.valor_unitario)):'—'}
                  </td>
                  <td style={{padding:'6px 8px',textAlign:'center'}}>
                    <button onClick={addProducao} style={{background:'#1e3a8a',color:'white',border:'none',borderRadius:6,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>+ Add</button>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{background:'#1e3a8a'}}>
                  <td colSpan={7} style={{padding:'11px 12px',color:'white',fontWeight:700,fontSize:13}}>SALDO DA PRODUÇÃO</td>
                  <td style={{padding:'11px 12px',textAlign:'right',color:'#93c5fd',fontWeight:800,fontSize:16}}>{formatR$(saldoProducao)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ── DIÁRIAS ── */}
        {aba==='diarias'&&(
          <div>
            <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
              <button onClick={carregarDiarias} disabled={salvando}
                style={{background:'#1e3a8a',color:'white',border:'none',borderRadius:8,padding:'9px 18px',cursor:salvando?'not-allowed':'pointer',fontSize:13,fontWeight:600,opacity:salvando?.7:1}}>
                {salvando?'⏳ Buscando...':'🔄 Carregar presenças do período'}
              </button>
              <span style={{fontSize:12,color:'#9ca3af'}}>Busca na obra <strong>{(fechamento.obras as any)?.nome}</strong> de {dataI} a {dataF}</span>
            </div>
            <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:12,overflow:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
                <colgroup>
                  <col style={{width:40}}/><col/><col style={{width:90}}/><col style={{width:110}}/><col style={{width:110}}/><col style={{width:110}}/><col style={{width:110}}/><col style={{width:140}}/>
                </colgroup>
                <thead>
                  <tr style={{background:'#1e3a8a'}}>
                    {['Nº','Nome','Qtd Total','Dias Desc.','Vl Diária','Vl Passagem','Complemento','Total'].map((h,i)=>(
                      <th key={i} style={{color:'white',padding:'10px 12px',textAlign:i>=2?'right':'left',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diarias.length===0&&(
                    <tr><td colSpan={8} style={{padding:40,textAlign:'center',color:'#9ca3af',fontSize:13}}>
                      Clique em "Carregar presenças do período" para buscar automaticamente.
                    </td></tr>
                  )}
                  {diarias.map((d,fi)=>{
                    const diasEf = Math.max(0, d.qtd_total - d.diarias_descontadas)
                    return (
                      <tr key={d.id} style={{background:fi%2===0?'white':'#f9fafb',borderBottom:'1px solid #f3f4f6'}}>
                        <td style={{padding:'8px 12px',fontSize:12,color:'#9ca3af',textAlign:'center'}}>{fi+1}</td>
                        <td style={{padding:'8px 12px',fontSize:13,fontWeight:600,color:'#1f2937',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.nome}</td>
                        <td style={{padding:'8px 12px',textAlign:'right',fontWeight:700,color:'#1e3a8a'}}>{d.qtd_total}</td>
                        <td style={{padding:'6px 8px',textAlign:'right'}}>
                          <input type="number" step="0.5" min="0" defaultValue={d.diarias_descontadas||0} style={inpRed} onBlur={e=>updateDiaria(d.id,'diarias_descontadas',parseFloat(e.target.value)||0)}/>
                        </td>
                        <td style={{padding:'6px 8px',textAlign:'right'}}>
                          <input type="number" step="0.01" defaultValue={d.valor_diaria} style={inpStyle} onBlur={e=>updateDiaria(d.id,'valor_diaria',parseFloat(e.target.value)||0)}/>
                        </td>
                        <td style={{padding:'6px 8px',textAlign:'right'}}>
                          <input type="number" step="0.01" defaultValue={d.valor_passagem} style={inpStyle} onBlur={e=>updateDiaria(d.id,'valor_passagem',parseFloat(e.target.value)||0)}/>
                        </td>
                        <td style={{padding:'6px 8px',textAlign:'right'}}>
                          <input type="number" step="0.01" defaultValue={d.complemento_passagem||0} style={inpStyle} onBlur={e=>updateDiaria(d.id,'complemento_passagem',parseFloat(e.target.value)||0)}/>
                        </td>
                        <td style={{padding:'8px 12px',textAlign:'right'}}>
                          <div style={{fontWeight:700,color:'#dc2626',fontSize:13}}>{formatR$(d.total)}</div>
                          <div style={{fontSize:10,color:'#9ca3af'}}>{diasEf} dias efetivos</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {diarias.length>0&&(
                  <tfoot>
                    <tr style={{background:'#1e3a8a'}}>
                      <td colSpan={7} style={{padding:'11px 12px',color:'white',fontWeight:700,fontSize:13}}>TOTAL DAS DIÁRIAS</td>
                      <td style={{padding:'11px 12px',textAlign:'right',color:'#fca5a5',fontWeight:800,fontSize:16}}>-{formatR$(totalDiarias)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ── DISTRIBUIÇÃO ── */}
        {aba==='distribuicao'&&(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
              {[
                {label:'Saldo p/ Distribuir',val:saldoDistribuir,color:'#1e3a8a',bg:'#eff6ff'},
                {label:'Total Distribuído',val:totalDistribuido,color:'#92400e',bg:'#fef9c3'},
                {label:'Saldo Restante',val:saldoRestante,color:saldoRestante>=0?'#059669':'#dc2626',bg:saldoRestante>=0?'#f0fdf4':'#fef2f2'},
              ].map((c,i)=>(
                <div key={i} style={{background:c.bg,border:`1px solid ${c.color}22`,borderRadius:10,padding:'16px 18px'}}>
                  <div style={{fontSize:11,color:'#9ca3af',marginBottom:4}}>{c.label}</div>
                  <div style={{fontSize:22,fontWeight:800,color:c.color}}>{formatR$(c.val)}</div>
                </div>
              ))}
            </div>
            <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:12,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#1e3a8a'}}>
                    {['Nº','Nome / Beneficiário','Valor (R$)','Observação',''].map((h,i)=>(
                      <th key={i} style={{color:'white',padding:'10px 14px',textAlign:i===2?'right':'left',fontSize:11,fontWeight:600}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {distribuicao.map((d,fi)=>(
                    <tr key={d.id} style={{background:fi%2===0?'white':'#f9fafb',borderBottom:'1px solid #f3f4f6'}}>
                      <td style={{padding:'10px 14px',fontSize:12,color:'#9ca3af',width:40}}>{fi+1}</td>
                      <td style={{padding:'10px 14px',fontSize:13,fontWeight:600,color:'#1f2937'}}>{d.nome}</td>
                      <td style={{padding:'10px 14px',textAlign:'right',fontWeight:700,color:'#059669',fontSize:14}}>{formatR$(d.valor)}</td>
                      <td style={{padding:'10px 14px',fontSize:12,color:'#6b7280'}}>{d.observacao||'—'}</td>
                      <td style={{padding:'10px 14px',textAlign:'center'}}>
                        <button onClick={()=>removeDist(d.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:18,lineHeight:1}}>×</button>
                      </td>
                    </tr>
                  ))}
                  {/* Nova linha */}
                  <tr style={{background:'#f0fdf4',borderTop:'2px dashed #bbf7d0'}}>
                    <td style={{padding:'8px 14px',fontSize:12,color:'#9ca3af'}}>+</td>
                    <td style={{padding:'6px 10px'}}>
                      <input placeholder="Nome do beneficiário..." style={{border:'1px solid #d1d5db',borderRadius:6,padding:'7px 10px',fontSize:13,width:'100%',outline:'none'}} value={novaDist.nome} onChange={e=>setNovaDist(n=>({...n,nome:e.target.value}))}/>
                    </td>
                    <td style={{padding:'6px 10px'}}>
                      <input type="number" step="0.01" placeholder="0,00" style={{border:'1px solid #d1d5db',borderRadius:6,padding:'7px 10px',fontSize:13,width:'100%',textAlign:'right',outline:'none'}} value={novaDist.valor} onChange={e=>setNovaDist(n=>({...n,valor:e.target.value}))}/>
                    </td>
                    <td style={{padding:'6px 10px'}}>
                      <input placeholder="Observação..." style={{border:'1px solid #d1d5db',borderRadius:6,padding:'7px 10px',fontSize:13,width:'100%',outline:'none'}} value={novaDist.observacao} onChange={e=>setNovaDist(n=>({...n,observacao:e.target.value}))}/>
                    </td>
                    <td style={{padding:'6px 10px',textAlign:'center'}}>
                      <button onClick={addDistribuicao} style={{background:'#059669',color:'white',border:'none',borderRadius:6,padding:'7px 16px',cursor:'pointer',fontSize:13,fontWeight:600}}>+ Add</button>
                    </td>
                  </tr>
                </tbody>
                {distribuicao.length>0&&(
                  <tfoot>
                    <tr style={{background:'#059669'}}>
                      <td colSpan={2} style={{padding:'11px 14px',color:'white',fontWeight:700,fontSize:13}}>TOTAL DISTRIBUÍDO</td>
                      <td style={{padding:'11px 14px',textAlign:'right',color:'#d1fae5',fontWeight:800,fontSize:16}}>{formatR$(totalDistribuido)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
