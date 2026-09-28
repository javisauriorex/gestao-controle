#!/usr/bin/env bash
# Roda as provas automáticas de permissões contra um Postgres LOCAL (nunca toca o Neon de verdade).
# Requisitos: Postgres rodando (PGHOST/PGPORT/PGUSER), Node 18+.
set -e
cd "$(dirname "$0")/.."
DB=${PGDATABASE:-gc_teste}
PSQL="psql -h ${PGHOST:-/tmp/pgt} -p ${PGPORT:-5499} -U ${PGUSER:-postgres} -q"
$PSQL -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
$PSQL -d $DB -f schema.sql 2>/dev/null || true          # schema.sql antigo (pode ter erros no fim)
$PSQL -d $DB -v ON_ERROR_STOP=1 -f tests/schema-teste.sql
for f in sql/*.sql; do $PSQL -d $DB -v ON_ERROR_STOP=1 -f "$f" > /dev/null; done   # migrações em ordem de data
TMP=$(mktemp -d)
cp -r src "$TMP/src" && cp tests/db-local.js "$TMP/src/lib/db.js" && cp tests/permissoes.test.mjs "$TMP/"
echo '{"type":"module"}' > "$TMP/package.json"
(cd "$TMP" && npm i -s pg > /dev/null 2>&1 && node permissoes.test.mjs)
