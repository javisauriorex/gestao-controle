#!/usr/bin/env bash
# Roda as provas automáticas de permissões contra um Postgres LOCAL (nunca toca o Neon de verdade).
# Requisitos: Postgres rodando (PGHOST/PGPORT/PGUSER), Node 18+.
set -e
cd "$(dirname "$0")/.."
DB=${PGDATABASE:-gc_teste}
PSQL="psql -h ${PGHOST:-/tmp/pgt} -p ${PGPORT:-5499} -U ${PGUSER:-postgres} -q"
$PSQL -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
$PSQL -d $DB -v ON_ERROR_STOP=1 -f schema.sql   # schema.sql = retrato atual do Neon (já inclui todas as migrações)
TMP=$(mktemp -d)
cp -r src "$TMP/src" && cp tests/db-local.js "$TMP/src/lib/db.js" && cp tests/permissoes.test.mjs tests/cf-email-mock.mjs "$TMP/"
echo '{"type":"module"}' > "$TMP/package.json"
(cd "$TMP" && npm i -s pg > /dev/null 2>&1 && node --import ./cf-email-mock.mjs permissoes.test.mjs)
