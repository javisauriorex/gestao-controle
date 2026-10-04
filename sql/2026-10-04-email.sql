-- ============================================================
-- BLOCO E-MAIL (confirmação de e-mail + "Esqueci a senha") — rodar UMA vez no SQL Editor do Neon, ANTES do código.
-- ============================================================

-- Links enviados por e-mail. Guardamos só o hash (SHA-256) do token, nunca o token em si.
CREATE TABLE IF NOT EXISTS tokens_email (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('confirmar', 'senha')),
  token_hash TEXT NOT NULL UNIQUE,
  expira_em TIMESTAMPTZ NOT NULL,
  usado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tokens_email_usuario ON tokens_email (usuario_id, tipo);

-- Conferência (só leitura): quantas contas com senha ainda não confirmaram o e-mail
SELECT count(*) AS contas_com_senha_sem_confirmar FROM usuarios
WHERE senha_hash IS NOT NULL AND email IS NOT NULL AND NOT email_verificado AND removido_em IS NULL;
