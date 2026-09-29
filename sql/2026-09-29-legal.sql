-- ============================================================
-- BLOCO LEGAL (LGPD / Marco Civil) — rodar UMA vez no SQL Editor do Neon, ANTES do código.
-- ============================================================

-- 1) Aceite dos Termos: qual versão e quando (L4)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS termos_versao TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS termos_aceito_em TIMESTAMPTZ;

-- 2) Bloqueio progressivo de tentativas (L11): PIN e senha
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin_rodadas INTEGER DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login_tentativas INTEGER DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login_bloqueado_ate TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login_rodadas INTEGER DEFAULT 0;

-- 3) Registros de acesso exigidos pelo Marco Civil (art. 15): IP + data/hora, guardados 6 meses (L6)
CREATE TABLE IF NOT EXISTS acessos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  metodo TEXT NOT NULL,          -- senha | cpf | google | cadastro | convite
  ip TEXT,
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acessos_criado_em ON acessos (criado_em);
CREATE INDEX IF NOT EXISTS idx_acessos_usuario ON acessos (usuario_id);

-- 4) Convites já usados não servem para nada: apagar (guardavam nome/telefone/email) (L5)
DELETE FROM convites WHERE aceito = true;
-- Convites vencidos há mais de 30 dias
DELETE FROM convites WHERE expira_em IS NOT NULL AND expira_em < now() - interval '30 days';
-- Convites antigos por email, sem data de validade, com mais de 37 dias
DELETE FROM convites WHERE expira_em IS NULL AND criado_em < now() - interval '37 days';

-- 5) Contas já excluídas: anonimizar o nome também (passa a aparecer "Usuário removido")
UPDATE usuarios SET nome = 'Usuário removido', excecao_modulos = NULL WHERE removido_em IS NOT NULL;
