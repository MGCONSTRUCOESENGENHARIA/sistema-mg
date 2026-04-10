'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tela = 'dia' | 'confirma_dia' | 'obra' | 'equipe' | 'funcionarios' |
  'atrasados' | 'saiu_cedo' |
  'conta_obra' | 'conta_obra_det' | 'conta_mg' | 'conta_mg_det' |
  'confirmacao' | 'sucesso'

interface Estado {
  data: string; obra: any; equipe: 'ARMAÇÃO' | 'CARPINTARIA' | null
  presentes: any[]
  simAtrasado: boolean | null; atrasados: any[]; horariosAtrasados: Record<string, string>
  simSaiu: boolean | null; saiuCedo: any[]; horariosSaiu: Record<string, string>
  teveObra: boolean | null; solicitouObra: string
  periodoObra: 'DIA_TODO' | 'METADE' | null; servicoObra: string; funcsObra: any[]
  teveMG: boolean | null; periodoMG: 'DIA_TODO' | 'METADE' | null
  servicoMG: string; funcsMG: any[]
}

const INIT: Estado = {
  data: new Date().toISOString().slice(0, 10),
  obra: null, equipe: null, presentes: [],
  simAtrasado: null, atrasados: [], horariosAtrasados: {},
  simSaiu: null, saiuCedo: [], horariosSaiu: {},
  teveObra: null, solicitouObra: '', periodoObra: null, servicoObra: '', funcsObra: [],
  teveMG: null, periodoMG: null, servicoMG: '', funcsMG: [],
}

const STEPS: Tela[] = ['dia', 'obra', 'equipe', 'funcionarios', 'atrasados', 'saiu_cedo', 'conta_obra', 'conta_mg', 'confirmacao']

