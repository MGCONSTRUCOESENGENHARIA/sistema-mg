'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$, diasDoMes, formatDate, AUSENCIAS } from '@/lib/utils'

type TipoRel = 'presenca' | 'rateio' | 'pagamento' | 'avulsos' | 'obra'

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState<TipoRel>('presenca')
  const [mes, setMes] = useState(mesAtual())
  const [equipe, setEquipe] = useState('')
  const [obraId, setObraId] = useState('')
  const [funcId, setFuncId] = useState('')
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [dados, setDados] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('obras').select('id,nome,codigo').eq('status','ATIVA').order('nome').then(({ data }) => setObras(data||[]))
    supabase.from('funcionarios').select('id,nome,equipe').eq('ativo',true).order('equipe').order('nome').then(({ data }) => setFuncs(data||[]))
  }, [])

  async function gerar() {
    setLoading(true)
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).single()

    if (tipo === 'presenca') {
      let q = supabase.from('presencas')
        .select('funcionario_id,tipo,fracao,fracao2,obra_id,funcionarios(nome,equipe,valor_diaria),obras(nome)')
      if (comp) q = q.eq('competencia_id', comp.id)
      if (funcId) q = q.eq('funcionario_id', funcId)
      if (obraId) q = q.eq('obra_id', obraId)
      const { data } = await q

      const mapa: Record<string, any> = {}
      data?.forEach((p: any) => {
        const f = p.funcionarios
        if (!f) return
        if (equipe && f.equipe !== equipe) return
        const key = p.funcionario_id
        if (!mapa[key]) mapa[key] = { nome: f.nome, equipe: f.equipe, diaria: f.valor_diaria, dias: 0, extras: 0, faltas: 0, aus: 0, valor: 0 }
        if (p.tipo === 'FALTA') { mapa[key].faltas++; return }
        if (AUSENCIAS.includes(p.tipo)) { mapa[key].aus++; return }
        const soma = (p.fracao || 0) + (p.fracao2 || 0)
        if (p.tipo === 'SABADO_EXTRA') mapa[key].extras += soma
        else mapa[key].dias += soma
        mapa[key].valor += soma * f.valor_diaria
      })
      setDados(Object.values(mapa).sort((a: any, b: any) => a.nome.localeCompare(b.nome)))
    }

    if (tipo === 'rateio') {
      if (!comp) { setDados([]); setLoading(false); return }
      const { data } = await supabase.from('rateio_mensal')
        .select('*, obras(nome,codigo)')
        .eq('competencia_id', comp.id)
        .order('total_geral', { ascending: false })
      setDados((data || []).map((r: any) => ({ ...r, obra: r.obras?.nome, codigo: r.obras?.codigo })))
    }

    if (tipo === 'pagamento') {
      if (!comp) { setDados([]); setLoading(false); return }
      let q = supabase.from('pagamentos')
        .select('*, funcionarios(nome,equipe,valor_diaria,salario_base)')
        .eq('competencia_id', comp.id)
        .eq('tipo', 'pagamento_final')
      if (funcId) q = q.eq('funcionario_id', funcId)
      const { data } = await q
      setDados((data || []).filter((p: any) => !equipe || p.funcionarios?.equipe === equipe))
    }

    if (tipo === 'avulsos') {
      if (!comp) { setDados([]); setLoading(false); return }
      let q = supabase.from('avulsos')
        .select('*, funcionarios(nome,equipe)')
        .eq('competencia_id', comp.id)
        .order('data')
      if (funcId) q = q.eq('funcionario_id', funcId)
      const { data } = await q
      setDados((data || []).filter((a: any) => !equipe || a.funcionarios?.equipe === equipe))
    }

    if (tipo === 'obra') {
      if (!obraId || !comp) { setDados([]); setLoading(false); return }
      const { data: pres } = await supabase.from('presencas')
        .select('funcionario_id,tipo,fracao,fracao2,obra_id,obra2_id,data,funcionarios(nome,equipe,valor_diaria)')
        .eq('competencia_id', comp.id)

      const mapa: Record<string, any> = {}
      pres?.filter((p: any) => p.obra_id === obraId || p.obra2_id === obraId).forEach((p: any) => {
        const f = p.funcionarios
        if (!f) return
        if (equipe && f.equipe !== equipe) return
        if (AUSENCIAS.includes(p.tipo)) return
        const key = p.funcionario_id
        if (!mapa[key]) mapa[key] = { nome: f.nome, equipe: f.equipe, diaria: f.valor_diaria, dias: 0, extras: 0, valor: 0 }
        const soma = (p.fracao || 0) + (p.fracao2 || 0)
        if (p.tipo === 'SABADO_EXTRA') mapa[key].extras += soma
        else mapa[key].dias += soma
        mapa[key].valor += soma * f.valor_diaria
      })
      setDados(Object.values(mapa).sort((a: any, b: any) => a.nome.localeCompare(b.nome)))
    }

    setLoading(false)
  }

  function exportarCSV() {
    if (!dados.length) return
    let csv = ''
    if (tipo === 'presenca' || tipo === 'obra') {
      csv = 'Nome,Equipe,Diárias,Extras Sáb,Faltas,Valor Total\n'
      csv += dados.map((d: any) => `"${d.nome}","${d.equipe}",${d.dias},${d.extras||0},${d.faltas||0},${d.valor.toFixed(2)}`).join('\n')
    } else if (tipo === 'rateio') {
      csv = 'Obra,Código,Armação R$,Carpintaria R$,Total R$,% Mês\n'
      csv += dados.map((d: any) => `"${d.obra}","${d.codigo}",${d.total_armacao.toFixed(2)},${d.total_carpintaria.toFixed(2)},${d.total_geral.toFixed(2)},${(d.percentual*100).toFixed(2)}%`).join('\n')
    } else if (tipo === 'pagamento') {
      csv = 'Nome,Equipe,Diárias,Passagem,Café,Avulsos,Total Pagar,Contra Cheque\n'
      csv += dados.map((d: any) => `"${d.funcionarios?.nome}","${d.funcionarios?.equipe}",${d.total_diarias},${d.total_passagem.toFixed(2)},${d.total_cafe.toFixed(2)},${d.total_avulsos.toFixed(2)},${d.total_pagamento.toFixed(2)},${d.total_contra_cheque.toFixed(2)}`).join('\n')
    } else if (tipo === 'avulsos') {
      csv = 'Nome,Equipe,Data,Tipo,Valor,Observação\n'
      csv += dados.map((d: any) => `"${d.funcionarios?.nome}","${d.funcionarios?.equipe}","${d.data}","${d.tipo}",${d.valor.toFixed(2)},"${d.observacao||''}"`).join('\n')
    }
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `relatorio_${tipo}_${mes}.csv`; a.click()
  }

  const TIPOS: { key: TipoRel; label: string }[] = [
    { key: 'presenca', label: 'Presença por funcionário' },
    { key: 'obra', label: 'Por obra específica' },
    { key: 'rateio', label: 'Rateio do mês' },
    { key: 'pagamento', label: 'Pagamento final' },
    { key: 'avulsos', label: 'Avulsos / Vales' },
  ]

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#1a3a5c]">Relatórios</h1>
        <p className="text-gray-500 text-sm mt-0.5">Filtre, visualize e exporte os dados</p>
      </div>

      {/* Filtros */}
      <div className="card-pad mb-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
          <div>
            <label className="label">Tipo de relatório</label>
            <select className="select" value={tipo} onChange={e => { setTipo(e.target.value as TipoRel); setDados([]) }}>
              {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Mês</label>
            <input type="month" className="input" value={mes} onChange={e => setMes(e.target.value)} />
          </div>
          <div>
            <label className="label">Equipe</label>
            <select className="select" value={equipe} onChange={e => setEquipe(e.target.value)}>
              <option value="">Todas</option>
              <option value="ARMAÇÃO">Armação</option>
              <option value="CARPINTARIA">Carpintaria</option>
            </select>
          </div>
          {(tipo === 'presenca' || tipo === 'obra' || tipo === 'pagamento' || tipo === 'avulsos') && (
            <div>
              <label className="label">Funcionário</label>
              <select className="select" value={funcId} onChange={e => setFuncId(e.target.value)}>
                <option value="">Todos</option>
                {funcs.filter(f => !equipe || f.equipe === equipe).map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
          )}
          {(tipo === 'presenca' || tipo === 'obra') && (
            <div>
              <label className="label">Obra</label>
              <select className="select" value={obraId} onChange={e => setObraId(e.target.value)}>
                <option value="">{tipo === 'obra' ? 'Selecione a obra...' : 'Todas'}</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={gerar} disabled={loading} className="btn-primary">
            {loading ? 'Gerando...' : '▶ Gerar Relatório'}
          </button>
          {dados.length > 0 && (
            <>
              <button onClick={exportarCSV} className="btn-green btn-sm">⬇ Exportar CSV</button>
              <button onClick={() => window.print()} className="btn-ghost btn-sm">🖨 Imprimir / PDF</button>
            </>
          )}
        </div>
      </div>

      {/* Resultados */}
      {dados.length > 0 ? (
        <div className="card overflow-auto">
          {(tipo === 'presenca' || tipo === 'obra') && (
            <table className="w-full border-collapse">
              <thead><tr>
                <th className="th-left">Nome</th><th className="th">Equipe</th>
                <th className="th">Diárias</th><th className="th">Extras Sáb</th>
                <th className="th">Faltas</th><th className="th">Total R$</th>
              </tr></thead>
              <tbody>
                {dados.map((d: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="td font-medium">{d.nome}</td>
                    <td className="td-center"><span className={d.equipe === 'ARMAÇÃO' ? 'badge-blue' : 'badge-warn'}>{d.equipe}</span></td>
                    <td className="td-center font-bold text-blue-800">{d.dias.toFixed(1)}</td>
                    <td className="td-center text-purple-700">{(d.extras||0).toFixed(1)}</td>
                    <td className="td-center text-red-600">{d.faltas||0}</td>
                    <td className="td-num font-bold text-green-700">{formatR$(d.valor)}</td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold">
                  <td className="td" colSpan={2}>TOTAL</td>
                  <td className="td-center">{dados.reduce((s:number,d:any)=>s+d.dias,0).toFixed(1)}</td>
                  <td className="td-center">{dados.reduce((s:number,d:any)=>s+(d.extras||0),0).toFixed(1)}</td>
                  <td className="td-center">{dados.reduce((s:number,d:any)=>s+(d.faltas||0),0)}</td>
                  <td className="td-num text-green-900">{formatR$(dados.reduce((s:number,d:any)=>s+d.valor,0))}</td>
                </tr>
              </tbody>
            </table>
          )}
          {tipo === 'rateio' && (
            <table className="w-full border-collapse">
              <thead><tr>
                <th className="th">Código</th><th className="th-left">Obra</th>
                <th className="th">Armação R$</th><th className="th">Carpintaria R$</th>
                <th className="th">Total R$</th><th className="th">%</th>
              </tr></thead>
              <tbody>
                {dados.map((d: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="td-center font-mono font-bold">{d.codigo}</td>
                    <td className="td font-medium">{d.obra}</td>
                    <td className="td-num text-blue-700">{formatR$(d.total_armacao)}</td>
                    <td className="td-num text-purple-700">{formatR$(d.total_carpintaria)}</td>
                    <td className="td-num font-bold">{formatR$(d.total_geral)}</td>
                    <td className="td-center">{(d.percentual*100).toFixed(2)}%</td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold">
                  <td className="td" colSpan={2}>TOTAL</td>
                  <td className="td-num text-blue-900">{formatR$(dados.reduce((s:number,d:any)=>s+d.total_armacao,0))}</td>
                  <td className="td-num text-purple-900">{formatR$(dados.reduce((s:number,d:any)=>s+d.total_carpintaria,0))}</td>
                  <td className="td-num text-green-900">{formatR$(dados.reduce((s:number,d:any)=>s+d.total_geral,0))}</td>
                  <td className="td-center">100%</td>
                </tr>
              </tbody>
            </table>
          )}
          {tipo === 'pagamento' && (
            <table className="w-full border-collapse">
              <thead><tr>
                <th className="th-left">Nome</th><th className="th">Equipe</th>
                <th className="th">Diárias</th><th className="th">Passagem</th>
                <th className="th">Café</th><th className="th">Avulsos</th>
                <th className="th">Total Pagar</th><th className="th">Contra Cheque</th><th className="th">Status</th>
              </tr></thead>
              <tbody>
                {dados.map((d: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="td font-medium">{d.funcionarios?.nome}</td>
                    <td className="td-center text-xs">{d.funcionarios?.equipe}</td>
                    <td className="td-center">{d.total_diarias}</td>
                    <td className="td-num">{formatR$(d.total_passagem)}</td>
                    <td className="td-num">{formatR$(d.total_cafe)}</td>
                    <td className="td-num text-orange-700">-{formatR$(d.total_avulsos)}</td>
                    <td className="td-num font-bold text-green-800">{formatR$(d.total_pagamento)}</td>
                    <td className="td-num font-bold text-green-900">{formatR$(d.total_contra_cheque)}</td>
                    <td className="td-center"><span className={d.status === 'CALCULADO' ? 'badge-ok' : 'badge-warn'}>{d.status}</span></td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold">
                  <td className="td" colSpan={6}>TOTAL</td>
                  <td className="td-num text-green-900">{formatR$(dados.reduce((s:number,d:any)=>s+d.total_pagamento,0))}</td>
                  <td className="td-num text-green-900">{formatR$(dados.reduce((s:number,d:any)=>s+d.total_contra_cheque,0))}</td>
                  <td className="td"></td>
                </tr>
              </tbody>
            </table>
          )}
          {tipo === 'avulsos' && (
            <table className="w-full border-collapse">
              <thead><tr>
                <th className="th-left">Funcionário</th><th className="th">Equipe</th>
                <th className="th">Data</th><th className="th">Tipo</th>
                <th className="th">Valor</th><th className="th-left">Observação</th>
              </tr></thead>
              <tbody>
                {dados.map((d: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="td font-medium">{d.funcionarios?.nome}</td>
                    <td className="td-center text-xs">{d.funcionarios?.equipe}</td>
                    <td className="td-center">{new Date(d.data+'T12:00').toLocaleDateString('pt-BR')}</td>
                    <td className="td-center"><span className="badge-warn">{d.tipo}</span></td>
                    <td className="td-num text-orange-700 font-bold">-{formatR$(d.valor)}</td>
                    <td className="td text-gray-500 text-xs">{d.observacao||'—'}</td>
                  </tr>
                ))}
                <tr className="bg-orange-50 font-bold">
                  <td className="td" colSpan={4}>TOTAL</td>
                  <td className="td-num text-orange-900">-{formatR$(dados.reduce((s:number,d:any)=>s+d.valor,0))}</td>
                  <td className="td"></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      ) : !loading ? (
        <div className="card-pad text-center py-16 text-gray-400">
          Configure os filtros acima e clique em Gerar Relatório
        </div>
      ) : null}
    </div>
  )
}
