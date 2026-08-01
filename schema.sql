-- Esquema Gestão & Controle — multiusuario
-- Pegar una sola vez en el editor SQL de Neon (Netlify DB → Connect Neon → SQL Editor)

CREATE TABLE empresas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  dono_usuario_id INTEGER,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nome TEXT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 7), -- 1=mais poder ... 7=menos poder: 1 dono, 2 engenheiro chefe de obra, 3 engenheiro estagiário, 4 mestre de obra, 5 encarregado, 6 chefe de turma, 7 profissional
  excecao_modulos JSONB DEFAULT NULL, -- ex: {"etapas":"nenhum","equipe":"nenhum"} — SÓ pode recortar o nível do rank, nunca ampliar (garantido em nivelEfetivo())
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE convites (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 7),
  funcao TEXT,
  obra_id INTEGER,
  aceito BOOLEAN DEFAULT false,
  criado_por INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE obras (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente TEXT NOT NULL,
  endereco TEXT,
  tipo TEXT,
  data_inicio DATE,
  estado TEXT DEFAULT 'ativa',
  criado_por INTEGER NOT NULL REFERENCES usuarios(id),
  responsavel_id INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE equipe (
  id SERIAL PRIMARY KEY,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  funcao TEXT,
  asistencias JSONB DEFAULT '[]',
  criado_por INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE (obra_id, usuario_id)
);

CREATE TABLE etapas (
  id SERIAL PRIMARY KEY,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES etapas(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  concluida BOOLEAN DEFAULT false,
  foto_conclusao_id TEXT,
  concluida_por INTEGER REFERENCES usuarios(id),
  concluida_em TIMESTAMPTZ,
  criado_por INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ferramentas (
  id SERIAL PRIMARY KEY,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  criado_por INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE materiais (
  id SERIAL PRIMARY KEY,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  criado_por INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE observacoes (
  id SERIAL PRIMARY KEY,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  criado_por INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE documentos (
  id SERIAL PRIMARY KEY,
  obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