function Busca({ todos, selecionados, onChange, placeholder }: {
  todos: any[], selecionados: any[], onChange: (v: any[]) => void, placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [mostrar, setMostrar] = useState<any[]>([])

  useEffect(() => {
    if (q.length === 0) { setMostrar([]); return }
    const disp = todos.filter((f: any) =>
      !selecionados.find((s: any) => s.id === f.id) &&
      f.nome.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 8)
    setMostrar(disp)
  }, [q, todos, selecionados])

  return (
    <div>
      <input
        type="search"
        value={q}
        placeholder={placeholder || 'Digite o nome...'}
        autoComplete="off"
        style={{ width: '100%', padding: '14px 16px', fontSize: 16, border: '2px solid #cbd5e1', borderRadius: 12, outline: 'none', background: 'white', boxSizing: 'border-box' as const, color: '#111' }}
        onChange={e => setQ(e.target.value)}
      />
      {mostrar.length > 0 && (
        <div style={{ background: 'white', border: '2px solid #cbd5e1', borderRadius: 12, marginTop: 6, overflow: 'hidden' }}>
          {mostrar.map((f: any) => (
            <div key={f.id}
              style={{ padding: '16px', fontSize: 15, color: '#111', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: 'white' }}
              onClick={() => { onChange([...selecionados, f]); setQ(''); setMostrar([]) }}>
              {f.nome}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginTop: selecionados.length ? 10 : 0 }}>
        {selecionados.map((f: any) => (
          <div key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 20, background: '#dbeafe', fontSize: 14, fontWeight: 600, color: '#1e40af' }}>
            {f.nome.split(' ')[0]}
            <span style={{ fontSize: 20, color: '#93c5fd', cursor: 'pointer', lineHeight: 1 }}
              onClick={() => onChange(selecionados.filter((s: any) => s.id !== f.id))}>×</span>
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
  const [funcsDisp, setFuncsDisp] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [e, setE] = useState<Estado>(INIT)

  useEffect(() => {
    supabase.from('obras').select('id,nome,codigo').eq('status', 'ATIVA').order('nome')
      .then(({ data }) => setObras(data || []))
  }, [])

  useEffect(() => {
    if (e.equipe) {
      supabase.from('funcionarios').select('id,nome').eq('ativo', true).eq('equipe', e.equipe).order('nome')
        .then(({ data }) => setFuncs(data || []))
    }
  }, [e.equipe])

  useEffect(() => {
    if (!e.obra || !e.data || !funcs.length) { setFuncsDisp(funcs); return }
    supabase.from('presencas').select('funcionario_id').eq('data', e.data).eq('obra_id', e.obra.id)
      .then(({ data }) => {
        const jaReg = new Set((data || []).map((p: any) => p.funcionario_id))
        setFuncsDisp(funcs.filter(f => !jaReg.has(f.id)))
      })
  }, [e.obra, e.data, funcs])

  function upd(k: Partial<Estado>) { setE(prev => ({ ...prev, ...k })) }
  function ir(t: Tela) { setTela(t) }
  const step = STEPS.indexOf(tela) + 1
  const azul = '#1e3a8a'

  async function salvar() {
    setSalvando(true)
    const mes = e.data.slice(0, 7)
    let { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status: 'ABERTA' }).select().single()
      comp = nova
    }
    for (const f of e.presentes) {
      const at = e.atrasados.find((a: any) => a.id === f.id)
      const sc = e.saiuCedo.find((s: any) => s.id === f.id)
      await supabase.from('presencas').upsert({
        competencia_id: comp!.id, funcionario_id: f.id,
        data: e.data, obra_id: e.obra.id, tipo: 'NORMAL', fracao: (at || sc) ? 0.5 : 1,
      }, { onConflict: 'funcionario_id,data,competencia_id' })
    }
    if (e.teveObra) {
      for (const f of e.funcsObra) {
        await supabase.from('diarias_extras').insert({
          obra_id: e.obra.id, funcionario_id: f.id, data: e.data, tipo: 'CONTA_OBRA',
          quantidade: e.periodoObra === 'METADE' ? 0.5 : 1, servico: e.servicoObra,
          observacao: `Solicitado: ${e.solicitouObra}`, descontada_producao: false, recebida_medicao: false,
        })
      }
    }
    if (e.teveMG) {
      for (const f of e.funcsMG) {
        await supabase.from('diarias_extras').insert({
          obra_id: e.obra.id, funcionario_id: f.id, data: e.data, tipo: 'CONTA_MG',
          quantidade: e.periodoMG === 'METADE' ? 0.5 : 1, servico: e.servicoMG,
          descontada_producao: false, recebida_medicao: false,
        })
      }
    }
    const resumo = [
      `Equipe: ${e.equipe}`,
      `Presentes (${e.presentes.length}): ${e.presentes.map((f: any) => f.nome).join(', ')}`,
      e.atrasados.length > 0 ? `Atrasados: ${e.atrasados.map((f: any) => `${f.nome} (${e.horariosAtrasados[f.id] || '?'})`).join(', ')}` : null,
      e.saiuCedo.length > 0 ? `Saíram cedo: ${e.saiuCedo.map((f: any) => `${f.nome} (${e.horariosSaiu[f.id] || '?'})`).join(', ')}` : null,
      e.teveObra ? `Conta Obra: ${e.servicoObra} | ${e.periodoObra === 'METADE' ? 'Metade' : 'Dia todo'} | ${e.solicitouObra} | ${e.funcsObra.map((f: any) => f.nome).join(', ')}` : null,
      e.teveMG ? `Conta MG: ${e.servicoMG} | ${e.periodoMG === 'METADE' ? 'Metade' : 'Dia todo'} | ${e.funcsMG.map((f: any) => f.nome).join(', ')}` : null,
    ].filter(Boolean).join('\n')
    await supabase.from('folhas_ponto').insert({
      obra_id: e.obra.id, equipe: e.equipe, data: e.data, foto_url: '',
      tem_diaria_extra: !!(e.teveObra || e.teveMG), observacao: resumo, processada: false,
    })
    setSalvando(false)
    ir('sucesso')
  }

  const s = {
    page: { minHeight: '100vh', background: '#f8fafc', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' as const },
    top: { background: azul, padding: '16px 20px', display: 'flex', alignItems: 'center' as const, gap: 12 },
    body: { flex: 1, padding: '24px 20px', overflowY: 'auto' as const },
    bot: { padding: '16px 20px', background: 'white', borderTop: '1px solid #e2e8f0' },
    h1: { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8 },
    sub: { fontSize: 14, color: '#64748b', marginBottom: 20 },
    lbl: { fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block' as const, marginBottom: 8, marginTop: 20 },
    inp: { width: '100%', padding: '14px 16px', fontSize: 16, border: '2px solid #cbd5e1', borderRadius: 12, outline: 'none', background: 'white', boxSizing: 'border-box' as const, color: '#111' },
  }

  function PBtn({ disabled, onClick, label }: any) {
    return (
      <button disabled={disabled} onClick={onClick}
        style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: disabled ? '#94a3b8' : azul, color: 'white', fontSize: 16, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {label}
      </button>
    )
  }

  function SBtn({ onClick, label }: any) {
    return <button onClick={onClick} style={{ width: '100%', padding: 14, borderRadius: 14, border: '2px solid #e2e8f0', background: 'white', color: '#374151', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 10 }}>{label}</button>
  }

  function YN({ sel, verde, emoji, label, onClick }: any) {
    return (
      <div onClick={onClick} style={{ flex: 1, padding: '20px 12px', borderRadius: 16, textAlign: 'center' as const, cursor: 'pointer', border: sel ? `2px solid ${verde ? '#059669' : '#dc2626'}` : '2px solid #e2e8f0', background: sel ? (verde ? '#d1fae5' : '#fee2e2') : 'white' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{emoji}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: sel ? (verde ? '#059669' : '#dc2626') : '#374151' }}>{label}</div>
      </div>
    )
  }

  function Period({ sel, onClick, icon, label }: any) {
    return (
      <div onClick={onClick} style={{ flex: 1, padding: '18px 12px', borderRadius: 14, border: sel ? `2px solid ${azul}` : '2px solid #e2e8f0', background: sel ? '#dbeafe' : 'white', cursor: 'pointer', textAlign: 'center' as const }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: sel ? azul : '#374151' }}>{label}</div>
      </div>
    )
  }

  function CRow({ label, value, color }: any) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', gap: 12 }}>
        <span style={{ fontSize: 13, color: '#64748b', flexShrink: 0, minWidth: 80 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: color || '#0f172a', textAlign: 'right' as const }}>{value}</span>
      </div>
    )
  }

  if (tela === 'sucesso') return (
    <div style={s.page}>
      <div style={s.top}><span style={{ color: 'white', fontWeight: 800, fontSize: 18 }}>MG Campo</span></div>
      <div style={{ ...s.body, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', textAlign: 'center', paddingTop: 48 }}>
        <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, marginBottom: 24 }}>✅</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Salvo!</div>
        <div style={{ fontSize: 15, color: '#64748b', marginBottom: 32 }}>Lançamento registrado no sistema.</div>
        <PBtn onClick={() => { setE(INIT); ir('dia') }} label="Novo lançamento" />
      </div>
    </div>
  )

  const goBack = () => {
    if (tela === 'confirma_dia') ir('dia')
    else if (tela === 'conta_obra_det') ir('conta_obra')
    else if (tela === 'conta_mg_det') ir('conta_mg')
    else { const i = STEPS.indexOf(tela); if (i > 0) ir(STEPS[i - 1]) }
  }

  return (
    <div style={s.page}>
      <div style={s.top}>
        {tela !== 'dia' && (
          <button onClick={goBack} style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.2)', color: 'white', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>←</button>
        )}
        <div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 17 }}>MG Campo</div>
          {e.obra && <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>{e.obra.nome}</div>}
        </div>
      </div>

      <div style={{ background: '#1e40af', padding: '0 20px 12px', display: 'flex', gap: 4 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i + 1 < step ? 'white' : i + 1 === step ? '#93c5fd' : 'rgba(255,255,255,.25)' }} />
        ))}
      </div>

      {tela === 'dia' && (
        <div style={s.body}>
          <div style={s.h1}>Essa diária é de hoje?</div>
          <div style={s.sub}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <YN sel={false} verde emoji="✅" label="Sim, hoje" onClick={() => { upd({ data: new Date().toISOString().slice(0, 10) }); ir('obra') }} />
            <YN sel={false} verde={false} emoji="📅" label="Outro dia" onClick={() => ir('confirma_dia')} />
          </div>
        </div>
      )}

      {tela === 'confirma_dia' && (
        <>
          <div style={s.body}>
            <div style={s.h1}>Qual a data?</div>
            <input type="date" style={{ ...s.inp, minHeight: 54 }}
              value={e.data} max={new Date().toISOString().slice(0, 10)}
              onChange={ev => upd({ data: ev.target.value })} />
            {e.data && (
              <div style={{ marginTop: 14, padding: '14px 16px', background: '#dbeafe', borderRadius: 12, fontWeight: 700, color: azul }}>
                📅 {new Date(e.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            )}
          </div>
          <div style={s.bot}><PBtn disabled={!e.data} onClick={() => ir('obra')} label="Confirmar →" /></div>
        </>
      )}

      {tela === 'obra' && (
        <>
          <div style={s.body}>
            <div style={s.h1}>Qual a obra?</div>
            <div style={s.sub}>Digite para buscar</div>
            <Busca
              todos={obras}
              selecionados={e.obra ? [e.obra] : []}
              onChange={v => upd({ obra: v.length ? v[v.length - 1] : null })}
              placeholder="Ex: Barreiro, Savassi..."
            />
          </div>
          <div style={s.bot}><PBtn disabled={!e.obra} onClick={() => ir('equipe')} label="Continuar →" /></div>
        </>
      )}

      {tela === 'equipe' && (
        <>
          <div style={s.body}>
            <div style={s.h1}>Qual a equipe?</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <YN sel={e.equipe === 'ARMAÇÃO'} verde emoji="🔩" label="Armação" onClick={() => upd({ equipe: 'ARMAÇÃO', presentes: [] })} />
              <YN sel={e.equipe === 'CARPINTARIA'} verde emoji="🪵" label="Carpintaria" onClick={() => upd({ equipe: 'CARPINTARIA', presentes: [] })} />
            </div>
          </div>
          <div style={s.bot}><PBtn disabled={!e.equipe} onClick={() => ir('funcionarios')} label="Continuar →" /></div>
        </>
      )}

      {tela === 'funcionarios' && (
        <>
          <div style={s.body}>
            <div style={s.h1}>Quem estava na obra?</div>
            {funcsDisp.length === 0 && funcs.length > 0 ? (
              <div style={{ padding: 32, background: '#d1fae5', borderRadius: 14, textAlign: 'center' as const }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 700, color: '#059669' }}>Todos já registrados hoje!</div>
              </div>
            ) : (
              <Busca todos={funcsDisp} selecionados={e.presentes} onChange={v => upd({ presentes: v })} placeholder="Buscar funcionário..." />
            )}
          </div>
          <div style={s.bot}><PBtn disabled={!e.presentes.length} onClick={() => ir('atrasados')} label="Continuar →" /></div>
        </>
      )}

      {tela === 'atrasados' && (
        <>
          <div style={s.body}>
            <div style={s.h1}>Alguém chegou atrasado?</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <YN sel={e.simAtrasado === false} verde={false} emoji="❌" label="Não" onClick={() => upd({ simAtrasado: false, atrasados: [], horariosAtrasados: {} })} />
              <YN sel={e.simAtrasado === true} verde emoji="✅" label="Sim" onClick={() => upd({ simAtrasado: true })} />
            </div>
            {e.simAtrasado === true && (
              <>
                <span style={s.lbl}>Quem?</span>
                <Busca todos={e.presentes} selecionados={e.atrasados} onChange={v => upd({ atrasados: v })} placeholder="Buscar..." />
                {e.atrasados.map((f: any) => (
                  <div key={f.id} style={{ marginTop: 12, background: 'white', border: '2px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>⏰ {f.nome.split(' ')[0]} — que horas chegou?</div>
                    <input type="time" style={s.inp} value={e.horariosAtrasados[f.id] || ''}
                      onChange={ev => upd({ horariosAtrasados: { ...e.horariosAtrasados, [f.id]: ev.target.value } })} />
                  </div>
                ))}
              </>
            )}
          </div>
          <div style={s.bot}>
            <PBtn
              disabled={e.simAtrasado === null || (e.simAtrasado === true && (!e.atrasados.length || e.atrasados.some((f: any) => !e.horariosAtrasados[f.id])))}
              onClick={() => ir('saiu_cedo')} label="Continuar →" />
          </div>
        </>
      )}

      {tela === 'saiu_cedo' && (
        <>
          <div style={s.body}>
            <div style={s.h1}>Alguém saiu mais cedo?</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <YN sel={e.simSaiu === false} verde={false} emoji="❌" label="Não" onClick={() => upd({ simSaiu: false, saiuCedo: [], horariosSaiu: {} })} />
              <YN sel={e.simSaiu === true} verde emoji="✅" label="Sim" onClick={() => upd({ simSaiu: true })} />
            </div>
            {e.simSaiu === true && (
              <>
                <span style={s.lbl}>Quem?</span>
                <Busca todos={e.presentes} selecionados={e.saiuCedo} onChange={v => upd({ saiuCedo: v })} placeholder="Buscar..." />
                {e.saiuCedo.map((f: any) => (
                  <div key={f.id} style={{ marginTop: 12, background: 'white', border: '2px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🚪 {f.nome.split(' ')[0]} — que horas saiu?</div>
                    <input type="time" style={s.inp} value={e.horariosSaiu[f.id] || ''}
                      onChange={ev => upd({ horariosSaiu: { ...e.horariosSaiu, [f.id]: ev.target.value } })} />
                  </div>
                ))}
              </>
            )}
          </div>
          <div style={s.bot}>
            <PBtn
              disabled={e.simSaiu === null || (e.simSaiu === true && (!e.saiuCedo.length || e.saiuCedo.some((f: any) => !e.horariosSaiu[f.id])))}
              onClick={() => ir('conta_obra')} label="Continuar →" />
          </div>
        </>
      )}

      {tela === 'conta_obra' && (
        <>
          <div style={s.body}>
            <div style={s.h1}>Teve diária por conta da obra?</div>
            <div style={s.sub}>Serviço extra solicitado pelo cliente</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <YN sel={e.teveObra === false} verde={false} emoji="❌" label="Não" onClick={() => upd({ teveObra: false, funcsObra: [] })} />
              <YN sel={e.teveObra === true} verde emoji="✅" label="Sim" onClick={() => upd({ teveObra: true })} />
            </div>
          </div>
          <div style={s.bot}><PBtn disabled={e.teveObra === null} onClick={() => ir(e.teveObra ? 'conta_obra_det' : 'conta_mg')} label="Continuar →" /></div>
        </>
      )}

      {tela === 'conta_obra_det' && (
        <>
          <div style={s.body}>
            <div style={s.h1}>Detalhes — Conta Obra</div>
            <span style={s.lbl}>Quem solicitou?</span>
            <input style={s.inp} value={e.solicitouObra} onChange={ev => upd({ solicitouObra: ev.target.value })} placeholder="Nome do responsável..." />
            <span style={s.lbl}>Período</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <Period sel={e.periodoObra === 'DIA_TODO'} onClick={() => upd({ periodoObra: 'DIA_TODO' })} icon="☀️" label="Dia todo" />
              <Period sel={e.periodoObra === 'METADE'} onClick={() => upd({ periodoObra: 'METADE' })} icon="🌤" label="Metade" />
            </div>
            <span style={s.lbl}>Serviço executado</span>
            <textarea style={{ ...s.inp, height: 90, resize: 'none' as const }} value={e.servicoObra}
              onChange={ev => upd({ servicoObra: ev.target.value })} placeholder="Descreva o serviço..." />
            <span style={s.lbl}>Funcionários ({e.funcsObra.length})</span>
            <Busca todos={e.presentes} selecionados={e.funcsObra} onChange={v => upd({ funcsObra: v })} placeholder="Buscar..." />
          </div>
          <div style={s.bot}>
            <PBtn disabled={!e.solicitouObra || !e.periodoObra || !e.servicoObra || !e.funcsObra.length} onClick={() => ir('conta_mg')} label="Continuar →" />
          </div>
        </>
      )}

      {tela === 'conta_mg' && (
        <>
          <div style={s.body}>
            <div style={s.h1}>Teve diária por conta da MG?</div>
            <div style={s.sub}>Serviço extra solicitado pela MG Construções</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <YN sel={e.teveMG === false} verde={false} emoji="❌" label="Não" onClick={() => upd({ teveMG: false, funcsMG: [] })} />
              <YN sel={e.teveMG === true} verde emoji="✅" label="Sim" onClick={() => upd({ teveMG: true })} />
            </div>
          </div>
          <div style={s.bot}><PBtn disabled={e.teveMG === null} onClick={() => ir(e.teveMG ? 'conta_mg_det' : 'confirmacao')} label="Continuar →" /></div>
        </>
      )}

      {tela === 'conta_mg_det' && (
        <>
          <div style={s.body}>
            <div style={s.h1}>Detalhes — Conta MG</div>
            <span style={s.lbl}>Período</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <Period sel={e.periodoMG === 'DIA_TODO'} onClick={() => upd({ periodoMG: 'DIA_TODO' })} icon="☀️" label="Dia todo" />
              <Period sel={e.periodoMG === 'METADE'} onClick={() => upd({ periodoMG: 'METADE' })} icon="🌤" label="Metade" />
            </div>
            <span style={s.lbl}>Serviço executado</span>
            <textarea style={{ ...s.inp, height: 90, resize: 'none' as const }} value={e.servicoMG}
              onChange={ev => upd({ servicoMG: ev.target.value })} placeholder="Descreva o serviço..." />
            <span style={s.lbl}>Funcionários ({e.funcsMG.length})</span>
            <Busca todos={e.presentes} selecionados={e.funcsMG} onChange={v => upd({ funcsMG: v })} placeholder="Buscar..." />
          </div>
          <div style={s.bot}>
            <PBtn disabled={!e.periodoMG || !e.servicoMG || !e.funcsMG.length} onClick={() => ir('confirmacao')} label="Continuar →" />
          </div>
        </>
      )}

      {tela === 'confirmacao' && (
        <>
          <div style={s.body}>
            <div style={s.h1}>Confirmar</div>
            <div style={s.sub}>Revise antes de salvar</div>
            <div style={{ background: 'white', border: '2px solid #e2e8f0', borderRadius: 16, padding: 16, marginBottom: 14 }}>
              <CRow label="Obra" value={e.obra?.nome} color={azul} />
              <CRow label="Data" value={new Date(e.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} />
              <CRow label="Equipe" value={e.equipe || ''} />
              <CRow label="Presentes" value={e.presentes.map((f: any) => f.nome).join(', ')} color="#059669" />
              {e.atrasados.length > 0 && <CRow label="Atrasados" value={e.atrasados.map((f: any) => `${f.nome} (${e.horariosAtrasados[f.id] || '?'})`).join(', ')} color="#92400e" />}
              {e.saiuCedo.length > 0 && <CRow label="Saíram cedo" value={e.saiuCedo.map((f: any) => `${f.nome} (${e.horariosSaiu[f.id] || '?'})`).join(', ')} color="#92400e" />}
              {e.teveObra && <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '14px 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Conta Obra</div>
                <CRow label="Solicitou" value={e.solicitouObra} />
                <CRow label="Período" value={e.periodoObra === 'DIA_TODO' ? 'Dia todo' : 'Metade'} />
                <CRow label="Serviço" value={e.servicoObra} />
                <CRow label="Funcs" value={e.funcsObra.map((f: any) => f.nome).join(', ')} />
              </>}
              {e.teveMG && <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '14px 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Conta MG</div>
                <CRow label="Período" value={e.periodoMG === 'DIA_TODO' ? 'Dia todo' : 'Metade'} />
                <CRow label="Serviço" value={e.servicoMG} />
                <CRow label="Funcs" value={e.funcsMG.map((f: any) => f.nome).join(', ')} />
              </>}
            </div>
          </div>
          <div style={s.bot}>
            <PBtn disabled={salvando} onClick={salvar} label={salvando ? '⏳ Salvando...' : '✓ Confirmar e salvar'} />
            <SBtn onClick={() => ir('dia')} label="Voltar ao início" />
          </div>
        </>
      )}
    </div>
  )
}
