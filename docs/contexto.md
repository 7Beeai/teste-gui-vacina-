# Projeto Vacina (7Bee): contexto para a nova sessão

> Resumo das sessões de configuração (23 a 27/10/2026).
> Este arquivo **não contém credenciais**. Elas ficam só nas variáveis do ambiente do Claude Code.

## 1. Situação atual

| Item | Situação |
|---|---|
| Repositório GitHub | `7Beeai/teste-gui-vacina-`, branch de trabalho `claude/keen-edison-le8mal` |
| Projeto Supabase antigo | `pmbkgswsjwctjxsghsch` (us-east-1): **apagado** (API responde 404) |
| Projeto Supabase novo | `qkbqgxonyaaytizwwbpk`, **São Paulo (sa-east-1)**, `ACTIVE_HEALTHY`, Postgres 17. Confirmado em 27/10/2026 (token enxerga o projeto, `supabase link` ok) |
| Banco de dados | 17 tabelas espelhando a Vaccine, com dados fictícios da "Clínica Exemplo" (migrações `20261028120000` e `20261028120100`, aplicadas pela API) |

### O que já está no repositório
- `package.json` com a CLI do Supabase (`supabase`, v2.122) como dependência de desenvolvimento e os atalhos:
  - `npm run db:link`: `supabase link --project-ref $SUPABASE_PROJECT_REF`
  - `npm run db:push`: `supabase db push` (**não funciona neste ambiente**, ver seção 3)
  - `npm run db:new <nome>`: cria um arquivo de migração novo
- `supabase/config.toml` (gerado por `supabase init`) e `supabase/migrations/` (vazia).
- `.gitignore` ignorando `node_modules/` e `.env*`.

