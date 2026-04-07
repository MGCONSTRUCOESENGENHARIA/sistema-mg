import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, funcionarios } = await req.json()

    // 1. Baixar a imagem e converter para Base64
    const imgResp = await fetch(imageUrl)
    if (!imgResp.ok) throw new Error('Erro ao baixar imagem: ' + imgResp.status)
    
    const imgBuffer = await imgResp.arrayBuffer()
    const base64 = Buffer.from(imgBuffer).toString('base64')
    const contentType = imgResp.headers.get('content-type') || 'image/jpeg'

    const nomesFuncs = funcionarios.join('\n')

    // 2. Prompt otimizado para extração de dados
    const prompt = `Você é um sistema especialista em OCR para construção civil. 
Analise a folha de ponto e extraia as informações comparando os nomes manuscritos com a lista oficial abaixo.

LISTA OFICIAL DE FUNCIONÁRIOS:
${nomesFuncs}

INSTRUÇÕES:
- presentes: nomes na seção PRESENÇA.
- diarias_obra: nomes em DIÁRIAS POR CONTA DA OBRA (apenas se marcado SIM).
- diarias_mg: nomes em DIÁRIAS POR CONTA DA MG (apenas se marcado SIM).
- faltas: nomes na seção FALTAS.
- Se um nome estiver difícil de ler, use a LISTA OFICIAL para deduzir o nome correto.
- Retorne os dados seguindo estritamente a estrutura JSON solicitada.`

    const apiKey = process.env.GEMINI_API_KEY
    
    // 3. Chamada para a API usando v1beta (essencial para o Flash 1.5)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
            // Força a resposta a ser um JSON válido, sem textos explicativos ou markdown
            response_mime_type: "application/json" 
          }
        })
      }
    )

    // 4. Tratamento de erro da requisição
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Erro Gemini (${response.status}): ${errText}`)
    }

    const data = await response.json()
    
    // 5. Extração direta (com response_mime_type, não precisa de Regex)
    const textoSaida = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!textoSaida) {
      throw new Error('A IA não conseguiu gerar uma resposta para esta imagem.')
    }

    const resultado = JSON.parse(textoSaida)

    return NextResponse.json({
