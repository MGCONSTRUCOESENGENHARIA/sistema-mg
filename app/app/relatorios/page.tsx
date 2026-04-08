'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'

type TipoRel = 'funcionario' | 'obra' | 'faltas' | 'resumo'

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState<TipoRel>('funcionario')
  const [dataInicio, setDataInicio] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10) })
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0,10))
  const [equipe, setEquipe] = useState('')
  const [obraId, setObraId] = useState('')
  const [funcId, setFuncId] = useState('')
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const mes = dataInicio.slice(0,7)

  useEffect(() => {
    supabase.from('obras').select('id,nome,codigo').eq('status','ATIVA').order('nome').then(({data}) => setObras(data||[]))
    supabase.from('funcionarios').select('id,nome,equipe,valor_diaria,salario_base').eq('ativo',true).order('equipe').order('nome').then(({data}) => setFuncs(data||[]))
  }, [])

  function setQuinzena(q: 1|2) {
    const hoje = new Date(); const ano = hoje.getFullYear(); const m = hoje.getMonth()
    if (q===1) { setDataInicio(new Date(ano,m,1).toISOString().slice(0,10)); setDataFim(new Date(ano,m,15).toISOString().slice(0,10)) }
    else { setDataInicio(new Date(ano,m,16).toISOString().slice(0,10)); setDataFim(new Date(ano,m+1,0).toISOString().slice(0,10)) }
  }
  function setMesCompleto() {
    const hoje = new Date()
    setDataInicio(new Date(hoje.getFullYear(),hoje.getMonth(),1).toISOString().slice(0,10))
    setDataFim(new Date(hoje.getFullYear(),hoje.getMonth()+1,0).toISOString().slice(0,10))
  }

  async function gerar() {
    setLoading(true); setDados(null)
    const { data: presencas } = await supabase.from('presencas')
      .select('funcionario_id,data,tipo,fracao,fracao2,obra_id,funcionarios(id,nome,equipe,valor_diaria,salario_base),obras:obra_id(nome,codigo)')
      .gte('data', dataInicio).lte('data', dataFim)
      .then(r => { let q = r; return r })

    // Buscar dados financeiros
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    
    let passagens: any[] = []
    let pagAdiant: any[] = []
    let avulsosParcelas: any[] = []
    
    if (comp?.id) {
      const [{ data: pass }, { data: pags }, { data: avs }] = await Promise.all([
        supabase.from('passagens_quinzena').select('funcionario_id,total_passagem,total_cafe,quinzena').eq('competencia_id', comp.id),
        supabase.from('pagamentos').select('funcionario_id,total_pagamento,tipo').eq('competencia_id', comp.id),
        supabase.from('avulso_parcelas').select('*, avulsos(funcionario_id)').eq('mes_ano', mes),
      ])
      passagens = pass || []
      pagAdiant = pags || []
      avulsosParcelas = avs || []
    }

    if (tipo === 'funcionario') {
      const mapa: Record<string, any> = {}
      let filtradas = (presencas || []).filter((p: any) => {
        if (!p.funcionarios) return false
        if (equipe && p.funcionarios.equipe !== equipe) return false
        if (funcId && p.funcionario_id !== funcId) return false
        if (obraId && p.obra_id !== obraId) return false
        return true
      })
      filtradas.forEach((p: any) => {
        const f = p.funcionarios
        if (!mapa[f.id]) mapa[f.id] = { id:f.id, nome:f.nome, equipe:f.equipe, diaria:f.valor_diaria, salario:f.salario_base, dias:0, extras:0, faltas:0, aus:0, valor_diarias:0, dias_detalhe:[] }
        if (p.tipo === 'FALTA') { mapa[f.id].faltas++; mapa[f.id].dias_detalhe.push({ data:p.data, tipo:'FALTA', obra:'' }); return }
        if (['ATESTADO','AUSENTE','SAIU','X'].includes(p.tipo)) { mapa[f.id].aus++; mapa[f.id].dias_detalhe.push({ data:p.data, tipo:p.tipo, obra:'' }); return }
        const soma = (p.fracao||0)+(p.fracao2||0)
        if (p.tipo === 'SABADO_EXTRA') mapa[f.id].extras += soma
        else mapa[f.id].dias += soma
        mapa[f.id].valor_diarias += soma * f.valor_diaria
        mapa[f.id].dias_detalhe.push({ data:p.data, tipo:p.tipo, obra:(p.obras as any)?.nome||'', fracao:soma })
      })

      // Financeiro por funcionário
      Object.keys(mapa).forEach(fid => {
        const pass1 = passagens.filter(p => p.funcionario_id === fid && p.quinzena === 1).reduce((s: number, p: any) => s + (p.total_passagem||0), 0)
        const cafe1 = passagens.filter(p => p.funcionario_id === fid && p.quinzena === 1).reduce((s: number, p: any) => s + (p.total_cafe||0), 0)
        const pass2 = passagens.filter(p => p.funcionario_id === fid && p.quinzena === 2).reduce((s: number, p: any) => s + (p.total_passagem||0), 0)
        const cafe2 = passagens.filter(p => p.funcionario_id === fid && p.quinzena === 2).reduce((s: number, p: any) => s + (p.total_cafe||0), 0)
        const adiant = pagAdiant.find(p => p.funcionario_id === fid && p.tipo === 'adiantamento')?.total_pagamento || 0
        const descontos = avulsosParcelas.filter((a: any) => a.avulsos?.funcionario_id === fid).reduce((s: number, a: any) => s + (a.valor||0), 0)
        mapa[fid].passagem_total = pass1 + pass2
        mapa[fid].cafe_total = cafe1 + cafe2
        mapa[fid].adiantamento = adiant
        mapa[fid].descontos = descontos
        mapa[fid].total_receber = mapa[fid].valor_diarias + pass1 + pass2 + cafe1 + cafe2 - descontos
      })

      const lista = Object.values(mapa).sort((a: any, b: any) => a.nome.localeCompare(b.nome))
      setDados({ tipo:'funcionario', lista })
    }

    if (tipo === 'obra') {
      const mapa: Record<string, any> = {}
      ;(presencas||[]).forEach((p: any) => {
        const f = p.funcionarios; const o = p.obras as any
        if (!f || !o) return
        if (equipe && f.equipe !== equipe) return
        if (!mapa[p.obra_id]) mapa[p.obra_id] = { obra:o.nome, codigo:o.codigo, funcs:{} }
        if (!mapa[p.obra_id].funcs[f.id]) mapa[p.obra_id].funcs[f.id] = { nome:f.nome, equipe:f.equipe, diaria:f.valor_diaria, dias:0, extras:0, valor:0 }
        if (['FALTA','ATESTADO','AUSENTE','SAIU','X'].includes(p.tipo)) return
        const soma = (p.fracao||0)+(p.fracao2||0)
        if (p.tipo === 'SABADO_EXTRA') mapa[p.obra_id].funcs[f.id].extras += soma
        else mapa[p.obra_id].funcs[f.id].dias += soma
        mapa[p.obra_id].funcs[f.id].valor += soma * f.valor_diaria
      })
      setDados({ tipo:'obra', lista:Object.values(mapa).sort((a:any,b:any) => a.obra.localeCompare(b.obra)) })
    }

    if (tipo === 'faltas') {
      const mapa: Record<string, any> = {}
      ;(presencas||[]).filter((p: any) => {
        if (!p.funcionarios) return false
        if (equipe && p.funcionarios.equipe !== equipe) return false
        return true
      }).forEach((p: any) => {
        const f = p.funcionarios
        if (!mapa[f.id]) mapa[f.id] = { nome:f.nome, equipe:f.equipe, faltas:0, ausentes:0, atestados:0, total_dias:0, dias_falta:[] }
        mapa[f.id].total_dias++
        if (p.tipo === 'FALTA') { mapa[f.id].faltas++; mapa[f.id].dias_falta.push(p.data) }
        if (p.tipo === 'AUSENTE') mapa[f.id].ausentes++
        if (p.tipo === 'ATESTADO') mapa[f.id].atestados++
      })
      // Incluir funcionários sem nenhuma presença no período
      funcs.filter(f => !equipe || f.equipe === equipe).forEach(f => {
        if (!mapa[f.id]) mapa[f.id] = { nome:f.nome, equipe:f.equipe, faltas:0, ausentes:0, atestados:0, total_dias:0, dias_falta:[] }
      })
      const lista = Object.values(mapa).sort((a:any,b:any) => b.faltas - a.faltas)
      const semFaltas = lista.filter((l:any) => l.faltas === 0)
      setDados({ tipo:'faltas', lista, semFaltas })
    }

    if (tipo === 'resumo') {
      const porEquipe: Record<string, any> = { 'ARMAÇÃO':{ equipe:'ARMAÇÃO', funcs:new Set(), dias:0, valor:0, faltas:0 }, 'CARPINTARIA':{ equipe:'CARPINTARIA', funcs:new Set(), dias:0, valor:0, faltas:0 } }
      ;(presencas||[]).forEach((p: any) => {
        const f = p.funcionarios; if (!f) return
        const eq = porEquipe[f.equipe]; if (!eq) return
        eq.funcs.add(f.id)
        if (p.tipo === 'FALTA') { eq.faltas++; return }
        if (['ATESTADO','AUSENTE','SAIU','X'].includes(p.tipo)) return
        const soma = (p.fracao||0)+(p.fracao2||0)
        eq.dias += soma; eq.valor += soma * f.valor_diaria
      })
      const totalAdiant = pagAdiant.filter(p => p.tipo==='adiantamento').reduce((s:number,p:any) => s+p.total_pagamento, 0)
      setDados({ tipo:'resumo', equipes:Object.values(porEquipe).map((e:any) => ({...e, funcs:e.funcs.size})), totalAdiant })
    }

    setLoading(false)
  }

  const nomeDia = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const fmtData = (s: string) => { const d = new Date(s+'T12:00'); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${nomeDia[d.getDay()]}` }

  const btnTipo = (t: TipoRel, label: string) => (
    <button onClick={() => setTipo(t)}
      style={{ padding:'7px 16px', borderRadius:8, border:'2px solid #1a3a5c', background:tipo===t?'#1a3a5c':'#fff', color:tipo===t?'#fff':'#1a3a5c', cursor:'pointer', fontWeight:700, fontSize:13 }}>
      {label}
    </button>
  )

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#1a3a5c' }}>Relatórios</h1>
        <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Filtre por período e gere relatórios individuais ou por obra</p>
      </div>

      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:16, marginBottom:16 }}>
        {/* Tipos */}
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
          {btnTipo('funcionario','👤 Por Funcionário')}
          {btnTipo('obra','🏗 Por Obra')}
          {btnTipo('faltas','❌ Faltas')}
          {btnTipo('resumo','📊 Resumo Geral')}
        </div>

        {/* Período */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }}>Período</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:12, color:'#6b7280' }}>De</span>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ border:'1px solid #d1d5db', borderRadius:6, padding:'6px 8px', fontSize:13 }} />
            <span style={{ fontSize:12, color:'#6b7280' }}>até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ border:'1px solid #d1d5db', borderRadius:6, padding:'6px 8px', fontSize:13 }} />
            <button onClick={() => setQuinzena(1)} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontSize:12 }}>1ª Quinzena</button>
            <button onClick={() => setQuinzena(2)} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontSize:12 }}>2ª Quinzena</button>
            <button onClick={setMesCompleto} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontSize:12 }}>Mês completo</button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Equipe</label>
            <select value={equipe} onChange={e => setEquipe(e.target.value)} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 8px', fontSize:13, outline:'none' }}>
              <option value="">Todas</option>
              <option value="ARMAÇÃO">Armação</option>
              <option value="CARPINTARIA">Carpintaria</option>
            </select>
          </div>
          {tipo === 'funcionario' && (
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Funcionário</label>
              <select value={funcId} onChange={e => setFuncId(e.target.value)} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 8px', fontSize:13, outline:'none' }}>
                <option value="">Todos</option>
                {funcs.filter(f => !equipe || f.equipe===equipe).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          )}
          {(tipo==='funcionario'||tipo==='obra') && (
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Obra</label>
              <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 8px', fontSize:13, outline:'none' }}>
                <option value="">Todas</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={gerar} disabled={loading}
            style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#1a3a5c', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:14 }}>
            {loading ? '⏳ Gerando...' : '▶ Gerar Relatório'}
          </button>
          {dados && <button onClick={() => window.print()} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #6b7280', background:'#fff', cursor:'pointer', fontSize:13 }}>🖨 Imprimir</button>}
        </div>
      </div>

      {/* RESULTADO */}
      {dados?.tipo === 'funcionario' && dados.lista.map((d: any) => (
        <div key={d.id} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:20, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
            <div>
              <h2 style={{ fontSize:18, fontWeight:800, color:'#1a3a5c', marginBottom:2 }}>{d.nome}</h2>
              <p style={{ fontSize:12, color:'#6b7280' }}>{d.equipe} · Período: {fmtData(dataInicio)} a {fmtData(dataFim)}</p>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'#9ca3af' }}>Valor da diária</div>
              <div style={{ fontSize:18, fontWeight:800, color:'#1a3a5c' }}>{formatR$(d.diaria)}</div>
            </div>
          </div>

          {/* Cards resumo */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:14 }}>
            {[
              { label:'Diárias trabalhadas', val:d.dias.toFixed(1), color:'#166534', bg:'#f0fdf4' },
              { label:'Extras (sábado)', val:d.extras.toFixed(1), color:'#6d28d9', bg:'#f5f3ff' },
              { label:'Faltas', val:d.faltas, color:'#dc2626', bg:'#fef2f2' },
              { label:'Ausências', val:d.aus, color:'#6b7280', bg:'#f9fafb' },
            ].map((c,i) => (
              <div key={i} style={{ background:c.bg, borderRadius:8, padding:'10px 14px' }}>
                <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>{c.label}</div>
                <div style={{ fontSize:22, fontWeight:800, color:c.color, lineHeight:1 }}>{c.val}</div>
              </div>
            ))}
          </div>

          {/* Financeiro */}
          <div style={{ background:'#f9fafb', borderRadius:8, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1a3a5c', marginBottom:10 }}>Financeiro</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { label:'Salário base', val:d.salario },
                { label:`Valor diárias (${d.dias.toFixed(1)} × ${formatR$(d.diaria)})`, val:d.valor_diarias },
                d.extras > 0 && { label:`Extras sábado (${d.extras.toFixed(1)} × ${formatR$(d.diaria)})`, val:d.extras*d.diaria },
                d.passagem_total > 0 && { label:'Passagem total', val:d.passagem_total },
                d.cafe_total > 0 && { label:'Café total', val:d.cafe_total },
                d.adiantamento > 0 && { label:'Adiantamento pago', val:-d.adiantamento, neg:true },
                d.descontos > 0 && { label:'Descontos', val:-d.descontos, neg:true },
              ].filter(Boolean).map((item: any, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                  <span style={{ color:'#6b7280' }}>{item.label}</span>
                  <span style={{ fontWeight:600, color:item.neg?'#dc2626':'#1f2937' }}>{item.neg&&item.val<0?'-':''}{formatR$(Math.abs(item.val))}</span>
                </div>
              ))}
              <div style={{ borderTop:'2px solid #e5e7eb', paddingTop:8, marginTop:4, display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, color:'#1a3a5c' }}>TOTAL A RECEBER</span>
                <span style={{ fontWeight:800, fontSize:16, color:'#166534' }}>{formatR$(d.total_receber||d.valor_diarias)}</span>
              </div>
            </div>
          </div>

          {/* Detalhe por dia */}
          {d.dias_detalhe.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Detalhe por dia</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {d.dias_detalhe.sort((a:any,b:any) => a.data.localeCompare(b.data)).map((dd: any, i: number) => (
                  <span key={i} style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background: dd.tipo==='FALTA'?'#fee2e2':dd.tipo==='X'?'#f3f4f6':dd.obra?'#dbeafe':'#fef9c3', color:dd.tipo==='FALTA'?'#991b1b':dd.tipo==='X'?'#374151':dd.obra?'#1e40af':'#92400e', fontWeight:500 }}>
                    {fmtData(dd.data)} — {dd.tipo==='FALTA'?'FALTA':dd.tipo==='X'?'X':dd.obra||dd.tipo}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {dados?.tipo === 'obra' && dados.lista.map((o: any, oi: number) => {
        const funcsArr = Object.values(o.funcs).sort((a:any,b:any) => b.valor-a.valor)
        const totalObra = funcsArr.reduce((s:number,f:any) => s+f.valor, 0)
        return (
          <div key={oi} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden', marginBottom:14 }}>
            <div style={{ background:'#1a3a5c', padding:'12px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>{o.obra}</span>
              <span style={{ color:'#93c5fd', fontWeight:700 }}>{formatR$(totalObra)}</span>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  {['Funcionário','Equipe','Diárias','Extras','Valor'].map((h,i) => (
                    <th key={i} style={{ padding:'8px 14px', textAlign:i>=2?'center':'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funcsArr.map((f: any, fi: number) => (
                  <tr key={fi} style={{ borderBottom:'1px solid #f3f4f6', background:fi%2===0?'#fff':'#f9fafb' }}>
                    <td style={{ padding:'8px 14px', fontWeight:600, fontSize:13 }}>{f.nome}</td>
                    <td style={{ padding:'8px 14px', fontSize:12, color:f.equipe==='ARMAÇÃO'?'#7c3aed':'#0891b2' }}>{f.equipe}</td>
                    <td style={{ padding:'8px 14px', textAlign:'center', fontWeight:700, color:'#166534' }}>{f.dias.toFixed(1)}</td>
                    <td style={{ padding:'8px 14px', textAlign:'center', color:'#6d28d9' }}>{f.extras>0?f.extras.toFixed(1):'—'}</td>
                    <td style={{ padding:'8px 14px', textAlign:'center', fontWeight:700, color:'#1a3a5c' }}>{formatR$(f.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      {dados?.tipo === 'faltas' && (
        <div>
          {/* Ranking faltas */}
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden', marginBottom:14 }}>
            <div style={{ background:'#7f1d1d', padding:'12px 18px', display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>❌ Ranking de Faltas</span>
              <span style={{ color:'#fca5a5', fontSize:13 }}>{dados.lista.filter((l:any) => l.faltas > 0).length} funcionários com falta</span>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  {['#','Funcionário','Equipe','Faltas','Ausentes','Atestados','Total Ausências'].map((h,i) => (
                    <th key={i} style={{ padding:'8px 14px', textAlign:i>=3?'center':'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.lista.filter((l:any) => l.faltas > 0 || l.ausentes > 0).map((l: any, i: number) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f3f4f6', background:i%2===0?'#fff':'#fef2f2' }}>
                    <td style={{ padding:'8px 14px', fontWeight:700, color:'#dc2626', width:40 }}>{i+1}</td>
                    <td style={{ padding:'8px 14px', fontWeight:600, fontSize:13 }}>{l.nome}</td>
                    <td style={{ padding:'8px 14px', fontSize:12, color:l.equipe==='ARMAÇÃO'?'#7c3aed':'#0891b2' }}>{l.equipe}</td>
                    <td style={{ padding:'8px 14px', textAlign:'center', fontWeight:800, color:'#dc2626', fontSize:15 }}>{l.faltas}</td>
                    <td style={{ padding:'8px 14px', textAlign:'center', color:'#6b7280' }}>{l.ausentes||'—'}</td>
                    <td style={{ padding:'8px 14px', textAlign:'center', color:'#92400e' }}>{l.atestados||'—'}</td>
                    <td style={{ padding:'8px 14px', textAlign:'center', fontWeight:700, color:'#7f1d1d' }}>{l.faltas+l.ausentes+l.atestados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sem faltas */}
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
            <div style={{ background:'#064e3b', padding:'12px 18px', display:'flex', justifyContent:'space-between' }}>
              <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>✅ Sem nenhuma falta</span>
              <span style={{ color:'#6ee7b7', fontSize:13 }}>{dados.semFaltas.length} funcionários</span>
            </div>
            <div style={{ padding:14, display:'flex', flexWrap:'wrap', gap:8 }}>
              {dados.semFaltas.map((l: any, i: number) => (
                <span key={i} style={{ background:'#f0fdf4', color:'#166534', fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:20, border:'1px solid #bbf7d0' }}>
                  {l.nome} <span style={{ fontSize:10, color:'#0891b2' }}>{l.equipe==='ARMAÇÃO'?'ARM':'CARP'}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {dados?.tipo === 'resumo' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            {dados.equipes.map((e: any, i: number) => (
              <div key={i} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
                <div style={{ background:i===0?'#7c3aed':'#0891b2', padding:'12px 18px' }}>
                  <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>{e.equipe}</span>
                </div>
                <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
                  {[
                    { label:'Funcionários ativos', val:e.funcs, unit:'' },
                    { label:'Total de diárias', val:e.dias.toFixed(1), unit:' dias' },
                    { label:'Total faltas', val:e.faltas, unit:' faltas' },
                    { label:'Valor total diárias', val:formatR$(e.valor), unit:'', money:true },
                  ].map((item, j) => (
                    <div key={j} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                      <span style={{ fontSize:13, color:'#6b7280' }}>{item.label}</span>
                      <span style={{ fontSize:15, fontWeight:700, color:'#1f2937' }}>{item.val}{item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'#1a3a5c', borderRadius:12, padding:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'#93c5fd', fontWeight:700, fontSize:16 }}>TOTAL GERAL — Ambas as equipes</span>
            <span style={{ color:'#fff', fontWeight:800, fontSize:24 }}>{formatR$(dados.equipes.reduce((s:number,e:any)=>s+e.valor,0))}</span>
          </div>
        </div>
      )}

      {!dados && !loading && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:48, textAlign:'center', color:'#9ca3af' }}>
          Selecione os filtros e clique em Gerar Relatório
        </div>
      )}
    </div>
  )
}
