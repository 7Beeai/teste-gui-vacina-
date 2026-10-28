// embed-faq: gera o embedding das linhas de `documents` que ainda não têm.
// Faz o papel dos workflows n8n "Embedding Vetores" da Vaccine.
// Rode de novo sempre que inserir ou editar uma pergunta da FAQ (zere o embedding da linha editada).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { embed } from '../_shared/gemini.ts'
import { corsHeaders, json, unauthorized } from '../_shared/http.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const denied = unauthorized(req)
  if (denied) return denied

  const { data: docs, error } = await supabase.from('documents').select('id, content').is('embedding', null).limit(50)
  if (error) return json({ error: error.message }, 500)

  const falhas: { id: number; erro: string }[] = []
  for (const doc of docs ?? []) {
    try {
      const values = await embed(doc.content, 'RETRIEVAL_DOCUMENT')
      const { error: upd } = await supabase.from('documents').update({ embedding: JSON.stringify(values) }).eq('id', doc.id)
      if (upd) throw upd
    } catch (e) {
      falhas.push({ id: doc.id, erro: String(e).slice(0, 200) })
    }
  }

  return json({ processados: (docs?.length ?? 0) - falhas.length, falhas })
})
