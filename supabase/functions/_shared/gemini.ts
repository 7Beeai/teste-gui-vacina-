// Chamadas à API do Google Gemini (plano gratuito). A chave vem do secret GEMINI_API_KEY.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
export const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'
export const EMBEDDING_MODEL = 'gemini-embedding-001'
export const EMBEDDING_DIMENSIONS = 768 // igual à coluna documents.embedding

async function post(path: string, body: unknown): Promise<any> {
  if (!GEMINI_API_KEY) throw new Error('Secret GEMINI_API_KEY não configurado')

  let lastError = ''
  // 429 (limite do plano gratuito) e 5xx são temporários: tenta de novo com espera crescente.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE_URL}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify(body),
    })
    if (res.ok) return await res.json()

    lastError = `Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`
    if (res.status !== 429 && res.status < 500) break
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
  }
  throw new Error(lastError)
}

export function generateContent(body: unknown) {
  return post(`${GEMINI_MODEL}:generateContent`, body)
}

export async function embed(text: string, taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
  const data = await post(`${EMBEDDING_MODEL}:embedContent`, {
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: EMBEDDING_DIMENSIONS,
  })
  return data.embedding.values
}
