-- ============================================================
-- BLOCO HIERARQUIA (05/10/2026) — rodar UMA vez no SQL Editor do Neon, ANTES do código.
-- Ver claude/permisos-y-flujos.md (agujeros H1–H9 + tabela nova do Javi).
-- ============================================================

-- 1) Rank do autor no momento em que criou (a proteção segue esse rank, não o atual).
ALTER TABLE etapas      ADD COLUMN IF NOT EXISTS rank_autor INTEGER;
ALTER TABLE etapa_fotos ADD COLUMN IF NOT EXISTS rank_autor INTEGER;
ALTER TABLE materiais   ADD COLUMN IF NOT EXISTS rank_autor INTEGER;
ALTER TABLE ferramentas ADD COLUMN IF NOT EXISTS rank_autor INTEGER;
ALTER TABLE documentos  ADD COLUMN IF NOT EXISTS rank_autor INTEGER;
ALTER TABLE pedidos     ADD COLUMN IF NOT EXISTS rank_autor INTEGER;
UPDATE etapas      t SET rank_autor = u.rank FROM usuarios u WHERE u.id = t.criado_por AND t.rank_autor IS NULL;
UPDATE etapa_fotos t SET rank_autor = u.rank FROM usuarios u WHERE u.id = t.criado_por AND t.rank_autor IS NULL;
UPDATE materiais   t SET rank_autor = u.rank FROM usuarios u WHERE u.id = t.criado_por AND t.rank_autor IS NULL;
UPDATE ferramentas t SET rank_autor = u.rank FROM usuarios u WHERE u.id = t.criado_por AND t.rank_autor IS NULL;
UPDATE documentos  t SET rank_autor = u.rank FROM usuarios u WHERE u.id = t.criado_por AND t.rank_autor IS NULL;
UPDATE pedidos     t SET rank_autor = u.rank FROM usuarios u WHERE u.id = t.criado_por AND t.rank_autor IS NULL;
UPDATE observacoes t SET rank_autor = u.rank FROM usuarios u WHERE u.id = t.criado_por AND t.rank_autor IS NULL;

-- 2) Presença marcada por um superior (exceção visível): { "2026-10-05": {"por": 12, "nome": "Roberto", "rank": 4} }
ALTER TABLE equipe ADD COLUMN IF NOT EXISTS presencas_por JSONB;

-- 3) Nível novo "receber" (ver + confirmar o que recebeu + pedir) — Ferramentas e Materiais.
ALTER TABLE permissoes DROP CONSTRAINT IF EXISTS permissoes_nivel_check;
ALTER TABLE permissoes ADD CONSTRAINT permissoes_nivel_check CHECK (nivel IN ('nenhum', 'visualizar', 'receber', 'editar'));

-- 4) Entrega com confirmação: "aguardando" = entregue, falta quem recebe confirmar.
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check CHECK (status IN ('pendente', 'aguardando', 'atendido', 'recusado'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMPTZ;

-- 5) Sugestões de fluxo de informação (tela Permissões → e-mail para suporte@).
CREATE TABLE IF NOT EXISTS sugestoes (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  texto TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sugestoes_usuario ON sugestoes (usuario_id, criado_em);

-- 6) Matriz de permissões nova (tabela do Javi, 04/10) para TODAS as empresas.
--    Estamos em beta sem clientes: substitui o que houver. (Empresas novas já nascem assim pelo código.)
INSERT INTO permissoes (empresa_id, rank, modulo, nivel)
SELECT e.id, r.rank, m.modulo,
  CASE
    WHEN r.rank IN (1, 2, 4, 5) THEN 'editar'
    WHEN r.rank = 3 THEN 'visualizar'
    WHEN r.rank = 6 THEN CASE m.modulo WHEN 'equipe' THEN 'nenhum' WHEN 'etapas' THEN 'visualizar' WHEN 'documentos' THEN 'visualizar' ELSE 'editar' END
    WHEN r.rank = 7 THEN CASE m.modulo WHEN 'etapas' THEN 'visualizar' WHEN 'documentos' THEN 'visualizar' ELSE 'editar' END
    ELSE CASE m.modulo WHEN 'equipe' THEN 'nenhum' WHEN 'ferramentas' THEN 'receber' WHEN 'materiais' THEN 'receber' WHEN 'observacoes' THEN 'editar' ELSE 'visualizar' END
  END
FROM empresas e
CROSS JOIN generate_series(1, 8) AS r(rank)
CROSS JOIN unnest(ARRAY['etapas', 'equipe', 'documentos', 'ferramentas', 'materiais', 'observacoes']) AS m(modulo)
ON CONFLICT (empresa_id, rank, modulo) DO UPDATE SET nivel = EXCLUDED.nivel;

-- 7) Conferência (só leitura): deve mostrar 8 linhas por empresa com os níveis novos.
SELECT rank, string_agg(modulo || '=' || nivel, ', ' ORDER BY modulo) AS niveis
FROM permissoes WHERE empresa_id = (SELECT min(id) FROM empresas) GROUP BY rank ORDER BY rank;
