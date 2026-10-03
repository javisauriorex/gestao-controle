-- ============================================================
-- Gestão & Controle — ESQUEMA REAL do banco (Neon, projeto raspy-forest-82462838)
-- Gerado a partir do Neon em 2026-09-28 (bloco de ranks) + bloco legal (sql/2026-09-29-legal.sql) + segurança A (sql/2026-10-03-seguranca-a.sql).
--
-- Serve de DOCUMENTAÇÃO e para montar bancos de teste. NÃO rodar no Neon
-- de produção (as tabelas já existem). Mudanças novas vão em sql/AAAA-MM-DD-nome.sql
-- e depois este arquivo é atualizado.
-- Tabelas em ordem de dependência (quem é referenciado vem antes).
-- ============================================================

-- Empresa (cliente do G&C). dono_usuario_id aponta pro Dono (sem FK, para evitar dependência circular com usuarios).
CREATE TABLE empresas (
  id SERIAL,
  nome text NOT NULL,
  dono_usuario_id integer,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT empresas_pkey PRIMARY KEY (id)
);

-- Pessoas. rank 1=Dono … 8=Profissional (menor número = mais poder). Login por email+senha, Google, ou CPF+PIN. removido_em preenchido = conta excluída ("ausente"): dados pessoais apagados, histórico mantido.
CREATE TABLE usuarios (
  id SERIAL,
  email text,
  nome text,
  empresa_id integer NOT NULL,
  rank integer NOT NULL,
  excecao_modulos jsonb,
  senha_hash text,
  criado_em timestamp with time zone DEFAULT now(),
  cpf text,
  pin_hash text,
  pin_tentativas integer DEFAULT 0,
  pin_bloqueado_ate timestamp with time zone,
  telefone text,
  removido_em timestamp with time zone,
  removido_por integer,
  termos_versao text,
  termos_aceito_em timestamp with time zone,
  pin_rodadas integer DEFAULT 0,
  login_tentativas integer DEFAULT 0,
  login_bloqueado_ate timestamp with time zone,
  login_rodadas integer DEFAULT 0,
  email_verificado boolean NOT NULL DEFAULT false,
  sessao_versao integer NOT NULL DEFAULT 0,
  CONSTRAINT usuarios_rank_check CHECK (((rank >= 1) AND (rank <= 8))),
  CONSTRAINT usuarios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT usuarios_removido_por_fkey FOREIGN KEY (removido_por) REFERENCES usuarios(id),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_cpf_key UNIQUE (cpf),
  CONSTRAINT usuarios_email_key UNIQUE (email)
);

-- Nível de acesso por empresa × rank × módulo (tela de Permissões). Só ranks 1–3 editam, e só linhas de ranks abaixo.
CREATE TABLE permissoes (
  id SERIAL,
  empresa_id integer NOT NULL,
  rank integer NOT NULL,
  modulo text NOT NULL,
  nivel text NOT NULL,
  CONSTRAINT permissoes_modulo_check CHECK ((modulo = ANY (ARRAY['etapas'::text, 'equipe'::text, 'documentos'::text, 'ferramentas'::text, 'materiais'::text, 'observacoes'::text]))),
  CONSTRAINT permissoes_nivel_check CHECK ((nivel = ANY (ARRAY['nenhum'::text, 'visualizar'::text, 'editar'::text]))),
  CONSTRAINT permissoes_rank_check CHECK (((rank >= 1) AND (rank <= 8))),
  CONSTRAINT permissoes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT permissoes_pkey PRIMARY KEY (id),
  CONSTRAINT permissoes_empresa_id_rank_modulo_key UNIQUE (empresa_id, rank, modulo)
);

-- Convites pendentes. token = link de WhatsApp (uso único, expira_em). usuario_id preenchido = link de "Novo PIN" para conta existente.
CREATE TABLE convites (
  id SERIAL,
  empresa_id integer NOT NULL,
  email text,
  rank integer NOT NULL,
  funcao text,
  obra_id integer,
  aceito boolean DEFAULT false,
  criado_por integer NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  token text,
  nome text,
  telefone text,
  expira_em timestamp with time zone,
  usuario_id integer,
  cpf text,
  CONSTRAINT convites_rank_check CHECK (((rank >= 1) AND (rank <= 8))),
  CONSTRAINT convites_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  CONSTRAINT convites_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT convites_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT convites_pkey PRIMARY KEY (id),
  CONSTRAINT convites_token_key UNIQUE (token)
);

