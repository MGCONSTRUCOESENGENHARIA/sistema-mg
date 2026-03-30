'use client'
import { useEffect, useState } from 'react'
import { supabase, Pagamento } from '@/lib/supabase'
import { mesAtual, formatR$ } from '@/lib/utils'

export default function PagamentoPage() {
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [mes, setMes] = useState(mesAtual())
  const [pagamentos, setPagamentos] = useState<(Pagamento & { funcionarios: any })[]>([])
  const [loading, setLoading] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [alertasGlobais, setAlertasGlobais] = useState<string[]>([])
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Pagamento>>({})
  const [msg, setMsg] = useState('')

  useEffect(() => { carregar() }, [equipe, mes])

  async function carregar() {
    setLoading(true)
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).single()
    if (!comp) { setPagamentos([]); setLoading(false); return }

    const { data } = await supabase.from('pagamentos')
      .select('*, funcionarios(nome,equipe,valor_diaria,salario_base)')
      .eq('competencia_id', comp.id)
      .eq('tipo', 'pagamento_final')
      .order('funcionarios(nome)')

    const filtrado = (data || []).filter((p: any) => p.funcionarios?.equipe === equipe)
    setPagamentos(filtrado)

    const erros = filtrado.flatMap((p: any) => p.alertas || [])
    setAlertasGlobais([...new Set(erros)])
    setLoading(false)
  }

  async function calcularTodos() {
    setCalculando(true)
    setMsg('')
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).single()
    if (!comp) { setCalculando(false); return }

    const { data: funcs } = await supabase.from('funcionarios')
      .select('id').eq('equipe', equipe).eq('ativo', true)

    let erros = 0
    for (const f of funcs || []) {
      const { error } = await supabase.rpc('calcular_pagamento', {
        p_competencia_id: comp.id,
        p_funcionario_id: f.id,
        p_tipo: 'pagamento_final'
      })
      if (error) erros++
    }
    await carregar()
    setMsg(erros > 0 ? `⚠️ Calculado com ${erros} erros. Verifique as passagens.` : '✅ Todos os pagamentos calculados!')
    setTimeout(() => setMsg(''), 4000)
    setCalculando(false)
  }

  function iniciarEdicao(pag: Pagamento) {
    setEditandoId(pag.id)
    setEditForm({ ...pag })
  }

  async function salvarEdicao() {
    if (!editandoId) return
    const campos = {
      hora_extra: editForm.hora_extra, complemento: editForm.complemento,
      outros_desc: editForm.outros_desc, desc_materiais: editForm.desc_materiais,
      desc_emprestimo: editForm.desc_emprestimo, desc_acerto: editForm.desc_acerto,
      desc_pensao: editForm.desc_pensao, desc_dsr: editForm.desc_dsr,
      desc_sindicato: editForm.desc_sindicato, desc_inss: editForm.desc_inss,
      observacao: editForm.observacao,
    }
    // Recalcular totais
    const pag = pagamentos.find(p => p.id === editandoId)!
    const func = pag.funcionarios
    const somaDescontos = Object.entries(campos)
      .filter(([k]) => k.startsWith('desc_') || k === 'outros_desc')
      .reduce((s, [, v]) => s + (Number(v) || 0), 0)
    const extras = (campos.hora_extra || 0) + (campos.complemento || 0)
    const totalPag = pag.valor_diarias + pag.total_passagem + pag.total_cafe + extras - pag.total_avulsos - somaDescontos
    const adiant = pag.tipo === 'pagamento_final'
      ? (pagamentos.find(p2 => p2.funcionario_id === pag.funcionario_id && p2.tipo === 'adiantamento')?.total_pagamento || 0)
      : 0
    const cc = totalPag - adiant

    await supabase.from('pagamentos').update({
      ...campos, total_pagamento: totalPag, total_contra_cheque: cc
    }).eq('id', editandoId)

    setEditandoId(null)
    await carregar()
  }

  function edI(field: keyof Pagamento) {
    return (
      <input type="number" step="0.01"
        className="w-20 text-right text-xs border border-yellow-400 rounded px-1 py-0.5 bg-yellow-50"
        value={editForm[field] as number || 0}
        onChange={e => setEditForm(f => ({ ...f, [field]: parseFloat(e.target.value) || 0 }))}
      />
    )
  }

  const totalGeral = pagamentos.reduce((s, p) => s + p.total_contra_cheque, 0)

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1a3a5c]">Pagamento Final — Dia 05</h1>
          <p className="text-gray-500 text-sm mt-0.5">Campos em amarelo são editáveis</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {(['ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
            <button key={eq} onClick={() => setEquipe(eq)}
              className={equipe === eq ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>{eq}</button>
          ))}
          <input type="month" className="input text-sm py-1.5 w-36" value={mes} onChange={e => setMes(e.target.value)} />
          <button onClick={calcularTodos} disabled={calculando} className="btn-green btn-sm">
            {calculando ? 'Calculando...' : '▶ Recalcular Tudo'}
          </button>
        </div>
      </div>

      {alertasGlobais.length > 0 && (
        <div className="alert-err mb-4">
          <div className="font-semibold mb-1">⚠️ Erros de cálculo ({alertasGlobais.length}) — passagens não cadastradas:</div>
          <div className="text-xs space-y-0.5 max-h-24 overflow-y-auto">
            {alertasGlobais.map((a, i) => <div key={i}>{a}</div>)}
          </div>
        </div>
      )}
      {msg && <div className={msg.includes('⚠') ? 'alert-warn mb-4' : 'alert-ok mb-4'}>{msg}</div>}

      {loading ? (
        <div className="card-pad text-center py-12 text-gray-400">Carregando...</div>
      ) : pagamentos.length === 0 ? (
        <div className="card-pad text-center py-12">
          <p className="text-gray-400 mb-3">Nenhum pagamento calculado ainda.</p>
          <button onClick={calcularTodos} className="btn-primary">▶ Calcular agora</button>
        </div>
      ) : (
        <div className="card overflow-auto">
          <table className="border-collapse" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th className="th-left sticky left-0 z-10" style={{ minWidth: 200 }}>Funcionário</th>
                <th className="th">Diárias</th>
                <th className="th">Extras</th>
                <th className="th">Vl Diária</th>
                <th className="th">Salário</th>
                <th className="th">Vl Diárias</th>
                <th className="th">Passagem</th>
                <th className="th">Café</th>
                <th className="th">Avulsos</th>
                <th className="th" style={{ background: '#7c3aed' }}>Hora Extra</th>
                <th className="th" style={{ background: '#7c3aed' }}>Complemento</th>
                <th className="th" style={{ background: '#991b1b' }}>Desc.Mat.</th>
                <th className="th" style={{ background: '#991b1b' }}>Desc.Emp.</th>
                <th className="th" style={{ background: '#991b1b' }}>Desc.Acerto</th>
                <th className="th" style={{ background: '#991b1b' }}>Desc.Pensão</th>
                <th className="th" style={{ background: '#991b1b' }}>Desc.DSR</th>
                <th className="th" style={{ background: '#991b1b' }}>Desc.Sind.</th>
                <th className="th" style={{ background: '#991b1b' }}>Desc.INSS</th>
                <th className="th bg-green-900">Total Pagar</th>
                <th className="th bg-green-900">Contra Cheque</th>
                <th className="th">Status</th>
                <th className="th">Ação</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((pag, i) => {
                const ed = editandoId === pag.id
                const func = pag.funcionarios
                const temAlerta = pag.alertas && pag.alertas.length > 0
                return (
                  <tr key={pag.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'} ${temAlerta ? 'ring-1 ring-inset ring-red-300' : ''}`}>
                    <td className="td font-semibold text-[#1a3a5c] sticky left-0 bg-inherit border-r-2 border-gray-200" style={{ minWidth: 200 }}>
                      {func?.nome}
                      {temAlerta && <div className="badge-err mt-0.5">⚠ Erro</div>}
                    </td>
                    <td className="td-center">{pag.total_diarias}</td>
                    <td className="td-center">{pag.total_extras}</td>
                    <td className="td-num">{formatR$(func?.valor_diaria)}</td>
                    <td className="td-num">{formatR$(func?.salario_base)}</td>
                    <td className="td-num font-semibold">{formatR$(pag.valor_diarias)}</td>
                    <td className="td-num">{formatR$(pag.total_passagem)}</td>
                    <td className="td-num">{formatR$(pag.total_cafe)}</td>
                    <td className="td-num text-orange-600">-{formatR$(pag.total_avulsos)}</td>
                    <td className="td text-center bg-purple-50">{ed ? edI('hora_extra') : formatR$(pag.hora_extra)}</td>
                    <td className="td text-center bg-purple-50">{ed ? edI('complemento') : formatR$(pag.complemento)}</td>
                    <td className="td text-center bg-red-50">{ed ? edI('desc_materiais') : formatR$(pag.desc_materiais)}</td>
                    <td className="td text-center bg-red-50">{ed ? edI('desc_emprestimo') : formatR$(pag.desc_emprestimo)}</td>
                    <td className="td text-center bg-red-50">{ed ? edI('desc_acerto') : formatR$(pag.desc_acerto)}</td>
                    <td className="td text-center bg-red-50">{ed ? edI('desc_pensao') : formatR$(pag.desc_pensao)}</td>
                    <td className="td text-center bg-red-50">{ed ? edI('desc_dsr') : formatR$(pag.desc_dsr)}</td>
                    <td className="td text-center bg-red-50">{ed ? edI('desc_sindicato') : formatR$(pag.desc_sindicato)}</td>
                    <td className="td text-center bg-red-50">{ed ? edI('desc_inss') : formatR$(pag.desc_inss)}</td>
                    <td className="td-num font-bold text-green-800 bg-green-50">{formatR$(pag.total_pagamento)}</td>
                    <td className="td-num font-bold text-green-900 bg-green-100">{formatR$(pag.total_contra_cheque)}</td>
                    <td className="td-center">
                      <span className={pag.status === 'CALCULADO' ? 'badge-ok' : pag.status === 'APROVADO' ? 'badge-blue' : 'badge-warn'}>
                        {pag.status}
                      </span>
                    </td>
                    <td className="td-center">
                      {ed ? (
                        <div className="flex gap-1">
                          <button onClick={salvarEdicao} className="btn btn-sm bg-green-700 text-white">✓</button>
                          <button onClick={() => setEditandoId(null)} className="btn btn-sm bg-gray-200 text-gray-700">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => iniciarEdicao(pag)} className="btn-ghost btn-sm text-xs">Editar</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-green-50 font-bold">
                <td className="td font-bold text-[#1a3a5c] sticky left-0 bg-green-50">TOTAL</td>
                {Array(17).fill(0).map((_,i) => <td key={i} className="td"></td>)}
                <td className="td-num text-green-900">{formatR$(totalGeral)}</td>
                <td className="td-num text-green-900">{formatR$(totalGeral)}</td>
                <td className="td"></td><td className="td"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
