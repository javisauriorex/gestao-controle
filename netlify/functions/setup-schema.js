import { sql } from "./lib/db.js";

// Function de UN SOLO USO: crea el esquema completo (11 tablas + 12 índices).
// Se llama visitando /api/setup-schema?chave=gc-setup-2026 una vez, después de
// activar Netlify DB. Si la corrés dos veces, las tablas ya existentes van a
// tirar error (CREATE TABLE sem IF NOT EXISTS) — es un freno de seguridad
// intencional, no un bug: evita que alguien la dispare sin querer y arruine
// datos ya cargados. Borrá este archivo del repo después de usarlo.
export default async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("chave") !== "gc-setup-2026") {
    return new Response(JSON.stringify({ ok: false, error: "chave inválida" }), { status: 403 });
  }

  const passos = [];
  const rodar = async (nome, fn) => {
    try {
      await fn();
      passos.push(`✅ ${nome}`);
    } catch (e) {
      passos.push(`❌ ${nome} — ${e.message}`);
    }
  };

  await rodar("CREATE TABLE empresas", () => sql`
    CREATE TABLE empresas (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      dono_usuario_id INTEGER,
      criado_em TIMESTAMPTZ DEFAULT now()
    )
  `);

  await rodar("CREATE TABLE usuarios", () => sql`
    CREATE TABLE usuarios (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      nome TEXT,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 7),
      excecao_modulos JSONB DEFAULT NULL,
      criado_em TIMESTAMPTZ DEFAULT now()
    )
  `);

  await rodar("CREATE TABLE convites", () => sql`
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
    )
  `);

  await rodar("CREATE TABLE obras", () => sql`
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
    )
  `);

  await rodar("CREATE TABLE equipe", () => sql`
    CREATE TABLE equipe (
      id SERIAL PRIMARY KEY,
      obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      funcao TEXT,
      asistencias JSONB DEFAULT '[]',
      criado_por INTEGER NOT NULL REFERENCES usuarios(id),
      criado_em TIMESTAMPTZ DEFAULT now(),
      UNIQUE (obra_id, usuario_id)
    )
  `);

  await rodar("CREATE TABLE etapas", () => sql`
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
    )
  `);

  await rodar("CREATE TABLE ferramentas", () => sql`
    CREATE TABLE ferramentas (
      id SERIAL PRIMARY KEY,
      obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
      texto TEXT NOT NULL,
      criado_por INTEGER NOT NULL REFERENCES usuarios(id),
      criado_em TIMESTAMPTZ DEFAULT now()
    )
  `);

  await rodar("CREATE TABLE materiais", () => sql`
    CREATE TABLE materiais (
      id SERIAL PRIMARY KEY,
      obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
      texto TEXT NOT NULL,
      criado_por INTEGER NOT NULL REFERENCES usuarios(id),
      criado_em TIMESTAMPTZ DEFAULT now()
    )
  `);

  await rodar("CREATE TABLE observacoes", () => sql`
    CREATE TABLE observacoes (
      id SERIAL PRIMARY KEY,
      obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
      texto TEXT NOT NULL,
      criado_por INTEGER NOT NULL REFERENCES usuarios(id),
      criado_em TIMESTAMPTZ DEFAULT now()
    )
  `);

  await rodar("CREATE TABLE documentos", () => sql`
    CREATE TABLE documentos (
      id SERIAL PRIMARY KEY,
      obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      tipo TEXT,
      arquivo_id TEXT NOT NULL,
      criado_por INTEGER NOT NULL REFERENCES usuarios(id),
      criado_em TIMESTAMPTZ DEFAULT now()
    )
  `);

  await rodar("CREATE TABLE permissoes", () => sql`
    CREATE TABLE permissoes (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 7),
      modulo TEXT NOT NULL CHECK (modulo IN ('etapas', 'equipe', 'documentos', 'ferramentas', 'materiais', 'observacoes')),
      nivel TEXT NOT NULL CHECK (nivel IN ('nenhum', 'visualizar', 'editar')),
      UNIQUE (empresa_id, rank, modulo)
    )
  `);

  await rodar("idx_usuarios_email", () => sql`CREATE INDEX idx_usuarios_email ON usuarios(email)`);
  await rodar("idx_obras_empresa", () => sql`CREATE INDEX idx_obras_empresa ON obras(empresa_id)`);
  await rodar("idx_equipe_obra", () => sql`CREATE INDEX idx_equipe_obra ON equipe(obra_id)`);
  await rodar("idx_equipe_usuario", () => sql`CREATE INDEX idx_equipe_usuario ON equipe(usuario_id)`);
  await rodar("idx_etapas_obra", () => sql`CREATE INDEX idx_etapas_obra ON etapas(obra_id)`);
  await rodar("idx_etapas_parent", () => sql`CREATE INDEX idx_etapas_parent ON etapas(parent_id)`);
  await rodar("idx_ferramentas_obra", () => sql`CREATE INDEX idx_ferramentas_obra ON ferramentas(obra_id)`);
  await rodar("idx_materiais_obra", () => sql`CREATE INDEX idx_materiais_obra ON materiais(obra_id)`);
  await rodar("idx_observacoes_obra", () => sql`CREATE INDEX idx_observacoes_obra ON observacoes(obra_id)`);
  await rodar("idx_documentos_obra", () => sql`CREATE INDEX idx_documentos_obra ON documentos(obra_id)`);
  await rodar("idx_convites_email", () => sql`CREATE INDEX idx_convites_email ON convites(email)`);
  await rodar("idx_permissoes_empresa", () => sql`CREATE INDEX idx_permissoes_empresa ON permissoes(empresa_id)`);

  return new Response(JSON.stringify({ ok: true, passos }, null, 2), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/setup-schema" };