-- Obras. Ranks 1–2 veem todas; os demais só as obras onde estão em equipe. responsavel_id decide o bloqueio de módulos na obra.
CREATE TABLE obras (
  id SERIAL,
  empresa_id integer NOT NULL,
  cliente text NOT NULL,
  endereco text,
  tipo text,
  data_inicio date,
  estado text DEFAULT 'ativa'::text,
  criado_por integer NOT NULL,
  responsavel_id integer NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT obras_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  CONSTRAINT obras_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT obras_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES usuarios(id),
  CONSTRAINT obras_pkey PRIMARY KEY (id)
);

-- Quem está em cada obra. funcao = texto livre (para Profissional, o ofício). excecao_modulos = bloqueio POR OBRA definido pelo responsável. asistencias = datas de presença.
CREATE TABLE equipe (
  id SERIAL,
  obra_id integer NOT NULL,
  usuario_id integer NOT NULL,
  funcao text,
  asistencias jsonb DEFAULT '[]'::jsonb,
  criado_por integer NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  excecao_modulos jsonb,
  CONSTRAINT equipe_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  CONSTRAINT equipe_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE,
  CONSTRAINT equipe_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT equipe_pkey PRIMARY KEY (id),
  CONSTRAINT equipe_obra_id_usuario_id_key UNIQUE (obra_id, usuario_id)
);

-- Etapas da obra (árvore via parent_id). concluida_por/concluida_em = quem e quando concluiu.
CREATE TABLE etapas (
  id SERIAL,
  obra_id integer NOT NULL,
  parent_id integer,
  texto text NOT NULL,
  concluida boolean DEFAULT false,
  foto_conclusao_id text,
  concluida_por integer,
  concluida_em timestamp with time zone,
  criado_por integer NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT etapas_concluida_por_fkey FOREIGN KEY (concluida_por) REFERENCES usuarios(id),
  CONSTRAINT etapas_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  CONSTRAINT etapas_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE,
  CONSTRAINT etapas_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES etapas(id) ON DELETE CASCADE,
  CONSTRAINT etapas_pkey PRIMARY KEY (id)
);

-- Galeria de fotos por etapa. arquivo_id = chave no Cloudflare KV (gc-arquivos).
CREATE TABLE etapa_fotos (
  id SERIAL,
  etapa_id integer NOT NULL,
  arquivo_id text NOT NULL,
  criado_por integer NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT etapa_fotos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  CONSTRAINT etapa_fotos_etapa_id_fkey FOREIGN KEY (etapa_id) REFERENCES etapas(id) ON DELETE CASCADE,
  CONSTRAINT etapa_fotos_pkey PRIMARY KEY (id)
);

-- Materiais da obra.
CREATE TABLE materiais (
  id SERIAL,
  obra_id integer NOT NULL,
  texto text NOT NULL,
  criado_por integer NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT materiais_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  CONSTRAINT materiais_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE,
  CONSTRAINT materiais_pkey PRIMARY KEY (id)
);

-- Ferramentas da obra.
CREATE TABLE ferramentas (
  id SERIAL,
  obra_id integer NOT NULL,
  texto text NOT NULL,
  criado_por integer NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT ferramentas_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  CONSTRAINT ferramentas_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE,
  CONSTRAINT ferramentas_pkey PRIMARY KEY (id)
);

-- Documentos da obra. arquivo_id = chave no Cloudflare KV.
CREATE TABLE documentos (
  id SERIAL,
  obra_id integer NOT NULL,
  nome text NOT NULL,
  tipo text,
  arquivo_id text NOT NULL,
  criado_por integer NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT documentos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  CONSTRAINT documentos_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE,
  CONSTRAINT documentos_pkey PRIMARY KEY (id)
);