### Variáveis do ambiente (só os nomes)
| Nome | O que é | Onde pegar |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | token **pessoal** da conta (`sbp_...`), **não** é a publishable nem a secret key | Avatar → Account preferences → **Access Tokens** (https://supabase.com/dashboard/account/tokens), na **mesma conta** do projeto novo |
| `SUPABASE_PROJECT_REF` | ref do projeto **novo** | URL do painel: `supabase.com/dashboard/project/<ref>` |
| `SUPABASE_DB_PASSWORD` | senha **nova** do banco do projeto novo | definida na criação do projeto |

Publishable key e secret key **não** vão para o ambiente agora. A publishable só entra quando o app for construído. A secret nunca vai para o app nem para o navegador.

### Rede do ambiente
Liberado: `api.supabase.com`, `*.supabase.co` e os gerenciadores de pacotes (npm).

## 2. Primeira tarefa da nova sessão: verificar as variáveis (sem exibir valores)

1. As três variáveis existem.
2. `SUPABASE_PROJECT_REF` **não** é mais `pmbkgswsjwctjxsghsch`.
3. `GET https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF` responde 200, com `region = sa-east-1` e status `ACTIVE_HEALTHY`.
4. `GET /v1/projects` com o token enxerga o projeto novo. **Na última sessão o token antigo voltou lista vazia** (0 projetos, 0 organizações). Se continuar assim, o token é de outra conta ou ainda é o antigo: gerar um novo na conta do projeto de São Paulo.
5. Rodar `npx supabase link --project-ref "$SUPABASE_PROJECT_REF"` e uma consulta simples de leitura pela API de SQL.
6. Atualizar a seção 1 deste arquivo com o ref novo.

A senha do banco não pode ser testada daqui (sem conexão direta ao Postgres, ver seção 3).

## 3. Limitações técnicas do ambiente

- **Não há conexão direta ao Postgres.** O container não resolve DNS externo e só sai por HTTPS através do proxy. Por isso `supabase db push` e `supabase migration list` falham (`hostname resolving error`). Liberar mais domínios não resolve.
- **Como aplicar migrações:** os arquivos SQL continuam versionados em `supabase/migrations/` e são aplicados pela API de gerenciamento: `POST https://api.supabase.com/v1/projects/{ref}/database/query`, que usa HTTPS e funciona. Registrar cada migração aplicada em `supabase_migrations.schema_migrations` para manter compatibilidade com a CLI.
- **Script pronto:** `./scripts/sql.sh arquivo.sql` (ou `npm run db:sql -- arquivo.sql`) faz essa chamada sem expor o token. Teste de leitura: `./scripts/sql.sh supabase/checks/verificacao.sql`. A permissão fica em `.claude/settings.json` (`Bash(./scripts/sql.sh:*)`).
- **O filtro de permissões da sessão** pode barrar o `curl` para a API de SQL. O Victor precisa aprovar quando aparecer, ou criar uma regra de permissão para esse comando.
- Ao montar JSON com SQL em `curl`, usar um arquivo (`-d @arquivo.json`) com heredoc entre aspas simples, para não quebrar as aspas do SQL.

## 4. Decisões e motivos

- **Ambiente separado do CDT.** O ambiente do CDT bloqueia chamadas diretas a APIs externas e acesso a credenciais.
- **Acesso por código, não pelo conector do claude.ai** (orientação do Victor). O conector do Supabase no claude.ai está ligado a outra organização e não enxerga este projeto.
- **Banco criado por migrações versionadas no repositório**, não pelo editor de tabelas. Auditável e repetível entre dev e prod.
- **Dado de vacinação é dado pessoal sensível de saúde (LGPD).** RLS em toda tabela desde o primeiro dia, trilha de auditoria e o mínimo de dado pessoal.
- **Região São Paulo (sa-east-1).** O primeiro projeto tinha sido criado por engano em us-east-1. Como o banco estava vazio, foi recriado em São Paulo.
- **Supabase Assistant (Data privacy da organização):** manter **Disabled**.

## 5. Pendências

### Segurança
- [ ] Confirmar que o token antigo foi **revogado** e que as variáveis têm os valores **novos** (token, ref e senha do projeto novo).
- [ ] Se a senha antiga (padrão pessoal) for usada em outros serviços, trocar lá também.
- [ ] Nunca colar token, chave ou senha no chat. Sempre nas configurações do ambiente.

### Configuração do Supabase
- [ ] **Plano:** Free serve só pra teste sem dado real. Antes de dado real de paciente, passar pro **Pro** (backup diário, não pausa, permite exigir MFA).
- [ ] **MFA** na própria conta (Account preferences → Security). No Pro, exigir de todos em Organization Settings → Security.
- [ ] **DPA:** Organization Settings → Legal Documents.
- [ ] **Login dos usuários:** Authentication → Sign In / Providers. Só o provedor usado. Se só a equipe cria contas, desligar "Allow new users to sign up".
- [ ] **PITR:** avaliar ao ir pra produção (add-on pago).

## 6. Perguntas ainda sem resposta (definem o desenho do banco)

1. **O que é o produto?** Agendamento, registro de doses aplicadas, carteira de vacinação do paciente, estoque e lotes, campanha?
2. **Quem usa?** Só a equipe da clínica, pacientes também, várias clínicas?
3. **App web, celular ou os dois?** Já há tecnologia escolhida?
4. **Integrações externas?** SI-PNI/RNDS do Ministério da Saúde, WhatsApp, pagamento?

**Respostas (27/10/2026):**
1. Recriar o produto de vacinas que o Victor já tem. *Falta identificar qual é e onde está a referência.*
2. Só a equipe da clínica.
3. Web e celular.
4. WhatsApp e pagamento.

## 6.1 Objetivo real (28/10/2026)

O Guilherme (CS da 7Bee) está aprendendo Supabase montando uma versão de teste do fluxo da Vivi (Vaccine), **sem custo** e **só com dados fictícios** (o repositório é público).

- **IA:** Google Gemini, plano gratuito. A chave está no secret `GEMINI_API_KEY` do Supabase.
- **Canal:** primeiro uma página de chat de teste; depois Telegram ou o número de teste da API oficial do WhatsApp (Meta).
- **Tabelas:** mesmos nomes da Vaccine (`vacinas_catalogo`, `agents`, `ai_chat_history`, `processing_locks`, `documents` etc.). `repasses_atendente` substitui a transferência no Digisac.
- **Aplicar migração:** juntar o arquivo com `begin;`/`commit;` e o insert em `supabase_migrations.schema_migrations`, e rodar com `./scripts/sql.sh`.

## 7. Próximos passos

1. Verificar as variáveis e a conexão (seção 2).
2. Responder as 4 perguntas da seção 6.
3. Escrever a primeira migração (tabelas, RLS e auditoria) em `supabase/migrations/` e aplicar pela API (seção 3).
4. Só depois decidir e construir o app (as telas).

## 8. Explicação simples: o que o Supabase faz

O Supabase é a "cozinha" do sistema; o app é o "salão". Ele entrega pronto:
- **Banco de dados**: pacientes, doses, lotes, agendamentos.
- **Login**: cada pessoa entra com a própria conta.
- **Regras de acesso (RLS)**: quem vê e quem edita o quê.
- **Arquivos (Storage)**: carteirinha, comprovantes em PDF.
- **Funções no servidor**: lembrete de 2ª dose, integrações.

Ele **não tem telas**: o app precisa ser construído à parte, usando o Supabase por trás.
