#!/usr/bin/env bash
# Executa um arquivo .sql no projeto Supabase pela API de gerenciamento (HTTPS).
# Usado porque o ambiente não tem conexão direta ao Postgres (ver docs/contexto.md, seção 3).
#
# Uso: ./scripts/sql.sh caminho/arquivo.sql
# Requer as variáveis SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF no ambiente.
set -euo pipefail

arquivo="${1:-}"
if [[ -z "$arquivo" || ! -f "$arquivo" ]]; then
  echo "Uso: $0 caminho/arquivo.sql" >&2
  exit 2
fi
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN não definida}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF não definida}"

# Monta o JSON com o SQL escapado corretamente (evita problemas com aspas).
corpo="$(python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$arquivo")"

resposta="$(mktemp)"
trap 'rm -f "$resposta"' EXIT

status="$(curl -sS -o "$resposta" -w '%{http_code}' -X POST \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "$corpo" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query")"

cat "$resposta"
echo
if [[ "$status" != 2* ]]; then
  echo "Erro: HTTP $status" >&2
  exit 1
fi
