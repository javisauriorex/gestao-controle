-- ============================================================
-- BLOCO RANKS — rodar UMA vez no SQL Editor do Neon (projeto raspy-forest-82462838),
-- ANTES de subir os arquivos de código.
-- ============================================================

-- 1) Conta excluída = "ausente": a pessoa fica no histórico, mas não entra mais.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS removido_em TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS removido_por INTEGER REFERENCES usuarios(id);

-- 2) Bloqueio de módulos passa a ser POR OBRA (o responsável da obra decide).
ALTER TABLE equipe ADD COLUMN IF NOT EXISTS excecao_modulos JSONB DEFAULT NULL;
--    Copia os bloqueios que existiam por pessoa para cada obra em que ela está...
UPDATE equipe e SET excecao_modulos = u.excecao_modulos
  FROM usuarios u
  WHERE u.id = e.usuario_id AND u.excecao_modulos IS NOT NULL AND e.excecao_modulos IS NULL;
--    ...e zera o bloqueio "global" antigo (não é mais usado).
UPDATE usuarios SET excecao_modulos = NULL WHERE excecao_modulos IS NOT NULL;

-- 3) Quem criou cada obra e o responsável dela entram na equipe
--    (com a visibilidade corrigida, senão deixariam de ver a obra).
INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
  SELECT id, criado_por, '', criado_por FROM obras WHERE criado_por IS NOT NULL
  ON CONFLICT (obra_id, usuario_id) DO NOTHING;
INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
  SELECT id, responsavel_id, '', COALESCE(criado_por, responsavel_id) FROM obras WHERE responsavel_id IS NOT NULL
  ON CONFLICT (obra_id, usuario_id) DO NOTHING;

-- 4) Conferência (só leitura): quantas pessoas por obra depois do ajuste
SELECT o.id, o.cliente, COUNT(e.*) AS pessoas_na_equipe
FROM obras o LEFT JOIN equipe e ON e.obra_id = o.id
GROUP BY o.id, o.cliente ORDER BY o.id;

-- 5) "Função" deixa de ser cópia automática do nome do rank.
--    Apaga só as que são exatamente o nome de um rank (ex.: "Encarregado", "Mestre de Obra 1").
--    Funções escritas à mão ("Eletricista", "Pedreiro") ficam.
UPDATE equipe SET funcao = ''
WHERE funcao ~* '^(Dono|Engenheiro Chefe de Obra|Engenheiro Estagiário|Mestre de Obra|Encarregado|Almoxarife|Chefe de Turma|Profissional)( [0-9]+)?$';
UPDATE convites SET funcao = ''
WHERE aceito = false
  AND funcao ~* '^(Dono|Engenheiro Chefe de Obra|Engenheiro Estagiário|Mestre de Obra|Encarregado|Almoxarife|Chefe de Turma|Profissional)( [0-9]+)?$';
