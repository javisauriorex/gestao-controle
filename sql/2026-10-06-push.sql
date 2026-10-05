-- ============================================================
-- PUSH 🔔📱 (06/10/2026) — rodar UMA vez no SQL Editor do Neon, ANTES do código.
-- ============================================================
-- Configurações do app (aqui ficam as chaves VAPID, criadas sozinhas pelo Worker na primeira vez).
CREATE TABLE IF NOT EXISTS config_app (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);
-- Um registro por aparelho com notificações ativadas.
CREATE TABLE IF NOT EXISTS push_inscricoes (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_usuario ON push_inscricoes (usuario_id);
-- O rol da app (gc_app) precisa poder usar as tabelas novas (os GRANT por padrão já cobrem, mas garantimos):
GRANT SELECT, INSERT, UPDATE, DELETE ON config_app, push_inscricoes TO gc_app;
GRANT USAGE, SELECT ON SEQUENCE push_inscricoes_id_seq TO gc_app;

-- Conferência (só leitura): deve mostrar 2 linhas.
SELECT table_name FROM information_schema.tables WHERE table_name IN ('config_app', 'push_inscricoes');
