// ai-agent: a "Vivi" de teste. Versão enxuta da edge function ai-agent da Vaccine 2.0.
//
// Fluxo (igual ao original):
//   1. recebe { message, contactId, userName }
//   2. pega o lock do contato (processing_locks); se ocupado, guarda em pending_messages
//   3. lê o prompt da tabela agents e as últimas mensagens de ai_chat_history
//   4. chama a IA (aqui Gemini; na Vaccine, Claude) com as tools que consultam o catálogo
//   5. grava pergunta e resposta no histórico, atualiza whatsapp_users e message_log
//   6. devolve { reply, toolsUsed, usage }

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { embed, GeminiError, generateContent, GEMINI_FALLBACK_MODELS, GEMINI_MODEL } from '../_shared/gemini.ts'
import { corsHeaders, json, unauthorized } from '../_shared/http.ts'

const AGENT_NAME = Deno.env.get('AGENT_NAME') ?? 'vivi_exemplo'
const UNIDADE = 'Clínica Exemplo - Centro'
const HISTORY_LIMIT = 30
const HISTORY_MAX_AGE_DAYS = 7 // a Vaccine não corta por data e já usou resposta antiga
const MAX_TOOL_ROUNDS = 6
const LOCK_TTL_MS = 60_000
// A função é encerrada em 150s. Depois de 100s não começa outra chamada à IA:
// responde com a mensagem de reserva e libera o lock.
const DEADLINE_MS = 100_000
const FALLBACK_REPLY =
  'Desculpe, tive um problema para responder agora. Já avisei a nossa equipe, que vai continuar o seu atendimento 💜'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// --- Tools (mesmos nomes da Vaccine) ---------------------------------------

const TOOLS = [
  {
    name: 'consulta_vacinas',
    description:
      'Consulta vacinas do catálogo: proteção, esquema, disponibilidade e valores. Use para qualquer pergunta sobre vacina. Pode buscar por nome, por idade ou pelos dois.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nome_vacina: { type: 'STRING', description: 'Nome da vacina, ex.: "Hexa", "Pneumocócica 20", "gripe"' },
        idade: { type: 'STRING', description: 'Idade do paciente, ex.: "2 meses", "Adulto", "50 anos", "Gestação"' },
      },
    },
  },
  {
    name: 'consulta_faq',
    description:
      'Busca respostas para dúvidas gerais: reações, febre, vacinas no mesmo dia, pagamento, agendamento, home care, diferenciais. Não use para preço de vacina.',
    parameters: {
      type: 'OBJECT',
      properties: { pergunta: { type: 'STRING', description: 'A dúvida do cliente' } },
      required: ['pergunta'],
    },
  },
  {
    name: 'repassa_atendente',
    description:
      'Passa o atendimento para a equipe humana. Use para agendar sábado, home care ou infusão, lista de espera de vacina em falta, insatisfação, emergência ou pedido para falar com humano.',
    parameters: {
      type: 'OBJECT',
      properties: { motivo: { type: 'STRING', description: 'Motivo do repasse, ex.: "agendamento home care"' } },
      required: ['motivo'],
    },
  },
  {
    name: 'consulta_medicamentos',
    description: 'Consulta medicamentos e infusões (ferro/Noripurum, vitamina B12, vitamina D). Só após confirmar que há receita.',
    parameters: {
      type: 'OBJECT',
      properties: { nome: { type: 'STRING', description: 'Nome do medicamento' } },
    },
  },
  {
    name: 'consulta_planos_vacinais',
    description: 'Consulta os planos vacinais (pacotes de vacinas) por nome ou idade.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nome_plano: { type: 'STRING', description: 'Ex.: "Atencioso", "Amoroso"' },
      },
    },
  },
  {
    name: 'consulta_taxa_homecare',
    description: 'Consulta a taxa de deslocamento do home care para um bairro.',
    parameters: {
      type: 'OBJECT',
      properties: { bairro: { type: 'STRING' } },
      required: ['bairro'],
    },
  },
  {
    name: 'consulta_produtos',
    description: 'Consulta outros produtos da clínica, como furo de orelha (brinco) e caderneta de vacinação.',
    parameters: {
      type: 'OBJECT',
      properties: { nome: { type: 'STRING' } },
    },
  },
  {
    name: 'consulta_regras_negociacao',
    description: 'Lista as regras de desconto permitidas. Use quando o cliente pedir desconto ou citar preço de concorrente.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'consulta_horarios',
    description: 'Consulta o horário de funcionamento de uma data (considera feriados) ou da semana inteira.',
    parameters: {
      type: 'OBJECT',
      properties: { data: { type: 'STRING', description: 'Data no formato AAAA-MM-DD. Omita para a semana inteira.' } },
    },
  },
]

