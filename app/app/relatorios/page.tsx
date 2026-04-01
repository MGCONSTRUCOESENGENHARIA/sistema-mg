'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatR$ } from '@/lib/utils'

type TipoRel = 'funcionario' | 'obra'

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState<TipoRel>('funcionario')
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0,10)
  })
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0,10))
  const [equipe, setEquipe] = useState('')
  const [obraId, setObraId] = useState('')
  const [funcId, setFuncId] = useState('')
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('obras').select('id,nome,codigo').eq('status','ATIVA').order('nome').then(({data}) => setObras(data||[]))
    supabase.from('funcionarios').select('id,nome,equipe,valor_diaria,salario_base').eq('ativo',true).order('equipe').order('nome').then(({data}) => setFuncs(data||[]))
  }, [])

  // Quinzena rápida
  function setQuinzena(q: 1|2) {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = hoje.getMonth()
    if (q === 1) {
      setDataInicio(new Date(ano, mes, 1).toISOString().slice(0,10))
      setDataFim(new Date(ano, mes, 15).toISOString().slice(0,10))
    } else {
      setDataInicio(new Date(ano, mes, 16).toISOString().slice(0,10))
      setDataFim(new Date(ano, mes+1, 0).toISOString().slice(0,10))
    }
  }

  function setMesCompleto() {
    const hoje = new Date()
    setDataInicio(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10))
    setDataFim(new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10))
  }

  async function gerar() {
    setLoading(true); setDados(null)

    // Buscar presenças no período
    let q = supabase.from('presencas')
      .select('funcionario_id,data,tipo,fracao,fracao2,obra_id,obra2_id,funcionarios(id,nome,equipe,valor_diaria,salario_base),obras:obra_id(nome,codigo)')
      .gte('data', dataInicio).lte('data', dataFim)
    if (funcId) q = q.eq('funcionario_id', funcId)
    if (obraId) q = q.eq('obra_id', obraId)
    const { data: presencas } = await q

    // Buscar avulsos no período
    let qa = supabase.from('avulsos')
      .select('funcionario_id,tipo,valor,quando_descontar,data,observacao,funcionarios(nome,equipe)')
      .gte('data', dataInicio).lte('data', dataFim)
    if (funcId) qa = qa.eq('funcionario_id', funcId)
    const { data: avulsos } = await qa

    if (tipo === 'funcionario') {
      // Agrupar por funcionário
      const mapa: Record<string, any> = {}
      presencas?.forEach((p: any) => {
        const f = p.funcionarios
        if (!f) return
        if (equipe && f.equipe !== equipe) return
        if (!mapa[f.id]) mapa[f.id] = {
          id: f.id, nome: f.nome, equipe: f.equipe,
          diaria: f.valor_diaria, salario: f.salario_base,
          dias: 0, extras: 0, faltas: 0, aus: 0,
          valor_diarias: 0, dias_detalhe: []
        }
        const isAbs = ['FALTA','ATESTADO','AUSENTE','SAIU'].includes(p.tipo)
        if (p.tipo === 'FALTA') { mapa[f.id].faltas++; mapa[f.id].dias_detalhe.push({ data: p.data, tipo: 'FALTA', obra: '' }); return }
        if (isAbs) { mapa[f.id].aus++; mapa[f.id].dias_detalhe.push({ data: p.data, tipo: p.tipo, obra: '' }); return }
        const soma = (p.fracao||0)+(p.fracao2||0)
        if (p.tipo === 'SABADO_EXTRA') mapa[f.id].extras += soma
        else mapa[f.id].dias += soma
        mapa[f.id].valor_diarias += soma * f.valor_diaria
        mapa[f.id].dias_detalhe.push({ data: p.data, tipo: p.tipo, obra: (p.obras as any)?.nome||'', fracao: soma })
      })

      // Adicionar avulsos
      avulsos?.forEach((a: any) => {
        const fn = a.funcionarios
        if (!fn) return
        if (equipe && fn.equipe !== equipe) return
        const id = a.funcionario_id
        if (!mapa[id]) mapa[id] = { id, nome: fn.nome, equipe: fn.equipe, diaria: 0, salario: 0, dias: 0, extras: 0, faltas: 0, aus: 0, valor_diarias: 0, dias_detalhe: [] }
        if (!mapa[id].avulsos) mapa[id].avulsos = []
        mapa[id].avulsos.push(a)
      })

      const lista = Object.values(mapa).sort((a: any, b: any) => a.nome.localeCompare(b.nome))
      setDados({ tipo: 'funcionario', lista })
    }

    if (tipo === 'obra') {
      // Agrupar por obra
      const mapa: Record<string, any> = {}
      presencas?.forEach((p: any) => {
        const f = p.funcionarios
        const o = p.obras as any
        if (!f || !o) return
        if (equipe && f.equipe !== equipe) return
        if (!mapa[p.obra_id]) mapa[p.obra_id] = { obra: o.nome, codigo: o.codigo, funcs: {} }
        if (!mapa[p.obra_id].funcs[f.id]) mapa[p.obra_id].funcs[f.id] = { nome: f.nome, equipe: f.equipe, diaria: f.valor_diaria, dias: 0, extras: 0, valor: 0 }
        const isAbs = ['FALTA','ATESTADO','AUSENTE','SAIU'].includes(p.tipo)
        if (isAbs) return
        const soma = (p.fracao||0)+(p.fracao2||0)
        if (p.tipo === 'SABADO_EXTRA') mapa[p.obra_id].funcs[f.id].extras += soma
        else mapa[p.obra_id].funcs[f.id].dias += soma
        mapa[p.obra_id].funcs[f.id].valor += soma * f.valor_diaria
      })
      const lista = Object.values(mapa).sort((a: any, b: any) => a.obra.localeCompare(b.obra))
      setDados({ tipo: 'obra', lista })
    }

    setLoading(false)
  }

  function exportarCSV() {
    if (!dados) return
    let csv = ''
    if (dados.tipo === 'funcionario') {
      csv = 'Nome,Equipe,Diárias,Extras Sáb,Faltas,Valor Diárias,Total Avulsos,Total Geral\n'
      csv += dados.lista.map((d: any) => {
        const totAvulsos = (d.avulsos||[]).reduce((s: number, a: any) => s+a.valor, 0)
        return `"${d.nome}","${d.equipe}",${d.dias},${d.extras},${d.faltas},${d.valor_diarias.toFixed(2)},${totAvulsos.toFixed(2)},${(d.valor_diarias - totAvulsos).toFixed(2)}`
      }).join('\n')
    } else {
      csv = 'Obra,Funcionário,Equipe,Diárias,Extras,Valor R$\n'
      dados.lista.forEach((o: any) => {
        Object.values(o.funcs).forEach((f: any) => {
          csv += `"${o.obra}","${f.nome}","${f.equipe}",${f.dias},${f.extras},${f.valor.toFixed(2)}\n`
        })
      })
    }
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `relatorio_${tipo}_${dataInicio}_${dataFim}.csv`; a.click()
  }

  const nomeDia = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const fmtData = (s: string) => { const d = new Date(s+'T12:00'); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${nomeDia[d.getDay()]}` }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#1a3a5c]">Relatórios</h1>
        <p className="text-gray-500 text-sm mt-0.5">Filtre por período e gere relatórios individuais ou por obra</p>
      </div>

      {/* Filtros */}
      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:16, marginBottom:16 }}>
        {/* Tipo */}
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          <button onClick={() => setTipo('funcionario')}
            style={{ padding:'7px 18px', borderRadius:8, border:'2px solid #1a3a5c', background: tipo==='funcionario'?'#1a3a5c':'#fff', color: tipo==='funcionario'?'#fff':'#1a3a5c', cursor:'pointer', fontWeight:700, fontSize:13 }}>
            👤 Por Funcionário
          </button>
          <button onClick={() => setTipo('obra')}
            style={{ padding:'7px 18px', borderRadius:8, border:'2px solid #1a3a5c', background: tipo==='obra'?'#1a3a5c':'#fff', color: tipo==='obra'?'#fff':'#1a3a5c', cursor:'pointer', fontWeight:700, fontSize:13 }}>
            🏗 Por Obra
          </button>
        </div>

        {/* Período */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }}>Período</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:12, color:'#6b7280' }}>De</span>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                style={{ border:'1px solid #d1d5db', borderRadius:6, padding:'6px 10px', fontSize:13 }} />
              <span style={{ fontSize:12, color:'#6b7280' }}>até</span>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                style={{ border:'1px solid #d1d5db', borderRadius:6, padding:'6px 10px', fontSize:13 }} />
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setQuinzena(1)} style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontSize:11, fontWeight:600 }}>1ª Quinzena</button>
              <button onClick={() => setQuinzena(2)} style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontSize:11, fontWeight:600 }}>2ª Quinzena</button>
              <button onClick={setMesCompleto} style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontSize:11, fontWeight:600 }}>Mês completo</button>
            </div>
          </div>
        </div>

        {/* Filtros adicionais */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:10, marginBottom:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Equipe</label>
            <select style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:13 }}
              value={equipe} onChange={e => setEquipe(e.target.value)}>
              <option value="">Todas</option>
              <option value="ARMAÇÃO">Armação</option>
              <option value="CARPINTARIA">Carpintaria</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Funcionário</label>
            <select style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:13 }}
              value={funcId} onChange={e => setFuncId(e.target.value)}>
              <option value="">Todos</option>
              {funcs.filter(f => !equipe || f.equipe === equipe).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Obra</label>
            <select style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:13 }}
              value={obraId} onChange={e => setObraId(e.target.value)}>
              <option value="">Todas</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={gerar} disabled={loading}
            style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#1a3a5c', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13 }}>
            {loading ? 'Gerando...' : '▶ Gerar Relatório'}
          </button>
          {dados && (
            <>
              <button onClick={exportarCSV} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #2e7d32', background:'#2e7d32', color:'#fff', cursor:'pointer', fontWeight:600, fontSize:13 }}>⬇ CSV</button>
              <button onClick={() => window.print()} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #6b7280', background:'#fff', cursor:'pointer', fontSize:13 }}>🖨 Imprimir</button>
            </>
          )}
        </div>
      </div>

      {/* RESULTADOS — Por Funcionário */}
      {dados?.tipo === 'funcionario' && (
        <div>
          {/* Se filtrou por funcionário específico — relatório detalhado */}
          {funcId ? (
            dados.lista.map((d: any) => {
              const totAvulsos = (d.avulsos||[]).reduce((s: number, a: any) => s+a.valor, 0)
              const adiantamento = d.salario * 0.5
              return (
                <div key={d.id} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:20, marginBottom:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, paddingBottom:12, borderBottom:'2px solid #1a3a5c' }}>
                    <div>
                      <h2 style={{ fontSize:18, fontWeight:700, color:'#1a3a5c' }}>{d.nome}</h2>
                      <p style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{d.equipe} · Período: {fmtData(dataInicio)} a {fmtData(dataFim)}</p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'#6b7280' }}>Valor da diária</div>
                      <div style={{ fontSize:20, fontWeight:700, color:'#1a3a5c' }}>{formatR$(d.diaria)}</div>
                    </div>
                  </div>

                  {/* Resumo */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
                    {[
                      { label:'Diárias trabalhadas', val: d.dias.toFixed(1), color:'#166534', bg:'#f0fdf4' },
                      { label:'Extras (sábado)', val: d.extras.toFixed(1), color:'#6d28d9', bg:'#f5f3ff' },
                      { label:'Faltas', val: d.faltas, color:'#dc2626', bg:'#fef2f2' },
                      { label:'Ausências', val: d.aus, color:'#6b7280', bg:'#f9fafb' },
                    ].map((s, i) => (
                      <div key={i} style={{ background:s.bg, borderRadius:8, padding:'10px 14px' }}>
                        <div style={{ fontSize:11, color:'#6b7280' }}>{s.label}</div>
                        <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Financeiro */}
                  <div style={{ background:'#f9fafb', borderRadius:8, padding:14, marginBottom:16 }}>
                    <h3 style={{ fontSize:13, fontWeight:700, color:'#1a3a5c', marginBottom:10 }}>Financeiro</h3>
                    <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13 }}>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ color:'#6b7280' }}>Salário base</span>
                        <span style={{ fontWeight:600 }}>{formatR$(d.salario)}</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ color:'#6b7280' }}>Valor diárias ({d.dias.toFixed(1)} × {formatR$(d.diaria)})</span>
                        <span style={{ fontWeight:600, color:'#166534' }}>{formatR$(d.valor_diarias)}</span>
                      </div>
                      {d.extras > 0 && (
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <span style={{ color:'#6b7280' }}>Extras sábado ({d.extras.toFixed(1)} × {formatR$(d.diaria)})</span>
                          <span style={{ fontWeight:600, color:'#6d28d9' }}>{formatR$(d.extras * d.diaria)}</span>
                        </div>
                      )}
                      {(d.avulsos||[]).map((a: any, i: number) => (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', color:'#dc2626' }}>
                          <span>Desconto: {a.tipo}{a.observacao ? ` (${a.observacao})` : ''} — {fmtData(a.data)}</span>
                          <span style={{ fontWeight:600 }}>-{formatR$(a.valor)}</span>
                        </div>
                      ))}
                      <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid #e5e7eb', fontSize:15, fontWeight:700 }}>
                        <span style={{ color:'#1a3a5c' }}>TOTAL A RECEBER</span>
                        <span style={{ color:'#166534' }}>{formatR$(d.valor_diarias + (d.extras * d.diaria) - totAvulsos)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Detalhe por dia */}
                  <div>
                    <h3 style={{ fontSize:13, fontWeight:700, color:'#1a3a5c', marginBottom:8 }}>Detalhe por dia</h3>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {d.dias_detalhe.sort((a: any, b: any) => a.data.localeCompare(b.data)).map((dia: any, i: number) => (
                        <div key={i} style={{
                          padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600,
                          background: dia.tipo==='FALTA'?'#fee2e2': dia.tipo==='ATESTADO'?'#fef9c3': ['AUSENTE','SAIU'].includes(dia.tipo)?'#f3f4f6':'#dcfce7',
                          color: dia.tipo==='FALTA'?'#dc2626': dia.tipo==='ATESTADO'?'#854d0e': ['AUSENTE','SAIU'].includes(dia.tipo)?'#6b7280':'#166534',
                          border: '1px solid #e5e7eb',
                        }}>
                          {fmtData(dia.data)}{dia.obra ? ` — ${dia.obra}` : ` — ${dia.tipo}`}
                          {dia.fracao && dia.fracao !== 1 ? ` (${dia.fracao})` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            /* Listagem resumida de todos */
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#1a3a5c' }}>
                    {['Funcionário','Equipe','Diárias','Extras','Faltas','Aus.','Valor Diárias','Descontos','Total'].map((h,i) => (
                      <th key={i} style={{ color:'#fff', padding:'8px 12px', textAlign: i<2?'left':'center', fontSize:11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dados.lista.map((d: any, i: number) => {
                    const totAv = (d.avulsos||[]).reduce((s: number, a: any) => s+a.valor, 0)
                    return (
                      <tr key={d.id} style={{ background: i%2===0?'#fff':'#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
                        <td style={{ padding:'7px 12px', fontWeight:600, color:'#1a3a5c', fontSize:12 }}>{d.nome}</td>
                        <td style={{ padding:'7px 12px', fontSize:11, color:'#6b7280' }}>{d.equipe}</td>
                        <td style={{ padding:'7px 12px', textAlign:'center', fontWeight:700, color:'#166534' }}>{d.dias.toFixed(1)}</td>
                        <td style={{ padding:'7px 12px', textAlign:'center', color:'#6d28d9' }}>{d.extras.toFixed(1)}</td>
                        <td style={{ padding:'7px 12px', textAlign:'center', color:'#dc2626' }}>{d.faltas}</td>
                        <td style={{ padding:'7px 12px', textAlign:'center', color:'#6b7280' }}>{d.aus}</td>
                        <td style={{ padding:'7px 12px', textAlign:'right', fontWeight:600 }}>{formatR$(d.valor_diarias)}</td>
                        <td style={{ padding:'7px 12px', textAlign:'right', color:'#dc2626' }}>{totAv>0?'-'+formatR$(totAv):'—'}</td>
                        <td style={{ padding:'7px 12px', textAlign:'right', fontWeight:700, color:'#166534' }}>{formatR$(d.valor_diarias - totAv)}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ background:'#f0fdf4', fontWeight:700 }}>
                    <td colSpan={2} style={{ padding:'8px 12px', fontSize:13 }}>TOTAL</td>
                    <td style={{ padding:'8px 12px', textAlign:'center', color:'#166534' }}>{dados.lista.reduce((s:number,d:any)=>s+d.dias,0).toFixed(1)}</td>
                    <td style={{ padding:'8px 12px', textAlign:'center', color:'#6d28d9' }}>{dados.lista.reduce((s:number,d:any)=>s+d.extras,0).toFixed(1)}</td>
                    <td style={{ padding:'8px 12px', textAlign:'center', color:'#dc2626' }}>{dados.lista.reduce((s:number,d:any)=>s+d.faltas,0)}</td>
                    <td style={{ padding:'8px 12px', textAlign:'center' }}>{dados.lista.reduce((s:number,d:any)=>s+d.aus,0)}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right' }}>{formatR$(dados.lista.reduce((s:number,d:any)=>s+d.valor_diarias,0))}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right', color:'#dc2626' }}>-{formatR$(dados.lista.reduce((s:number,d:any)=>s+(d.avulsos||[]).reduce((x:number,a:any)=>x+a.valor,0),0))}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right', color:'#166534' }}>{formatR$(dados.lista.reduce((s:number,d:any)=>s+d.valor_diarias-(d.avulsos||[]).reduce((x:number,a:any)=>x+a.valor,0),0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RESULTADOS — Por Obra */}
      {dados?.tipo === 'obra' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {dados.lista.map((o: any, oi: number) => {
            const funcsList = Object.values(o.funcs) as any[]
            const totalObra = funcsList.reduce((s, f) => s+f.valor, 0)
            return (
              <div key={oi} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' }}>
                <div style={{ background:'#1a3a5c', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>{o.obra}</span>
                    <span style={{ color:'#93c5fd', fontSize:11, marginLeft:8 }}>{o.codigo}</span>
                  </div>
                  <span style={{ color:'#86efac', fontWeight:700, fontSize:13 }}>{formatR$(totalObra)}</span>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#f9fafb' }}>
                      {['Funcionário','Equipe','Diárias','Extras Sáb','Valor R$'].map((h,i) => (
                        <th key={i} style={{ padding:'6px 12px', textAlign: i<2?'left':'center', fontSize:11, color:'#6b7280', fontWeight:600, borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {funcsList.sort((a, b) => a.nome.localeCompare(b.nome)).map((f: any, fi: number) => (
                      <tr key={fi} style={{ background: fi%2===0?'#fff':'#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
                        <td style={{ padding:'6px 12px', fontWeight:600, color:'#1a3a5c', fontSize:12 }}>{f.nome}</td>
                        <td style={{ padding:'6px 12px', fontSize:11, color:'#6b7280' }}>{f.equipe}</td>
                        <td style={{ padding:'6px 12px', textAlign:'center', fontWeight:700, color:'#166534' }}>{f.dias.toFixed(1)}</td>
                        <td style={{ padding:'6px 12px', textAlign:'center', color:'#6d28d9' }}>{f.extras.toFixed(1)}</td>
                        <td style={{ padding:'6px 12px', textAlign:'right', fontWeight:600 }}>{formatR$(f.valor)}</td>
                      </tr>
                    ))}
                    <tr style={{ background:'#f0fdf4', fontWeight:700 }}>
                      <td colSpan={2} style={{ padding:'7px 12px', fontSize:12 }}>TOTAL {o.obra}</td>
                      <td style={{ padding:'7px 12px', textAlign:'center', color:'#166534' }}>{funcsList.reduce((s,f)=>s+f.dias,0).toFixed(1)}</td>
                      <td style={{ padding:'7px 12px', textAlign:'center', color:'#6d28d9' }}>{funcsList.reduce((s,f)=>s+f.extras,0).toFixed(1)}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right', color:'#166534' }}>{formatR$(totalObra)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })}
          {dados.lista.length === 0 && (
            <div style={{ textAlign:'center', padding:40, color:'#9ca3af', background:'#fff', borderRadius:10, border:'1px solid #e5e7eb' }}>
              Nenhum dado encontrado para o período selecionado.
            </div>
          )}
        </div>
      )}

      {!dados && !loading && (
        <div style={{ textAlign:'center', padding:48, color:'#9ca3af', background:'#fff', borderRadius:10, border:'1px solid #e5e7eb' }}>
          Configure os filtros acima e clique em Gerar Relatório
        </div>
      )}
    </div>
  )
}
