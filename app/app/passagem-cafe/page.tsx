'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mesAtual, nomeMes, formatR$, diasDoMes, formatDate, fim1Quinzena, AUSENCIAS } from '@/lib/utils'

interface LinhaPassagem {
  funcionario_id: string
  nome: string
  equipe: string
  tipo_passagem: string
  total_passagem: number
  total_cafe: number
  valor_gasto: number
  recebido_ant: number
  saldo_vt: number
  dias_proj: number
  valor_proj: number
  adicional: number
  alertas: string[]
  quinzena_id?: string
}

export default function PassagemCafePage() {
  const [equipe, setEquipe] = useState<'ARMAÇÃO' | 'CARPINTARIA'>('ARMAÇÃO')
  const [mes, setMes] = useState(mesAtual())
  const [quinzena, setQuinzena] = useState<1 | 2>(1)
  const [linhas, setLinhas] = useState<LinhaPassagem[]>([])
  const [loading, setLoading] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<LinhaPassagem>>({})
  const [msg, setMsg] = useState('')

  const CAFE_DIA = 8

  useEffect(() => { carregar() }, [equipe, mes, quinzena])

  async function carregar() {
    setLoading(true)
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).single()
    if (!comp) { setLinhas([]); setLoading(false); return }

    // Buscar passagens da quinzena salvas
    const { data: qData } = await supabase.from('passagens_quinzena')
      .select('*, funcionarios(nome,equipe)')
      .eq('competencia_id', comp.id)
      .eq('quinzena', quinzena)

    // Buscar presenças do período para calcular
    const diasMes = diasDoMes(mes)
    const f1 = fim1Quinzena(diasMes)
    const diasPeriodo = quinzena === 1 ? diasMes.slice(0, f1 + 1) : diasMes.slice(f1 + 1)

    const { data: presencas } = await supabase.from('presencas')
      .select('funcionario_id, data, tipo, fracao, fracao2, obra_id, obra2_id')
      .eq('competencia_id', comp.id)
      .in('data', diasPeriodo.map(d => formatDate(d)))

    // Buscar funcionários da equipe
    const { data: funcs } = await supabase.from('funcionarios')
      .select('id,nome,equipe').eq('equipe', equipe).eq('ativo', true).order('nome')

    // Para cada funcionário, calcular
    const resultado: LinhaPassagem[] = []
    for (const func of funcs || []) {
      const presFunc = (presencas || []).filter(p => p.funcionario_id === func.id)
      let totalPass = 0, totalCafe = 0, diasTrabalhados = 0
      const alertas: string[] = []

      for (const p of presFunc) {
        if (p.tipo === 'FALTA' || AUSENCIAS.includes(p.tipo)) continue
        const fracao = (p.fracao || 0) + (p.fracao2 || 0)
        diasTrabalhados++
        totalCafe += CAFE_DIA

        // Buscar passagem
        let passValor = 0
        if (p.obra_id) {
          const { data: fop1 } = await supabase.from('funcionario_obra_passagem')
            .select('valor_passagem,tipo_passagem')
            .eq('funcionario_id', func.id).eq('obra_id', p.obra_id).single()

          if (!fop1) {
            alertas.push(`Sem passagem: ${formatDate(new Date(p.data))}`)
          } else if (fop1.tipo_passagem !== 'MG' && fop1.tipo_passagem !== 'NÃO TEM') {
            passValor = fop1.valor_passagem

            if (p.obra2_id) {
              const { data: fop2 } = await supabase.from('funcionario_obra_passagem')
                .select('valor_passagem,tipo_passagem')
                .eq('funcionario_id', func.id).eq('obra_id', p.obra2_id).single()
              if (fop2 && fop2.tipo_passagem !== 'MG' && fop2.tipo_passagem !== 'NÃO TEM') {
                passValor = (passValor + fop2.valor_passagem) / 2
              }
            }
            totalPass += passValor * fracao
          }
        }
      }

      // Verificar se já tem dados salvos
      const salvo = qData?.find(q => (q as any).funcionarios?.nome === func.nome)

      resultado.push({
        funcionario_id: func.id,
        nome: func.nome,
        equipe: func.equipe,
        tipo_passagem: 'Ver matriz',
        total_passagem: totalPass,
        total_cafe: totalCafe,
        valor_gasto: salvo?.valor_gasto || totalPass,
        recebido_ant: salvo?.recebido_ant || 0,
        saldo_vt: salvo?.saldo_vt || 0,
        dias_proj: salvo?.dias_proj || diasTrabalhados,
        valor_proj: salvo?.valor_proj || totalPass,
        adicional: salvo?.adicional || 0,
        alertas,
        quinzena_id: salvo?.id,
      })
    }

    setLinhas(resultado)
    setLoading(false)
  }

  async function salvarLinha(linha: LinhaPassagem, form: Partial<LinhaPassagem>) {
    const { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).single()
    if (!comp) return
    const payload = {
      competencia_id: comp.id,
      funcionario_id: linha.funcionario_id,
      quinzena,
      total_passagem: linha.total_passagem,
      total_cafe: linha.total_cafe,
      valor_gasto: form.valor_gasto ?? linha.valor_gasto,
      recebido_ant: form.recebido_ant ?? linha.recebido_ant,
      saldo_vt: (form.recebido_ant ?? linha.recebido_ant) - (form.valor_gasto ?? linha.valor_gasto),
      dias_proj: form.dias_proj ?? linha.dias_proj,
      valor_proj: form.valor_proj ?? linha.valor_proj,
      adicional: form.adicional ?? linha.adicional,
    }
    if (linha.quinzena_id) {
      await supabase.from('passagens_quinzena').update(payload).eq('id', linha.quinzena_id)
    } else {
      await supabase.from('passagens_quinzena').insert(payload)
    }
    setEditandoId(null)
    await carregar()
  }

  function edI(field: keyof LinhaPassagem, w = 75) {
    return (
      <input type="number" step="0.01"
        className="text-right text-xs border border-yellow-400 rounded px-1 py-0.5 bg-yellow-50"
        style={{ width: w }}
        value={(editForm[field] as number) || 0}
        onChange={e => setEditForm(f => ({ ...f, [field]: parseFloat(e.target.value) || 0 }))}
      />
    )
  }

  const totalPass = linhas.reduce((s, l) => s + l.total_passagem, 0)
  const totalCafe = linhas.reduce((s, l) => s + l.total_cafe, 0)
  const totalGeral = totalPass + totalCafe

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1a3a5c]">Passagem &amp; Café</h1>
          <p className="text-gray-500 text-sm mt-0.5">Calculado automaticamente por funcionário + obra</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {(['ARMAÇÃO', 'CARPINTARIA'] as const).map(eq => (
            <button key={eq} onClick={() => setEquipe(eq)}
              className={equipe === eq ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>{eq}</button>
          ))}
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            <button onClick={() => setQuinzena(1)}
              className={`px-3 py-1.5 text-sm font-medium ${quinzena === 1 ? 'bg-[#1a3a5c] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              1ª Quinzena (Dia 16)
            </button>
            <button onClick={() => setQuinzena(2)}
              className={`px-3 py-1.5 text-sm font-medium ${quinzena === 2 ? 'bg-[#1a3a5c] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              2ª Quinzena (Dia 01)
            </button>
          </div>
          <input type="month" className="input text-sm py-1.5 w-36" value={mes} onChange={e => setMes(e.target.value)} />
          <button onClick={() => window.print()} className="btn-ghost btn-sm">🖨 Imprimir</button>
        </div>
      </div>

      {msg && <div className={msg.includes('⚠') ? 'alert-warn mb-4' : 'alert-ok mb-4'}>{msg}</div>}

      {/* Totais rápidos */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="stat"><div className="stat-label">Total Passagem</div><div className="stat-val text-blue-700">{formatR$(totalPass)}</div></div>
        <div className="stat"><div className="stat-label">Total Café (R$8/dia)</div><div className="stat-val text-green-700">{formatR$(totalCafe)}</div></div>
        <div className="stat"><div className="stat-label">Total Geral</div><div className="stat-val">{formatR$(totalGeral)}</div></div>
      </div>

      {loading ? (
        <div className="card-pad text-center py-12 text-gray-400">Calculando passagens...</div>
      ) : (
        <div className="card overflow-auto">
          <table className="border-collapse" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th className="th-left sticky left-0 z-10" style={{ minWidth: 200 }}>FUNCIONÁRIO</th>
                <th className="th">TOTAL PASSAGEM</th>
                <th className="th">TOTAL CAFÉ</th>
                <th className="th" style={{ background: '#7c3aed' }}>VL GASTO QUIN.</th>
                <th className="th" style={{ background: '#7c3aed' }}>RECEBIDO ANT.</th>
                <th className="th">SALDO VT</th>
                <th className="th" style={{ background: '#7c3aed' }}>DIAS PROJ.</th>
                <th className="th" style={{ background: '#7c3aed' }}>VL PROJ.</th>
                <th className="th" style={{ background: '#7c3aed' }}>ADICIONAL</th>
                <th className="th">STATUS</th>
                <th className="th">AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, i) => {
                const ed = editandoId === linha.funcionario_id
                const temAlerta = linha.alertas.length > 0
                return (
                  <tr key={linha.funcionario_id}
                    className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'} ${temAlerta ? 'ring-1 ring-inset ring-amber-300' : ''}`}>
                    <td className="td font-semibold text-[#1a3a5c] sticky left-0 bg-inherit border-r-2 border-gray-200" style={{ minWidth: 200 }}>
                      {linha.nome}
                      {temAlerta && <div className="badge-warn mt-0.5 text-[10px]">⚠ {linha.alertas.length} alerta(s)</div>}
                    </td>
                    <td className="td-num font-bold text-blue-800 bg-blue-50">{formatR$(linha.total_passagem)}</td>
                    <td className="td-num bg-green-50">{formatR$(linha.total_cafe)}</td>
                    <td className="td text-center bg-purple-50">{ed ? edI('valor_gasto') : formatR$(linha.valor_gasto)}</td>
                    <td className="td text-center bg-purple-50">{ed ? edI('recebido_ant') : formatR$(linha.recebido_ant)}</td>
                    <td className="td-num">{formatR$(linha.saldo_vt)}</td>
                    <td className="td text-center bg-purple-50">{ed ? edI('dias_proj', 55) : linha.dias_proj}</td>
                    <td className="td text-center bg-purple-50">{ed ? edI('valor_proj') : formatR$(linha.valor_proj)}</td>
                    <td className="td text-center bg-purple-50">{ed ? edI('adicional') : formatR$(linha.adicional)}</td>
                    <td className="td-center">
                      {linha.quinzena_id ? <span className="badge-ok">Salvo</span> : <span className="badge-warn">Pendente</span>}
                    </td>
                    <td className="td-center">
                      {ed ? (
                        <div className="flex gap-1">
                          <button onClick={() => salvarLinha(linha, editForm)} className="btn btn-sm bg-green-700 text-white">✓</button>
                          <button onClick={() => setEditandoId(null)} className="btn btn-sm bg-gray-200 text-gray-600">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditandoId(linha.funcionario_id); setEditForm({ ...linha }) }} className="btn-ghost btn-sm">
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-blue-50 font-bold">
                <td className="td sticky left-0 bg-blue-50">TOTAL {equipe}</td>
                <td className="td-num text-blue-900">{formatR$(totalPass)}</td>
                <td className="td-num text-green-900">{formatR$(totalCafe)}</td>
                {Array(8).fill(null).map((_, i) => <td key={i} className="td"></td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
