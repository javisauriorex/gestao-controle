-- Observações como "livro de obra": firma, edição só do autor com histórico, apagar só superiores.
-- Pegar inteiro no SQL Editor do Neon (projeto raspy-forest-82462838) e rodar UMA vez.

-- Rank do autor NO MOMENTO em que escreveu (vai na firma, não muda se ele for promovido depois)
ALTER TABLE observacoes ADD COLUMN IF NOT EXISTS rank_autor INTEGER;
ALTER TABLE observacoes ADD COLUMN IF NOT EXISTS editado_em TIMESTAMPTZ;
UPDATE observacoes o SET rank_autor = u.rank FROM usuarios u WHERE u.id = o.criado_por AND o.rank_autor IS NULL;

-- Versões anteriores de cada observação editada
CREATE TABLE IF NOT EXISTS observacoes_historico (
  id SERIAL PRIMARY KEY,
  observacao_id INTEGER NOT NULL REFERENCES observacoes(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  editado_por INTEGER REFERENCES usuarios(id),
  substituido_em TIMESTAMPTZ DEFAULT now()
);

-- Por padrão, todos os ranks veem e escrevem em Observações
-- (depois cada empresa pode bloquear na tela de Permissões)
UPDATE permissoes SET nivel = 'editar' WHERE modulo = 'observacoes';
