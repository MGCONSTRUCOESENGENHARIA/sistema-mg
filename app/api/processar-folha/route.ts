import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, funcionarios } = await req.json()

    const imgResp = await fetch(imageUrl)
    if (!imgResp.ok) throw new Error('Erro ao baixar imagem: ' + imgResp.status)
    const imgBuffer = await imgResp.arrayBuffer()
    const base64 = Buffer.from(imgBuffer).toString('base64')
    const contentType = imgResp.headers.get('content-type') || 'image/jpeg'

    const nomesFuncs = funcionarios.join('\n')

    const prompt = `Você é um sistema de leitura de folhas de ponto de construção civil. Analise esta imagem de uma folha de ponto e extraia as informações.

Lista de funcionários cadastrados no sistema:
${nomesFuncs}

Extraia e retorne APENAS um JSON válido com esta estrutura exata:
{
  "data": "DD/MM/AAAA",
  "obra": "nome da obra",
  "presentes": [{"nome": "nome como está na folha"}],
  "diarias_obra": [{"nome": "nome", "servico": "servico executado"}],
  "diarias_mg": [{"nome": "nome", "servico": "servico executado"}],
  "faltas": [{"nome": "nome"}]
}

Instruções:
- presentes = funcionários listados na seção PRESENÇA
- diarias_obra = funcionários em DIÁRIAS POR CONTA DA OBRA quando SIM marcado
- diarias_mg = funcionários em DIÁRIAS POR CONTA DA MG quando SIM marcado
- faltas = funcionários na seção FALTAS
- Tente ler a caligrafia mesmo difícil
- Retorne APENAS o JSON puro sem markdown`

    const apiKey = process.env.GEMINI_API_KEY
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: contentType, data: base64 } },
              { text: prompt }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
        })
      }
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error('Erro Gemini: ' + err)
    }

    const data = await response.json()
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const jsonMatch = texto.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('IA não retornou JSON: ' + texto.slice(0, 200))

    const resultado = JSON.parse(jsonMatch[0])
    return NextResponse.json({ ok: true, resultado })

  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}


export async function GET(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  const data = await resp.json()
  const models = data.models?.map((m: any) => m.name) || []
  return NextResponse.json({ models })
}
