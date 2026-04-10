'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Tela = 'pergunta_obra' | 'detalhes_obra' | 'pergunta_mg' | 'detalhes_mg' | 'confirmacao' | 'sucesso'

interface Estado {
  obra: any
  data: string
  // Conta Obra
  teveObra: boolean | null
  solicitadoPor: string
  horarioObra: string
  servicoObra: string
  funcsObra: string[]
  // Conta MG
  teveMG: boolean | null
  horarioMG: string
  servicoMG: string
  funcsMG: string[]
}

export default function CampoLancar() {
  const router = useRouter()
  const [tela, setTela] = useState<Tela>('pergunta_obra')
  const [obras, setObras] = useState<any[]>([])
  const [funcs, setFuncs] = useState<any[]>([])
  const [obraSel, setObraSel] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [estado, setEstado] = useState<Estado>({
    obra: null, data: new Date().toISOString().slice(0,10),
    teveObra: null, solicitadoPor: '', horarioObra: '', servicoObra: '', funcsObra: [],
    teveMG: null, horarioMG: '', servicoMG: '', funcsMG: [],
  })

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/campo'); return }
      const { data: p } = await supabase.from('perfis').select('*').eq('id', session.user.id).single()
      setPerfil(p)
      const { data: os } = await supabase.from('obras').select('id,nome,codigo').eq('status','ATIVA').order('nome')
      setObras(os || [])
    })
  }, [])

  async function selecionarObra(obra: any) {
    setObraSel(obra)
    setEstado(e => ({ ...e, obra }))
    const { data: fs } = await supabase.from('funcionarios')
      .select('id,nome,equipe').eq('ativo',true).order('nome')
    setFuncs(fs || [])
  }

  function toggleFunc(id: string, tipo: 'obra'|'mg') {
    setEstado(e => {
      const key = tipo === 'obra' ? 'funcsObra' : 'funcsMG'
      const list = e[key] as string[]
      return { ...e, [key]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] }
    })
  }

  async function salvar() {
    setSalvando(true)
    const mes = estado.data.slice(0,7)
    let { data: comp } = await supabase.from('competencias').select('id').eq('mes_ano', mes).maybeSingle()
    if (!comp) {
      const { data: nova } = await supabase.from('competencias').insert({ mes_ano: mes, status:'ABERTA' }).select().single()
      comp = nova
    }

    const inserts = []

    // Conta Obra
    if (estado.teveObra && estado.funcsObra.length > 0) {
      for (const fid of estado.funcsObra) {
        inserts.push(supabase.from('diarias_extras').insert({
          obra_id: estado.obra.id, funcionario_id: fid,
          data: estado.data, tipo: 'CONTA_OBRA', quantidade: 1,
          servico: estado.servicoObra,
          observacao: `Solicitado por: ${estado.solicitadoPor} | Horário: ${estado.horarioObra}`,
          descontada_producao: false, recebida_medicao: false,
        }))
      }
    }

    // Conta MG
    if (estado.teveMG && estado.funcsMG.length > 0) {
      for (const fid of estado.funcsMG) {
        inserts.push(supabase.from('diarias_extras').insert({
          obra_id: estado.obra.id, funcionario_id: fid,
          data: estado.data, tipo: 'CONTA_MG', quantidade: 1,
          servico: estado.servicoMG,
          observacao: `Horário: ${estado.horarioMG}`,
          descontada_producao: false, recebida_medicao: false,
        }))
      }
    }

    await Promise.all(inserts)
    setSalvando(false)
    setTela('sucesso')
  }

  function novo() {
    setTela('pergunta_obra')
    setObraSel(null)
    setEstado({ obra: null, data: new Date().toISOString().slice(0,10), teveObra: null, solicitadoPor: '', horarioObra: '', servicoObra: '', funcsObra: [], teveMG: null, horarioMG: '', servicoMG: '', funcsMG: [] })
  }

  const steps: Record<Tela, number> = { pergunta_obra:1, detalhes_obra:2, pergunta_mg:3, detalhes_mg:4, confirmacao:5, sucesso:6 }
  const total = 5
  const atual = Math.min(steps[tela], total)

  const S = {
    container: { minHeight:'100vh', background:'#f5f6fa', display:'flex', flexDirection:'column' as const, maxWidth:480, margin:'0 auto' },
    topbar: { background:'#1e3a8a', padding:'14px 16px', display:'flex', alignItems:'center' as const, gap:10 },
    back: { color:'white', fontSize:20, cursor:'pointer', opacity:.7, border:'none', background:'none' },
    title: { color:'white', fontWeight:700, fontSize:16 },
    sub: { color:'rgba(255,255,255,.6)', fontSize:12, marginTop:2 },
    progress: { background:'#1e3a8a', padding:'0 16px 14px', display:'flex', gap:4 },
    dot: (done: boolean, active: boolean) => ({ height:4, borderRadius:2, flex:1, background: done?'white':active?'#60a5fa':'rgba(255,255,255,.2)' }),
    content: { flex:1, padding:'20px 16px', overflowY:'auto' as const },
    bigLabel: { fontSize:20, fontWeight:700, color:'#1f2937', marginBottom:6 },
    subLabel: { fontSize:14, color:'#6b7280', marginBottom:24, lineHeight:'1.5' },
    yesno: { display:'flex', gap:12, marginTop:8 },
    yn: (sel?: boolean, type?: 'sim'|'nao') => ({
      flex:1, padding:'20px 12px', borderRadius:14, cursor:'pointer', textAlign:'center' as const,
      border: sel ? `2px solid ${type==='sim'?'#059669':'#dc2626'}` : '1.5px solid #e5e7eb',
      background: sel ? (type==='sim'?'#f0fdf4':'#fef2f2') : '#f9fafb',
      fontSize:28,
    }),
    ynLabel: { display:'block' as const, fontSize:14, fontWeight:600, marginTop:6, color:'#374151' },
    fieldLabel: { fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:6, marginTop:16, textTransform:'uppercase' as const, letterSpacing:'0.04em' },
    input: { width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10, padding:'12px 14px', fontSize:14, outline:'none', background:'white', color:'#1f2937' },
    funcCard: (sel: boolean) => ({
      display:'flex', alignItems:'center' as const, gap:10, padding:'12px 14px',
      border: sel ? '2px solid #1e3a8a' : '1px solid #e5e7eb',
      borderRadius:10, marginBottom:8, cursor:'pointer', background: sel?'#eff6ff':'white',
    }),
    avatar: (name: string) => ({ width:36, height:36, borderRadius:'50%', background:'#e0e7ff', display:'flex', alignItems:'center' as const, justifyContent:'center', fontSize:12, fontWeight:700, color:'#3730a3', flexShrink:0 }),
    check: (sel: boolean) => ({ width:22, height:22, borderRadius:'50%', border:`1.5px solid ${sel?'#1e3a8a':'#d1d5db'}`, background:sel?'#1e3a8a':'transparent', display:'flex', alignItems:'center' as const, justifyContent:'center', flexShrink:0 }),
    bottomBar: { padding:'14px 16px', background:'white', borderTop:'1px solid #e5e7eb' },
    btn: { width:'100%', padding:'14px', borderRadius:12, border:'none', background:'#1e3a8a', color:'white', fontSize:16, fontWeight:700, cursor:'pointer' },
    btnSec: { width:'100%', padding:'12px', borderRadius:12, border:'1.5px solid #e5e7eb', background:'white', color:'#374151', fontSize:14, fontWeight:600, cursor:'pointer', marginTop:10 },
    confirmRow: { display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f3f4f6' },
    sectionHead: { fontSize:11, fontWeight:700, color:'#6b7280', letterSpacing:'0.06em', margin:'20px 0 8px', textTransform:'uppercase' as const },
  }

  // Se não selecionou obra ainda, mostra seleção de obra primeiro
  if (!obraSel) {
    return (
      <div style={S.container}>
        <div style={S.topbar}>
          <div>
            <div style={S.title}>MG Campo</div>
            <div style={S.sub}>Olá, {perfil?.nome?.split(' ')[0] || 'Encarregado'}</div>
          </div>
        </div>
        <div style={S.content}>
          <div style={S.bigLabel}>Selecione a obra</div>
          <div style={{ fontSize:14, color:'#6b7280', marginBottom:20 }}>
            {new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}
          </div>
          <div style={S.fieldLabel}>Data do lançamento</div>
          <input type="date" value={estado.data} onChange={e => setEstado(s => ({...s, data:e.target.value}))}
            style={{...S.input, marginBottom:20}} />
          <div style={S.fieldLabel}>Obra</div>
          {obras.map(o => (
            <div key={o.id} onClick={() => selecionarObra(o)}
              style={{ padding:'14px 16px', border:'1px solid #e5e7eb', borderRadius:12, marginBottom:10, cursor:'pointer', background:'white', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🏗</div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:'#1f2937' }}>{o.nome}</div>
                <div style={{ fontSize:12, color:'#6b7280' }}>{o.codigo}</div>
              </div>
              <div style={{ marginLeft:'auto', color:'#9ca3af', fontSize:20 }}>›</div>
            </div>
          ))}
        </div>
        <div style={S.bottomBar}>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/campo'))}
            style={{...S.btnSec, color:'#dc2626', borderColor:'#fecaca'}}>Sair da conta</button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.container}>
      {/* TOPBAR */}
      <div style={S.topbar}>
        {tela !== 'pergunta_obra' && tela !== 'sucesso' && (
          <button style={S.back} onClick={() => {
            if (tela==='detalhes_obra') setTela('pergunta_obra')
            else if (tela==='pergunta_mg') setTela(estado.teveObra?'detalhes_obra':'pergunta_obra')
            else if (tela==='detalhes_mg') setTela('pergunta_mg')
            else if (tela==='confirmacao') setTela(estado.teveMG?'detalhes_mg':'pergunta_mg')
          }}>←</button>
        )}
        <div style={{ flex:1 }}>
          <div style={S.title}>{obraSel.nome}</div>
          <div style={S.sub}>{new Date(estado.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'})}</div>
        </div>
      </div>

      {/* PROGRESS */}
      {tela !== 'sucesso' && (
        <div style={S.progress}>
          {Array.from({length:total}).map((_,i) => (
            <div key={i} style={S.dot(i+1 < atual, i+1 === atual)} />
          ))}
        </div>
      )}

      {/* TELA 1: CONTA OBRA? */}
      {tela === 'pergunta_obra' && (
        <>
          <div style={S.content}>
            <div style={S.bigLabel}>Teve diária por conta da obra?</div>
            <div style={S.subLabel}>Serviço extra solicitado pelo cliente/obra</div>
            <div style={S.yesno}>
              <div style={S.yn(estado.teveObra===true,'sim')} onClick={() => setEstado(e => ({...e,teveObra:true}))}>
                ✅<span style={S.ynLabel}>Sim</span>
              </div>
              <div style={S.yn(estado.teveObra===false,'nao')} onClick={() => setEstado(e => ({...e,teveObra:false}))}>
                ❌<span style={S.ynLabel}>Não</span>
              </div>
            </div>
          </div>
          <div style={S.bottomBar}>
            <button style={{...S.btn, opacity:estado.teveObra===null?.4:1}} disabled={estado.teveObra===null}
              onClick={() => setTela(estado.teveObra?'detalhes_obra':'pergunta_mg')}>
              Continuar →
            </button>
          </div>
        </>
      )}

      {/* TELA 2: DETALHES OBRA */}
      {tela === 'detalhes_obra' && (
        <>
          <div style={S.content}>
            <div style={S.bigLabel}>Detalhes — Conta Obra</div>
            <div style={S.fieldLabel}>Quem solicitou?</div>
            <input style={S.input} value={estado.solicitadoPor} onChange={e => setEstado(s => ({...s,solicitadoPor:e.target.value}))} placeholder="Nome do responsável..." />
            <div style={S.fieldLabel}>Horário de realização</div>
            <input type="time" style={S.input} value={estado.horarioObra} onChange={e => setEstado(s => ({...s,horarioObra:e.target.value}))} />
            <div style={S.fieldLabel}>Serviço executado</div>
            <textarea style={{...S.input, height:80, resize:'none' as const}} value={estado.servicoObra}
              onChange={e => setEstado(s => ({...s,servicoObra:e.target.value}))} placeholder="Descreva o serviço..." />
            <div style={S.fieldLabel}>Funcionários ({estado.funcsObra.length} selecionados)</div>
            {funcs.map(f => {
              const sel = estado.funcsObra.includes(f.id)
              const ini = f.nome.split(' ').slice(0,2).map((n:string)=>n[0]).join('')
              return (
                <div key={f.id} style={S.funcCard(sel)} onClick={() => toggleFunc(f.id,'obra')}>
                  <div style={S.avatar(f.nome)}>{ini}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:'#1f2937' }}>{f.nome.split(' ').slice(0,3).join(' ')}</div>
                    <div style={{ fontSize:12, color:'#6b7280' }}>{f.equipe}</div>
                  </div>
                  <div style={S.check(sel)}>
                    {sel && <div style={{ width:8, height:8, borderRadius:'50%', background:'white' }} />}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={S.bottomBar}>
            <button style={{...S.btn, opacity:!estado.solicitadoPor||!estado.horarioObra||!estado.servicoObra||!estado.funcsObra.length?.4:1}}
              disabled={!estado.solicitadoPor||!estado.horarioObra||!estado.servicoObra||!estado.funcsObra.length}
              onClick={() => setTela('pergunta_mg')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA 3: CONTA MG? */}
      {tela === 'pergunta_mg' && (
        <>
          <div style={S.content}>
            <div style={S.bigLabel}>Teve diária por conta da MG?</div>
            <div style={S.subLabel}>Serviço extra solicitado pela MG Construções</div>
            <div style={S.yesno}>
              <div style={S.yn(estado.teveMG===true,'sim')} onClick={() => setEstado(e => ({...e,teveMG:true}))}>
                ✅<span style={S.ynLabel}>Sim</span>
              </div>
              <div style={S.yn(estado.teveMG===false,'nao')} onClick={() => setEstado(e => ({...e,teveMG:false}))}>
                ❌<span style={S.ynLabel}>Não</span>
              </div>
            </div>
          </div>
          <div style={S.bottomBar}>
            <button style={{...S.btn, opacity:estado.teveMG===null?.4:1}} disabled={estado.teveMG===null}
              onClick={() => setTela(estado.teveMG?'detalhes_mg':'confirmacao')}>
              Continuar →
            </button>
          </div>
        </>
      )}

      {/* TELA 4: DETALHES MG */}
      {tela === 'detalhes_mg' && (
        <>
          <div style={S.content}>
            <div style={S.bigLabel}>Detalhes — Conta MG</div>
            <div style={S.fieldLabel}>Horário de realização</div>
            <input type="time" style={S.input} value={estado.horarioMG} onChange={e => setEstado(s => ({...s,horarioMG:e.target.value}))} />
            <div style={S.fieldLabel}>Serviço executado</div>
            <textarea style={{...S.input, height:80, resize:'none' as const}} value={estado.servicoMG}
              onChange={e => setEstado(s => ({...s,servicoMG:e.target.value}))} placeholder="Descreva o serviço..." />
            <div style={S.fieldLabel}>Funcionários ({estado.funcsMG.length} selecionados)</div>
            {funcs.map(f => {
              const sel = estado.funcsMG.includes(f.id)
              const ini = f.nome.split(' ').slice(0,2).map((n:string)=>n[0]).join('')
              return (
                <div key={f.id} style={S.funcCard(sel)} onClick={() => toggleFunc(f.id,'mg')}>
                  <div style={S.avatar(f.nome)}>{ini}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:'#1f2937' }}>{f.nome.split(' ').slice(0,3).join(' ')}</div>
                    <div style={{ fontSize:12, color:'#6b7280' }}>{f.equipe}</div>
                  </div>
                  <div style={S.check(sel)}>
                    {sel && <div style={{ width:8, height:8, borderRadius:'50%', background:'white' }} />}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={S.bottomBar}>
            <button style={{...S.btn, opacity:!estado.horarioMG||!estado.servicoMG||!estado.funcsMG.length?.4:1}}
              disabled={!estado.horarioMG||!estado.servicoMG||!estado.funcsMG.length}
              onClick={() => setTela('confirmacao')}>Continuar →</button>
          </div>
        </>
      )}

      {/* TELA 5: CONFIRMAÇÃO */}
      {tela === 'confirmacao' && (
        <>
          <div style={S.content}>
            <div style={S.bigLabel}>Confirmar lançamento</div>
            <div style={{ fontSize:14, color:'#6b7280', marginBottom:16 }}>Revise os dados antes de salvar</div>

            <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 16px' }}>
              <div style={S.confirmRow}>
                <span style={{ fontSize:13, color:'#6b7280' }}>Obra</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#1f2937' }}>{obraSel.nome}</span>
              </div>
              <div style={S.confirmRow}>
                <span style={{ fontSize:13, color:'#6b7280' }}>Data</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{new Date(estado.data+'T12:00').toLocaleDateString('pt-BR')}</span>
              </div>

              {estado.teveObra && (
                <>
                  <div style={S.sectionHead}>Conta Obra</div>
                  <div style={S.confirmRow}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Solicitado por</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{estado.solicitadoPor}</span>
                  </div>
                  <div style={S.confirmRow}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Horário</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{estado.horarioObra}</span>
                  </div>
                  <div style={S.confirmRow}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Serviço</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937', maxWidth:180, textAlign:'right' }}>{estado.servicoObra}</span>
                  </div>
                  <div style={{...S.confirmRow, borderBottom:'none'}}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Funcionários</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937', maxWidth:180, textAlign:'right' }}>
                      {estado.funcsObra.length} selecionados
                    </span>
                  </div>
                </>
              )}

              {estado.teveMG && (
                <>
                  <div style={S.sectionHead}>Conta MG</div>
                  <div style={S.confirmRow}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Horário</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{estado.horarioMG}</span>
                  </div>
                  <div style={S.confirmRow}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Serviço</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937', maxWidth:180, textAlign:'right' }}>{estado.servicoMG}</span>
                  </div>
                  <div style={{...S.confirmRow, borderBottom:'none'}}>
                    <span style={{ fontSize:13, color:'#6b7280' }}>Funcionários</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#1f2937' }}>{estado.funcsMG.length} selecionados</span>
                  </div>
                </>
              )}

              {!estado.teveObra && !estado.teveMG && (
                <div style={{ padding:'16px 0', textAlign:'center', color:'#6b7280', fontSize:14 }}>
                  Nenhuma diária extra registrada hoje.
                </div>
              )}
            </div>

            <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'12px 14px', marginTop:16, fontSize:12, color:'#92400e' }}>
              Após confirmar, os dados aparecem em tempo real no sistema principal.
            </div>
          </div>
          <div style={S.bottomBar}>
            <button style={{...S.btn, opacity:salvando?.7:1}} disabled={salvando} onClick={salvar}>
              {salvando ? 'Salvando...' : '✓ Confirmar e salvar'}
            </button>
            <button style={S.btnSec} onClick={() => setTela('pergunta_obra')}>Voltar e editar</button>
          </div>
        </>
      )}

      {/* TELA 6: SUCESSO */}
      {tela === 'sucesso' && (
        <div style={{...S.content, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', paddingTop:60}}>
          <div style={{ width:80, height:80, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, marginBottom:20 }}>✅</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#1f2937', marginBottom:8 }}>Salvo!</div>
          <div style={{ fontSize:15, color:'#6b7280', marginBottom:40 }}>As diárias foram registradas no sistema em tempo real.</div>
          <button style={{...S.btn, maxWidth:280}} onClick={novo}>Novo lançamento</button>
          <button style={{...S.btnSec, maxWidth:280}} onClick={() => setObraSel(null)}>Trocar de obra</button>
        </div>
      )}
    </div>
  )
}
