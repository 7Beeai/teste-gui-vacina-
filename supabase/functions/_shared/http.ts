// Resposta JSON, CORS (para a página de chat de teste) e checagem do token de acesso.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// As funções são publicadas com verify_jwt = false (como a Vaccine FB) e protegidas por um
// token próprio no header x-api-key, guardado no secret AI_AGENT_TOKEN.
// Sem o secret configurado, a função recusa tudo.
export function unauthorized(req: Request): Response | null {
  const expected = Deno.env.get('AI_AGENT_TOKEN')
  if (!expected) return json({ error: 'Secret AI_AGENT_TOKEN não configurado' }, 500)
  if (req.headers.get('x-api-key') !== expected) return json({ error: 'Não autorizado' }, 401)
  return null
}
