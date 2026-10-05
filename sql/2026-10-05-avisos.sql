-- ============================================================
-- AVISOS 🔔 (05/10/2026) — rodar UMA vez no SQL Editor do Neon, ANTES do código.
-- ============================================================
CREATE TABLE IF NOT EXISTS eventos (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  obra_id INTEGER,                -- sem FK: o registro sobrevive se a obra for apagada
  categoria TEXT NOT NULL,        -- etapas, fotos, materiais, ferramentas, documentos, observacoes, equipe, pedidos, obra
  acao TEXT NOT NULL,             -- criou, concluiu, foto, entregou, recebeu, editou, apagou, desmarcou, rank...
  alvo_id INTEGER,
  texto TEXT NOT NULL,
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  rank_autor INTEGER NOT NULL,
  afetado_id INTEGER REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eventos_empresa_data ON eventos (empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_afetado ON eventos (afetado_id) WHERE afetado_id IS NOT NULL;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avisos_visto_ate TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avisos_profundidade INTEGER NOT NULL DEFAULT 1;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avisos_modulos JSONB;

CREATE TABLE IF NOT EXISTS obras_silenciadas (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, obra_id)
);

-- Conferência (só leitura): deve mostrar "eventos" e "obras_silenciadas".
SELECT table_name FROM information_schema.tables WHERE table_name IN ('eventos', 'obras_silenciadas');
