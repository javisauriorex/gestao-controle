-- Esquema Gestão & Controle — multiusuario
-- Migração inicial: Netlify a aplica sozinho a cada deploy (não precisa colar em nenhum lugar)

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
  arquivo_id TEXT NOT NULL, -- referencia al blob en Netlify Blobs
  criado_por INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Permissões como dados: cada empresa tem sua própria matriz rank x módulo -> nível.
-- Editável por rank 1-4 desde a tela "Permissões" (Etapa B). Semeada com defaults
-- ao criar cada empresa nova (ver lib/auth.js).
CREATE TABLE permissoes (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 7),
  modulo TEXT NOT NULL CHECK (modulo IN ('etapas', 'equipe', 'documentos', 'ferramentas', 'materiais', 'observacoes')),
  nivel TEXT NOT NULL CHECK (nivel IN ('nenhum', 'visualizar', 'editar')),
  UNIQUE (empresa_id, rank, modulo)
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_obras_empresa ON obras(empresa_id);
CREATE INDEX idx_equipe_obra ON equipe(obra_id);
CREATE INDEX idx_equipe_usuario ON equipe(usuario_id);
CREATE INDEX idx_etapas_obra ON etapas(obra_id);
CREATE INDEX idx_etapas_parent ON etapas(parent_id);
CREATE INDEX idx_ferramentas_obra ON ferramentas(obra_id);
CREATE INDEX idx_materiais_obra ON materiais(obra_id);
CREATE INDEX idx_observacoes_obra ON observacoes(obra_id);
CREATE INDEX idx_documentos_obra ON documentos(obra_id);
CREATE INDEX idx_convites_email ON convites(email);
CREATE INDEX idx_permissoes_empresa ON permissoes(empresa_id);
