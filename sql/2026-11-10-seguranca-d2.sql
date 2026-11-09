-- BLOCO D2 (10/11/2026). Rodar UMA vez no SQL Editor do Neon, ANTES do código. Pode rodar de novo sem problema.

-- 1) Guardar o id de cada arquivo enviado: o faxineiro diário apaga do KV o que nunca foi usado (24 h).
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS arquivo_id TEXT;
CREATE INDEX IF NOT EXISTS idx_uploads_criado ON uploads (criado_em);

-- 2) Sessões encerradas com "Sair" (a chave daquele aparelho deixa de abrir).
CREATE TABLE IF NOT EXISTS sessoes_revogadas (sid TEXT PRIMARY KEY, expira_em TIMESTAMPTZ NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON sessoes_revogadas TO gc_app;

-- 3) Conferência: tem que dar 1 e 1.
SELECT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'uploads' AND column_name = 'arquivo_id') AS uploads_arquivo,
       (SELECT count(*) FROM information_schema.tables WHERE table_name = 'sessoes_revogadas') AS sessoes;