// Nomes populares -> nome do catálogo (a Vaccine faz o mesmo mapeamento).
const EQUIVALENCIAS: Record<string, string> = {
  gripe: 'Influenza',
  influenza: 'Influenza',
  catapora: 'Varicela',
  pneumo: 'Pneumocócica',
  meningo: 'Meningocócica',
  hexavalente: 'Hexa',
  rotavirus: 'Rotavírus',
  zoster: 'Herpes Zóster',
  cobreiro: 'Herpes Zóster',
  shingrix: 'Herpes Zóster',
  vsr: 'VSR',
  bronquiolite: 'VSR',
  ferro: 'Noripurum',
  b12: 'B12',
}

function normalizaNome(nome: string): string {
  const semAcento = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  for (const [popular, oficial] of Object.entries(EQUIVALENCIAS)) {
    if (semAcento.startsWith(popular)) return semAcento.replace(popular, oficial)
  }
  return nome.trim()
}

type Ctx = { contactId: string }

async function executeTool(name: string, args: Record<string, any>, ctx: Ctx): Promise<unknown> {
  switch (name) {
    case 'consulta_vacinas': {
      let q = supabase
        .from('vacinas_catalogo')
        .select('nome, idade, protecao, publico_alvo, dose, esquema_vacinal, disponibilidade, valor, observacoes_ia, reacoes_comuns')
        .order('id')
      if (args.nome_vacina) q = q.ilike('nome', `%${normalizaNome(args.nome_vacina)}%`)
      if (args.idade && !args.nome_vacina) q = q.ilike('idade', `%${args.idade}%`)
      const { data, error } = await q.limit(15)
      if (error) throw error
      if (!data?.length) return { encontrado: false, aviso: 'Nenhuma vacina encontrada com esse nome. Não invente valores.' }
      return { encontrado: true, idade_informada: args.idade ?? null, vacinas: data }
    }

    case 'consulta_faq': {
      const embedding = await embed(args.pergunta, 'RETRIEVAL_QUERY')
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: JSON.stringify(embedding),
        match_count: 3,
      })
      if (error) throw error
      return { resultados: (data ?? []).map((d: any) => ({ conteudo: d.content, similaridade: d.similarity })) }
    }

    case 'repassa_atendente': {
      const { error } = await supabase.from('repasses_atendente').insert({ contact_id: ctx.contactId, motivo: args.motivo })
      if (error) throw error
      return { ok: true, mensagem: 'Atendimento registrado para a equipe, que vai continuar a conversa.' }
    }

    case 'consulta_medicamentos': {
      let q = supabase.from('medicamentos_catalogo').select('nome, protecao, doses, valor, observacao')
      if (args.nome) q = q.ilike('nome', `%${normalizaNome(args.nome)}%`)
      const { data, error } = await q
      if (error) throw error
      return { medicamentos: data }
    }

    case 'consulta_planos_vacinais': {
      let q = supabase.from('planos_vacinais').select('*').order('id')
      if (args.nome_plano) q = q.ilike('nome', `%${args.nome_plano}%`)
      const { data, error } = await q
      if (error) throw error
      return { planos: data }
    }

    case 'consulta_taxa_homecare': {
      const { data, error } = await supabase.rpc('busca_bairro_homecare', { bairro_busca: args.bairro })
      if (error) throw error
      if (!data?.length) return { encontrado: false, aviso: 'Bairro fora da lista. Repasse para a equipe confirmar.' }
      return { encontrado: true, bairros: data.map((b: any) => ({ bairro: b.bairro, taxa: b.taxa, regiao: b.regiao })) }
    }

    case 'consulta_produtos': {
      let q = supabase.from('produtos_catalogo').select('nome, valor, observacao')
      if (args.nome) q = q.ilike('nome', `%${args.nome}%`)
      const { data, error } = await q
      if (error) throw error
      return { produtos: data }
    }

    case 'consulta_regras_negociacao': {
      const { data, error } = await supabase
        .from('negotiation_rules')
        .select('situacao, gatilho, desconto, resposta_modelo')
        .eq('ativo', true)
        .order('ordem')
      if (error) throw error
      return { regras: data }
    }

    case 'consulta_horarios': {
      const { data: horarios, error } = await supabase
        .from('horarios_funcionamento')
        .select('dia_semana, aberto, hora_abertura, hora_fechamento, observacao')
        .eq('unidade', UNIDADE)
        .order('dia_semana')
      if (error) throw error
      if (!args.data) return { unidade: UNIDADE, semana: horarios, legenda: '0 = domingo ... 6 = sábado' }

      const diaSemana = new Date(`${args.data}T12:00:00Z`).getUTCDay()
      const { data: feriado } = await supabase
        .from('feriados')
        .select('descricao, aberto, hora_abertura, hora_fechamento')
        .eq('data', args.data)
        .in('unidade', [UNIDADE, 'todas'])
        .maybeSingle()
      return { unidade: UNIDADE, data: args.data, feriado, horario_do_dia: horarios?.find((h) => h.dia_semana === diaSemana) }
    }

    default:
      return { erro: `Tool desconhecida: ${name}` }
  }
}