-- Pedidos/entregas de material, ferramenta ou documento entre pessoas (rastreabilidade). pendente → atendido/recusado.
CREATE TABLE pedidos (
  id SERIAL,
  obra_id integer NOT NULL,
  tipo text NOT NULL,
  descricao text NOT NULL,
  quantidade text,
  remetente_id integer NOT NULL,
  destinatario_id integer NOT NULL,
  status text NOT NULL DEFAULT 'pendente'::text,
  criado_por integer NOT NULL,
  atendido_em timestamp with time zone,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT pedidos_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'atendido'::text, 'recusado'::text]))),
  CONSTRAINT pedidos_tipo_check CHECK ((tipo = ANY (ARRAY['material'::text, 'ferramenta'::text, 'documento'::text]))),
  CONSTRAINT pedidos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  CONSTRAINT pedidos_destinatario_id_fkey FOREIGN KEY (destinatario_id) REFERENCES usuarios(id),
  CONSTRAINT pedidos_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE,
  CONSTRAINT pedidos_remetente_id_fkey FOREIGN KEY (remetente_id) REFERENCES usuarios(id),
  CONSTRAINT pedidos_pkey PRIMARY KEY (id)
);

-- "Livro de obra". rank_autor = rank no momento em que escreveu (vai na firma). Editar só o autor; apagar só superiores.
CREATE TABLE observacoes (
  id SERIAL,
  obra_id integer NOT NULL,
  texto text NOT NULL,
  criado_por integer NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  rank_autor integer,
  editado_em timestamp with time zone,
  CONSTRAINT observacoes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  CONSTRAINT observacoes_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES obras(id) ON DELETE CASCADE,
  CONSTRAINT observacoes_pkey PRIMARY KEY (id)
);

-- Versões anteriores de observações editadas (visíveis para o autor e superiores).
CREATE TABLE observacoes_historico (
  id SERIAL,
  observacao_id integer NOT NULL,
  texto text NOT NULL,
  editado_por integer,
  substituido_em timestamp with time zone DEFAULT now(),
  CONSTRAINT observacoes_historico_editado_por_fkey FOREIGN KEY (editado_por) REFERENCES usuarios(id),
  CONSTRAINT observacoes_historico_observacao_id_fkey FOREIGN KEY (observacao_id) REFERENCES observacoes(id) ON DELETE CASCADE,
  CONSTRAINT observacoes_historico_pkey PRIMARY KEY (id)
);

-- Contatos captados em feira (construnordeste-2026). Só visível para o admin.
CREATE TABLE leads (
  id SERIAL,
  nome text NOT NULL,
  empresa text,
  contato text NOT NULL,
  origem text DEFAULT 'construnordeste-2026'::text,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id)
);

-- Registros de acesso (Marco Civil art. 15): IP + data/hora de cada entrada, apagados após 180 dias.
CREATE TABLE acessos (
  id SERIAL,
  usuario_id integer,
  metodo text NOT NULL,
  ip text,
  user_agent text,
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT acessos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT acessos_pkey PRIMARY KEY (id)
);

-- Índices
CREATE INDEX idx_acessos_criado_em ON public.acessos USING btree (criado_em);
CREATE INDEX idx_acessos_usuario ON public.acessos USING btree (usuario_id);
CREATE INDEX idx_convites_email ON public.convites USING btree (email);
CREATE INDEX idx_documentos_obra ON public.documentos USING btree (obra_id);
CREATE INDEX idx_equipe_obra ON public.equipe USING btree (obra_id);
CREATE INDEX idx_equipe_usuario ON public.equipe USING btree (usuario_id);
CREATE INDEX idx_etapa_fotos_etapa ON public.etapa_fotos USING btree (etapa_id);
CREATE INDEX idx_etapas_obra ON public.etapas USING btree (obra_id);
CREATE INDEX idx_etapas_parent ON public.etapas USING btree (parent_id);
CREATE INDEX idx_ferramentas_obra ON public.ferramentas USING btree (obra_id);
CREATE INDEX idx_leads_criado_em ON public.leads USING btree (criado_em);
CREATE INDEX idx_materiais_obra ON public.materiais USING btree (obra_id);
CREATE INDEX idx_obras_empresa ON public.obras USING btree (empresa_id);
CREATE INDEX idx_observacoes_obra ON public.observacoes USING btree (obra_id);
CREATE INDEX idx_pedidos_destinatario ON public.pedidos USING btree (destinatario_id);
CREATE INDEX idx_pedidos_obra ON public.pedidos USING btree (obra_id);
CREATE INDEX idx_pedidos_remetente ON public.pedidos USING btree (remetente_id);
CREATE INDEX idx_permissoes_empresa ON public.permissoes USING btree (empresa_id);
CREATE INDEX idx_usuarios_email ON public.usuarios USING btree (email);
CREATE INDEX idx_usuarios_empresa ON public.usuarios USING btree (empresa_id);
