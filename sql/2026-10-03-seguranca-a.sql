-- ============================================================
-- BLOCO SEGURANÇA A — rodar UMA vez no SQL Editor do Neon, ANTES do código.
-- (auditoria-seguranca.md: S2, S3, S8)
-- ============================================================

-- 1) S3 — E-mail verificado. Quem entrou com Google tem e-mail comprovado; cadastro com senha, não.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT false;
--    Contas sem senha e com e-mail só podem ter vindo do Google → verificadas.
UPDATE usuarios SET email_verificado = true WHERE email IS NOT NULL AND senha_hash IS NULL;
--    A conta do administrador (Javi) fica verificada já.
UPDATE usuarios SET email_verificado = true WHERE email = 'marcelojavierbonet@gmail.com';

-- 2) S8 — Versão da sessão: subir este número derruba todas as sessões abertas da pessoa.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sessao_versao INTEGER NOT NULL DEFAULT 0;

-- 3) S2 — Link de "Novo PIN" com CPF fixado pelo chefe (para quem ainda não tinha CPF).
ALTER TABLE convites ADD COLUMN IF NOT EXISTS cpf TEXT;

-- 4) Desempenho: quase toda consulta filtra por empresa.
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios (empresa_id);

-- 5) Conferência (só leitura)
SELECT email_verificado, count(*) FROM usuarios WHERE removido_em IS NULL GROUP BY 1;