// --- Lock por contato (mesma lógica da Vaccine) -----------------------------

async function acquireLock(contactId: string): Promise<boolean> {
  await supabase.from('processing_locks').delete().lt('expires_at', new Date().toISOString())
  const { error } = await supabase.from('processing_locks').insert({
    contact_id: contactId,
    expires_at: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
  })
  return !error // insert falha se o contato já tem lock (contact_id é a chave primária)
}

async function touchLock(contactId: string) {
  await supabase
    .from('processing_locks')
    .update({ expires_at: new Date(Date.now() + LOCK_TTL_MS).toISOString() })
    .eq('contact_id', contactId)
}

async function releaseLock(contactId: string) {
  await supabase.from('processing_locks').delete().eq('contact_id', contactId)
}

// Junta à mensagem atual o que chegou enquanto o contato estava ocupado.
async function drainPending(contactId: string): Promise<string[]> {
  const { data } = await supabase
    .from('pending_messages')
    .delete()
    .eq('contact_id', contactId)
    .select('content, created_at')
  return (data ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((m) => m.content)
}

// --- Prompt e histórico -----------------------------------------------------

async function loadPrompt(): Promise<string> {
  const { data, error } = await supabase.from('agents').select('prompt').eq('name', AGENT_NAME).single()
  if (error) throw new Error(`Prompt '${AGENT_NAME}' não encontrado na tabela agents`)
  return data.prompt
}

// A data vai no FIM do prompt: a parte fixa fica igual entre chamadas (lição de cache da Vaccine).
function dataAtual(): string {
  const agora = new Date()
  const extenso = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(agora)
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)
  return `USAR DATA ATUAL OBRIGATÓRIA: ${extenso} (${iso}), horário de Brasília.`
}

