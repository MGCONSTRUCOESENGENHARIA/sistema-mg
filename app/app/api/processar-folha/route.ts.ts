import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, funcionarios } = await req.json()

    const imgResp = await fetch(imageUrl)
    if (!imgResp.ok) throw new Error('Erro ao baixar imagem')
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
  "diarias_obra": [{"nome": "nome", "servico": "serviço executado"}],
  "diarias_mg": [{"nome": "nome", "servico": "serviço executado"}],
  "faltas": [{"nome": "nome"}]
}

Instruções:
- presentes = funcionários listados na seção PRESENÇA
- diarias_obra = funcionários em DIÁRIAS POR CONTA DA OBRA quando SIM marcado
- diarias_mg = funcionários em DIÁRIAS POR CONTA DA MG quando SIM marcado
- faltas = funcionários na seção FALTAS
- Tente ler a caligrafia mesmo difícil
- Retorne APENAS o JSON puro, sem markdown`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
        'HTTP-Referer': 'https://sistema-mg.vercel.app',
        'X-Title': 'MG Construcoes',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-opus-4',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${contentType};base64,${base64}` }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error('Erro OpenRouter: ' + err)
    }

    const data = await response.json()
    const texto = data.choices?.[0]?.message?.content || ''
    const jsonMatch = texto.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('IA não retornou JSON válido: ' + texto.slice(0, 200))

    const resultado = JSON.parse(jsonMatch[0])
    return NextResponse.json({ ok: true, resultado })

  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}
