-- Complementa o schema.sql do repo com as tabelas/colunas que existem no Neon
-- mas faltam no schema.sql antigo. Usado SÓ pelas provas automáticas (Postgres local).
CREATE TABLE IF NOT EXISTS documentos (id SERIAL PRIMARY KEY, obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE, nome TEXT NOT NULL, tipo TEXT, arquivo_id TEXT, criado_por INTEGER NOT NULL REFERENCES usuarios(id), criado_em TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS permissoes (id SERIAL PRIMARY KEY, empresa_id INTEGER NOT NULL, rank INTEGER NOT NULL, modulo TEXT NOT NULL, nivel TEXT NOT NULL, UNIQUE (empresa_id, rank, modulo));
CREATE TABLE IF NOT EXISTS etapa_fotos (id SERIAL PRIMARY KEY, etapa_id INTEGER NOT NULL REFERENCES etapas(id) ON DELETE CASCADE, arquivo_id TEXT, criado_por INTEGER NOT NULL REFERENCES usuarios(id), criado_em TIMESTAMPTZ DEFAULT now());
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rank_check; ALTER TABLE usuarios ADD CHECK (rank BETWEEN 1 AND 8);
ALTER TABLE convites DROP CONSTRAINT IF EXISTS convites_rank_check; ALTER TABLE convites ADD CHECK (rank BETWEEN 1 AND 8);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_hash TEXT;
