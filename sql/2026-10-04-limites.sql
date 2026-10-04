-- ============================================================
-- BLOCO B — limites de uso. Rodar UMA vez no SQL Editor do Neon, ANTES do código.
-- ============================================================

-- Cada arquivo enviado (foto ou documento): para o limite diário por empresa e por pessoa.
CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uploads_empresa ON uploads (empresa_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_uploads_usuario ON uploads (usuario_id, criado_em);

-- Erros de login (senha ou PIN) por IP, para frear ataques em massa. Apagados depois de 1 dia.
CREATE TABLE IF NOT EXISTS falhas_login (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_falhas_login_ip ON falhas_login (ip, criado_em);
CREATE INDEX IF NOT EXISTS idx_acessos_ip ON acessos (ip, criado_em);