async function loadHistory(contactId: string) {
  const desde = new Date(Date.now() - HISTORY_MAX_AGE_DAYS * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('ai_chat_history')
    .select('role, content')
    .eq('contact_id', contactId)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(HISTORY_LIMIT)
  if (error) throw error
  return (data ?? [])
    .reverse()
    .filter((m) => m.content.trim()) // mensagem vazia envenenava o histórico na Vaccine
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
}

// --- Handler ----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const denied = unauthorized(req)
  if (denied) return denied

  let body: { message?: string; contactId?: string; userName?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  const message = body.message?.trim()
  const contactId = body.contactId?.trim()
  if (!message || !contactId) return json({ error: 'Campos obrigatórios: message e contactId' }, 400)

  const inicio = Date.now()

  if (!(await acquireLock(contactId))) {
    await supabase.from('pending_messages').insert({ contact_id: contactId, content: message })
    return json({ reply: null, queued: true, info: 'Contato em processamento; mensagem guardada em pending_messages.' }, 202)
  }

  const toolsUsed: string[] = []
  let tokens = 0
  let modelUsed = ''
  try {
    await supabase.from('whatsapp_users').upsert({
      contact_id: contactId,
      nome: body.userName ?? null,
      last_interaction: new Date().toISOString(),
    })

    const pendentes = await drainPending(contactId)
    const userText = [...pendentes, message].join('\n')

    const [prompt, history] = await Promise.all([loadPrompt(), loadHistory(contactId)])
    const baseContents: any[] = [...history, { role: 'user', parts: [{ text: userText }] }]
    let contents: any[] = [...baseContents]
    const systemInstruction = {
      parts: [{ text: `${prompt}\n\n${body.userName ? `Nome do contato no WhatsApp: ${body.userName}\n` : ''}${dataAtual()}` }],
    }
    const request = () => ({
      systemInstruction,
      contents,
      tools: [{ functionDeclarations: TOOLS }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    })
    // Resultados das tools desta mensagem, para recomeçar em outro modelo se preciso.
    const toolLog: { tool: string; args: unknown; result: unknown }[] = []

    let reply = ''
    const allModels = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]
    // Depois que um modelo responde, a conversa fica nele: o turno devolvido carrega
    // assinaturas internas que só o mesmo modelo aceita.
    let models = allModels
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (Date.now() - inicio > DEADLINE_MS) {
        console.warn(`[ai-agent] prazo de ${DEADLINE_MS / 1000}s atingido na rodada ${round}`)
        break
      }
      let result: { data: any; model: string }
      try {
        result = await generateContent(request(), models)
      } catch (e) {
        // O modelo travou no meio da resposta. Recomeça em um modelo reserva, passando os
        // resultados das tools já consultadas como texto (sem as assinaturas do modelo anterior).
        const reservas = allModels.filter((m) => !models.includes(m))
        if (!(e instanceof GeminiError && e.temporary) || !toolLog.length || !reservas.length) throw e
        console.warn(`[ai-agent] ${models[0]} travou na rodada ${round}; recomeçando em ${reservas.join(', ')}`)
        contents = [
          ...baseContents,
          {
            role: 'user',
            parts: [{
              text: `[Sistema] Consultas já feitas para esta mensagem (use estes resultados; não repita as mesmas consultas):\n${JSON.stringify(toolLog)}`,
            }],
          },
        ]
        result = await generateContent(request(), reservas)
      }
      const { data, model } = result
      models = [model]
      modelUsed = model
      tokens += data.usageMetadata?.totalTokenCount ?? 0

      const content = data.candidates?.[0]?.content
      const parts: any[] = content?.parts ?? []
      const calls = parts.filter((p) => p.functionCall)

      if (!calls.length) {
        reply = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim()
        break
      }

      // Devolve o turno do modelo inteiro (com as assinaturas internas) e as respostas das tools.
      contents.push(content)
      const responses = []
      for (const { functionCall } of calls) {
        toolsUsed.push(functionCall.name)
        let result: unknown
        try {
          result = await executeTool(functionCall.name, functionCall.args ?? {}, { contactId })
        } catch (e) {
          console.error(`[tool] ${functionCall.name} falhou:`, e)
          result = { erro: 'Falha ao consultar. Não invente a informação; repasse para a equipe se necessário.' }
        }
        toolLog.push({ tool: functionCall.name, args: functionCall.args ?? {}, result })
        responses.push({ functionResponse: { name: functionCall.name, response: { result } } })
      }
      contents.push({ role: 'user', parts: responses })
      await touchLock(contactId)
    }

    // Resgate de silêncio: nunca deixar o cliente sem resposta.
    if (!reply) {
      reply = FALLBACK_REPLY
      await supabase.from('repasses_atendente').insert({ contact_id: contactId, motivo: 'IA sem resposta (resgate automático)' })
    }

    await supabase.from('ai_chat_history').insert([
      { contact_id: contactId, role: 'user', content: userText },
      { contact_id: contactId, role: 'assistant', content: reply },
    ])
    await supabase.from('message_log').insert({
      contact_id: contactId,
      direction: 'outbound',
      status: 'responded',
      processing_time_ms: Date.now() - inicio,
      tokens_used: tokens,
    })

    return json({ reply, toolsUsed, usage: { model: modelUsed, tokens } })
  } catch (e) {
    console.error('[ai-agent] erro:', e)
    await supabase.from('message_log').insert({
      contact_id: contactId,
      direction: 'outbound',
      status: 'failed',
      processing_time_ms: Date.now() - inicio,
      tokens_used: tokens,
      error_message: String(e).slice(0, 500),
    })
    return json({ reply: FALLBACK_REPLY, toolsUsed, error: 'Falha interna; veja os logs da função.' }, 500)
  } finally {
    await releaseLock(contactId)
  }
})
