// Chamadas à API do Google Gemini (plano gratuito). A chave vem do secret GEMINI_API_KEY.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
export const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash'
// Modelos reserva, tentados em ordem quando o principal está sobrecarregado (503/429).
// A Vaccine faz o mesmo com OpenRouter quando a Anthropic falha.
export const GEMINI_FALLBACK_MODELS = (Deno.env.get('GEMINI_FALLBACK_MODELS') ?? 'gemini-3.6-flash,gemini-3.5-flash-lite')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)
// A edge function morre em 150s; cada chamada ao Gemini tem no máximo 30s.
const REQUEST_TIMEOUT_MS = 30_000
export const EMBEDDING_MODEL = 'gemini-embedding-001'
export const EMBEDDING_DIMENSIONS = 768 // igual à coluna documents.embedding

class GeminiError extends Error {
  constructor(message: string, readonly temporary: boolean) {
    super(message)
  }
}

async function post(path: string, body: unknown, attempts = 3): Promise<any> {
  if (!GEMINI_API_KEY) throw new Error('Secret GEMINI_API_KEY não configurado')

  let lastError = ''
  let temporary = false
  // 429 (limite do plano gratuito) e 5xx são temporários: tenta de novo com espera crescente.
  for (let attempt = 0; attempt < attempts; attempt++) {
    let res: Response
    try {
      res = await fetch(`${BASE_URL}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (e) {
      // Modelo travado: conta como temporário para cair no próximo.
      lastError = `Gemini sem resposta em ${REQUEST_TIMEOUT_MS / 1000}s (${e})`
      temporary = true
      continue
    }
    if (res.ok) return await res.json()

    lastError = `Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`
    temporary = res.status === 429 || res.status >= 500
    if (!temporary) break
    if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
  }
  throw new GeminiError(lastError, temporary)
}

// Tenta cada modelo da lista; passa para o próximo só se o erro for temporário.
// Devolve também qual modelo respondeu, para a conversa continuar nele.
export async function generateContent(body: unknown, models: string[]): Promise<{ data: any; model: string }> {
  let lastError: unknown
  // Com reservas disponíveis, 1 tentativa por modelo; com um modelo só, 2.
  const attempts = models.length > 1 ? 1 : 2
  for (const model of models) {
    try {
      return { data: await post(`${model}:generateContent`, body, attempts), model }
    } catch (e) {
      lastError = e
      if (!(e instanceof GeminiError && e.temporary)) throw e
      console.warn(`[gemini] ${model} indisponível, tentando o próximo modelo`)
    }
  }
  throw lastError
}

// Lista os modelos que a chave pode usar para gerar texto (diagnóstico).
export async function listModels(): Promise<string[]> {
  if (!GEMINI_API_KEY) throw new Error('Secret GEMINI_API_KEY não configurado')
  const res = await fetch(`${BASE_URL}?pageSize=200`, { headers: { 'x-goog-api-key': GEMINI_API_KEY } })
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return (data.models ?? [])
    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: any) => m.name.replace('models/', ''))
}

export async function embed(text: string, taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
  const data = await post(`${EMBEDDING_MODEL}:embedContent`, {
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: EMBEDDING_DIMENSIONS,
  })
  return data.embedding.values
}
