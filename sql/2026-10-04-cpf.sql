-- ============================================================
-- C4 — CPF protegido (huella HMAC + máscara). Rodar UMA vez no SQL Editor do Neon, ANTES do código.
-- Depois de subir o código e cadastrar PIN_PEPPER, tocar "🔐 Proteger CPFs" no Painel admin.
-- ============================================================
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf_hash TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf_mascarado TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_cpf_hash_key ON usuarios (cpf_hash);
ALTER TABLE convites ADD COLUMN IF NOT EXISTS cpf_hash TEXT;
-- Conferência (só leitura): quantos CPFs ainda estão em claro
SELECT count(*) AS cpfs_em_claro FROM usuarios WHERE cpf IS NOT NULL;
