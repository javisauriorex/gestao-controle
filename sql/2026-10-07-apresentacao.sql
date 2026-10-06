-- ============================================================
-- APRESENTAÇÃO (slides do começo) — rodar UMA vez no SQL Editor do Neon, ANTES do código.
-- NULL = a pessoa ainda não viu → aparece uma vez depois do splash.
-- ============================================================
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apresentacao_vista_em TIMESTAMPTZ;

-- Conferência (só leitura): deve mostrar 1 linha.
SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'apresentacao_vista_em';
