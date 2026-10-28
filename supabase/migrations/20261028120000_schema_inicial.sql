-- Schema inicial do projeto de teste, espelhando o banco da Vivi (Vaccine 2.0).
-- Mesmos nomes de tabela e coluna do original, com três ajustes de aprendizado:
--   * nomes sem espaço (`whatsapp_users`, não `"whatsapp users"`);
--   * preço também em centavos (valor_pix / valor_credito), derivado do texto por trigger;
--   * RLS ligada em todas as tabelas desde o início.
-- Tudo é lido e escrito pela edge function com a service_role; anon/authenticated não
-- acessam nada até existir login da equipe.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Extrai um preço em centavos do texto livre do catálogo.
-- Ex.: 'R$ 380,00 no PIX ou R$ 400,00 no crédito' -> pix 38000, credito 40000.
-- Se o texto tiver um único preço sem forma de pagamento, ele vale para as duas.
create or replace function public.vaccine_preco_centavos(texto text, forma text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  parte text;
  achado text;
  unico text;
  qtd int := 0;
  padrao_forma text := case forma
    when 'pix' then '(pix|vista|dinheiro)'
    when 'credito' then '(cr[eé]dito|cart[aã]o)'
  end;
begin
  if texto is null or padrao_forma is null then
    return null;
  end if;

  foreach parte in array regexp_split_to_array(texto, '\s+ou\s+|;|\n') loop
    achado := substring(parte from 'R\$\s*([0-9.]+,[0-9]{2})');
    if achado is not null then
      qtd := qtd + 1;
      unico := achado;
      if parte ~* padrao_forma then
        return (replace(replace(achado, '.', ''), ',', '.')::numeric * 100)::int;
      end if;
    end if;
  end loop;

  if qtd = 1 then
    return (replace(replace(unico, '.', ''), ',', '.')::numeric * 100)::int;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catálogo (na Vaccine vem do Google Sheets; aqui é editado direto no banco)
-- ---------------------------------------------------------------------------

create table public.vacinas_catalogo (
  id integer primary key,
  idade text not null,
  nome text not null,
  protecao text,
  doencas_prevenidas text,
  publico_alvo text,
  dose text,
  esquema_vacinal text,
  disponibilidade text not null default 'Disponível',
  valor text,
  valor_pix integer,
  valor_credito integer,
  observacoes_ia text,
  via_administracao text,
  contraindicacoes text,
  reacoes_comuns text,
  atualizacao_fonte text,
  updated_at timestamptz not null default now()
);

create index vacinas_catalogo_nome_idx on public.vacinas_catalogo (nome);
create index vacinas_catalogo_idade_idx on public.vacinas_catalogo (idade);
create index vacinas_catalogo_nome_trgm_idx on public.vacinas_catalogo
  using gin (nome extensions.gin_trgm_ops);

create or replace function public.vaccine_valor_norm()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.valor_pix := public.vaccine_preco_centavos(new.valor, 'pix');
  new.valor_credito := public.vaccine_preco_centavos(new.valor, 'credito');
  return new;
end;
$$;

create trigger trg_vaccine_valor_norm
  before insert or update of valor on public.vacinas_catalogo
  for each row execute function public.vaccine_valor_norm();

create trigger trg_vacinas_catalogo_updated_at
  before update on public.vacinas_catalogo
  for each row execute function public.set_updated_at();

create table public.medicamentos_catalogo (
  id integer primary key,
  nome text not null,
  protecao text,
  doses text,
  valor text,
  observacao text,
  updated_at timestamptz not null default now()
);

create table public.planos_vacinais (
  id integer primary key,
  nome text not null,
  faixa_etaria text,
  valores text,
  vacinas_2m text,
  vacinas_3m text,
  vacinas_4m text,
  vacinas_5m text,
  vacinas_6m text,
  vacinas_9m text,
  vacinas_12m text,
  vacinas_15m text,
  vacinas_18m text,
  esquema_especial text,
  resumo text,
  observacao text,
  observacoes_internas text,
  updated_at timestamptz not null default now()
);

create table public.produtos_catalogo (
  id serial primary key,
  nome text not null,
  valor text,
  observacao text,
  updated_at timestamptz not null default now()
);

create table public.esquemas_vacinais (
  id serial primary key,
  vacina_nome text not null,
  faixa_etaria text,
  esquema text,
  doses integer,
  intervalo_doses text,
  reforco text,
  observacao text,
  updated_at timestamptz not null default now()
);

create table public.horarios_funcionamento (
  id serial primary key,
  unidade text not null,
  dia_semana smallint not null check (dia_semana between 0 and 6), -- 0 = domingo
  aberto boolean not null default true,
  hora_abertura time,
  hora_fechamento time,
  intervalo_inicio time,
  intervalo_fim time,
  observacao text,
  unique (unidade, dia_semana)
);

create table public.feriados (
  id serial primary key,
  data date not null,
  descricao text not null,
  unidade text not null default 'todas',
  aberto boolean not null default false,
  hora_abertura time,
  hora_fechamento time,
  unique (unidade, data)
);

create table public.homecare_taxas (
  id serial primary key,
  bairro text not null unique,
  taxa numeric(6, 2) not null,
  regiao text,
  created_at timestamptz not null default now()
);

create table public.negotiation_rules (
  id serial primary key,
  situacao text not null unique,
  gatilho text not null,
  desconto text,
  resposta_modelo text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

-- FAQ com busca por significado. Gemini gemini-embedding-001 com 768 dimensões
-- (na Vaccine é OpenAI text-embedding-3-small, 1536).
create table public.documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(768),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Agente, conversa e operação
-- ---------------------------------------------------------------------------

-- Prompt vivo do agente (a Vaccine guarda aqui também, linha name = 'viviane_2.0').
create table public.agents (
  id serial primary key,
  name text not null unique,
  prompt text not null,
  updated_at timestamptz not null default now()
);

create trigger trg_agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

create table public.whatsapp_users (
  contact_id text primary key,
  nome text,
  status text not null default 'Ativo',
  last_interaction timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_chat_history (
  id bigserial primary key,
  contact_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index ai_chat_history_contact_idx on public.ai_chat_history (contact_id, created_at desc);

-- Um processamento por contato por vez; o lock expira sozinho.
create table public.processing_locks (
  contact_id text primary key,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 seconds'
);

-- Mensagens que chegam enquanto o contato está com lock ocupado.
create table public.pending_messages (
  id bigserial primary key,
  contact_id text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.message_log (
  id bigserial primary key,
  contact_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  status text not null check (status in ('processing', 'responded', 'failed', 'timeout')),
  processing_time_ms integer,
  tokens_used integer,
  error_message text,
  created_at timestamptz not null default now()
);

-- Substitui a transferência de ticket no Digisac (tool repassa_atendente):
-- a equipe vê aqui os atendimentos que a IA passou para humano.
create table public.repasses_atendente (
  id bigserial primary key,
  contact_id text not null,
  motivo text not null,
  status text not null default 'pendente' check (status in ('pendente', 'em_atendimento', 'concluido')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RPCs usadas pelas tools
-- ---------------------------------------------------------------------------

create or replace function public.busca_bairro_homecare(bairro_busca text)
returns setof public.homecare_taxas
language sql
stable
set search_path = ''
as $$
  select *
  from public.homecare_taxas
  where extensions.unaccent(bairro) ilike '%' || extensions.unaccent(bairro_busca) || '%'
  order by length(bairro)
  limit 5;
$$;

create or replace function public.match_documents(
  query_embedding extensions.vector(768),
  match_count integer default 5,
  filter jsonb default '{}'::jsonb
)
returns table (id bigint, content text, metadata jsonb, similarity double precision)
language sql
stable
set search_path = ''
as $$
  select d.id, d.content, d.metadata,
         1 - (d.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.documents d
  where d.embedding is not null
    and d.metadata @> filter
  order by d.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- Segurança: RLS em tudo, sem policies (só a service_role acessa).
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'vacinas_catalogo', 'medicamentos_catalogo', 'planos_vacinais', 'produtos_catalogo',
    'esquemas_vacinais', 'horarios_funcionamento', 'feriados', 'homecare_taxas',
    'negotiation_rules', 'documents', 'agents', 'whatsapp_users', 'ai_chat_history',
    'processing_locks', 'pending_messages', 'message_log', 'repasses_atendente'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end;
$$;

revoke execute on function public.busca_bairro_homecare(text) from public, anon, authenticated;
revoke execute on function public.match_documents(extensions.vector, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.vaccine_preco_centavos(text, text) from public, anon, authenticated;
grant execute on function public.busca_bairro_homecare(text) to service_role;
grant execute on function public.match_documents(extensions.vector, integer, jsonb) to service_role;
