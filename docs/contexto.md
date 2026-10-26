# Projeto Vacina (7Bee): contexto para a nova sessão

> Resumo da conversa de configuração inicial, feita entre 23 e 26/10/2026 numa sessão do CDT.
> Este arquivo **não contém credenciais**. Elas ficam só nas variáveis do ambiente.

## 1. O que já existe

| Item | Situação |
|---|---|
| Organização no Supabase | **"Vacina 7bee teste Gui"**, plano **FREE** (id da org: `weaetxcsfvvpfgcakzch`) |
| Projeto no Supabase | ref **`pmbkgswsjwctjxsghsch`**, URL `https://pmbkgswsjwctjxsghsch.supabase.co` |
| Repositório GitHub | `7Beeai/teste-gui-vacina-` |
| Ambiente do Claude Code | criado com as variáveis abaixo |
| Banco de dados | **vazio**: nenhuma tabela criada ainda |

### Variáveis do ambiente (só os nomes)
| Nome | Conteúdo |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | token pessoal do Supabase (Account preferences → Access Tokens) |
| `SUPABASE_DB_PASSWORD` | senha do banco do projeto |
| `SUPABASE_PROJECT_REF` | `pmbkgswsjwctjxsghsch` |

### Acesso de rede que o ambiente precisa liberar
- `api.supabase.com`
- `pmbkgswsjwctjxsghsch.supabase.co`
- gerenciadores de pacotes (npm), para instalar a CLI do Supabase

## 2. Decisões e motivos

- **Ambiente separado do CDT.** O ambiente do CDT tem uma trava de segurança que bloqueia chamadas diretas a APIs externas e acesso a credenciais. Por isso o projeto de vacina roda num ambiente e num repositório próprios.
- **Acesso por código, não pelo conector do claude.ai** (orientação do Victor). O conector do Supabase no claude.ai está ligado a outra organização e não enxerga este projeto (o teste deu "sem permissão"). Ele também só tem ferramentas de logs e segredos ligadas.
- **Banco criado por migrações versionadas no repositório** (`supabase/migrations`), não clicando no editor de tabelas. Assim fica auditável e repetível entre dev e prod.
- **Dado de vacinação é dado pessoal sensível de saúde (LGPD).** RLS em toda tabela desde o primeiro dia, trilha de auditoria e o mínimo de dado pessoal.
- **Região:** São Paulo (sa-east-1), recomendada pra LGPD e latência. *Confirmar a região em que o projeto foi criado.*
- **Supabase Assistant (Data privacy da organização):** manter **Disabled**, pra não compartilhar estrutura nem dados com IAs de terceiros.

## 3. Pendências

### Segurança (atenção)
- [ ] **Confirmar que o token e a senha do banco foram trocados.** Os primeiros foram colados no chat da sessão anterior e devem ser tratados como vazados. O token antigo precisa ser **revogado** no Supabase e a senha **resetada** (Project Settings → Database → Reset database password). As variáveis do ambiente devem ter os valores **novos**.
- [ ] Se a senha antiga (padrão pessoal) for usada em outros serviços, trocar lá também.
- [ ] Nunca colar token, chave ou senha no chat. Sempre nas configurações do ambiente.

### Configuração do Supabase
- [ ] **Plano:** está no Free. Serve pra teste sem dado real. **Antes de entrar dado real de paciente, passar pro Pro**: backup diário, projeto não pausa por inatividade e permite exigir MFA. Fica no ícone **$ (Billing)** da barra lateral da organização.
- [ ] **MFA:** ativar na própria conta (avatar → Account preferences → Security). Depois, já no Pro, exigir de todos em Organization Settings → **Security**.
- [ ] **DPA (contrato de tratamento de dados):** Organization Settings → **Legal Documents**.
- [ ] **Login dos usuários:** no projeto, Authentication → **Sign In / Providers**. Deixar ligado só o provedor usado. Se só a equipe cria contas, desligar "Allow new users to sign up".
- [ ] **Chaves:** a URL e a chave pública ficam no botão **Connect**, no topo do projeto. A chave secreta (`service_role`/secret) fica em Project Settings → **API Keys**. A secreta nunca vai pro app nem pro navegador.
- [ ] PITR (restaurar o banco num momento exato): avaliar quando for pra produção (add-on pago).

## 4. Perguntas ainda sem resposta (definem o desenho do banco)

1. **O que é o produto?** Agendamento, registro de doses aplicadas, carteira de vacinação do paciente, controle de estoque ou lotes, campanha?
2. **Quem usa?** Só a equipe da clínica, pacientes também, várias clínicas?
3. **App web, celular ou os dois?** Já há tecnologia escolhida? (A tela "Connect" sugere Next.js por padrão, mas nada foi decidido.)
4. **Integrações externas?** SI-PNI/RNDS do Ministério da Saúde, WhatsApp, pagamento?

## 5. Próximos passos na nova sessão

1. Conferir que as variáveis de ambiente existem (sem exibir os valores) e testar a conexão com o projeto.
2. No repositório: `npx supabase init` e `npx supabase link --project-ref "$SUPABASE_PROJECT_REF"` (a CLI lê `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` do ambiente).
3. Responder as 4 perguntas da seção 4.
4. Criar o primeiro rascunho do banco como migração: tabelas, RLS e auditoria. Aplicar com `npx supabase db push`.
5. Só depois disso, decidir e construir o app (as telas).

## 6. Explicação simples: o que o Supabase faz

O Supabase é a "cozinha" do sistema; o app é o "salão". Ele entrega pronto:
- **Banco de dados**: pacientes, doses, lotes, agendamentos.
- **Login**: cada pessoa entra com a própria conta.
- **Regras de acesso (RLS)**: quem vê e quem edita o quê.
- **Arquivos (Storage)**: carteirinha, comprovantes em PDF.
- **Funções no servidor**: lembrete de 2ª dose, integrações.

Ele **não tem telas**: o app precisa ser construído à parte, usando o Supabase por trás.
