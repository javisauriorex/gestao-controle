-- ============================================================
-- BLOCO D — SEGURANÇA (09/11/2026). Rodar UMA vez no SQL Editor do Neon, ANTES do código.
-- Ver claude/auditoria-seguranca.md (seção "Auditoria 09/11").
-- ============================================================

-- 1) PIN de 6 números para todos. Quem ainda tem PIN de 4 fica marcado e o app pede um PIN novo no próximo uso.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin_fraco BOOLEAN NOT NULL DEFAULT false;
UPDATE usuarios SET pin_fraco = true WHERE pin_hash IS NOT NULL;

-- 2) Contadores de uso (assistente de IA, e-mails, teste de notificação...) por hora ou por dia.
CREATE TABLE IF NOT EXISTS contadores (
  chave TEXT NOT NULL,
  janela TIMESTAMPTZ NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chave, janela)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON contadores TO gc_app;

-- 3) Tamanho máximo dos textos (ninguém consegue encher a base com textos gigantes).
--    NOT VALID = vale para tudo que entrar daqui em diante; não mexe no que já existe.
ALTER TABLE empresas    ADD CONSTRAINT lim_empresas_nome     CHECK (length(nome) <= 200) NOT VALID;
ALTER TABLE usuarios    ADD CONSTRAINT lim_usuarios_nome     CHECK (length(nome) <= 120) NOT VALID;
ALTER TABLE usuarios    ADD CONSTRAINT lim_usuarios_email    CHECK (length(email) <= 254) NOT VALID;
ALTER TABLE usuarios    ADD CONSTRAINT lim_usuarios_telefone CHECK (length(telefone) <= 40) NOT VALID;
ALTER TABLE convites    ADD CONSTRAINT lim_convites_nome     CHECK (length(nome) <= 120) NOT VALID;
ALTER TABLE convites    ADD CONSTRAINT lim_convites_email    CHECK (length(email) <= 254) NOT VALID;
ALTER TABLE convites    ADD CONSTRAINT lim_convites_funcao   CHECK (length(funcao) <= 60) NOT VALID;
ALTER TABLE convites    ADD CONSTRAINT lim_convites_telefone CHECK (length(telefone) <= 40) NOT VALID;
ALTER TABLE obras       ADD CONSTRAINT lim_obras_cliente     CHECK (length(cliente) <= 200) NOT VALID;
ALTER TABLE obras       ADD CONSTRAINT lim_obras_endereco    CHECK (length(endereco) <= 300) NOT VALID;
ALTER TABLE obras       ADD CONSTRAINT lim_obras_tipo        CHECK (length(tipo) <= 60) NOT VALID;
ALTER TABLE obras       ADD CONSTRAINT lim_obras_estado      CHECK (estado IN ('ativa', 'pausada', 'concluida')) NOT VALID;
ALTER TABLE equipe      ADD CONSTRAINT lim_equipe_funcao     CHECK (length(funcao) <= 60) NOT VALID;
ALTER TABLE equipe      ADD CONSTRAINT lim_equipe_excecao    CHECK (length(excecao_modulos::text) <= 500) NOT VALID;
ALTER TABLE etapas      ADD CONSTRAINT lim_etapas_texto      CHECK (length(texto) <= 2000) NOT VALID;
ALTER TABLE materiais   ADD CONSTRAINT lim_materiais_texto   CHECK (length(texto) <= 2000) NOT VALID;
ALTER TABLE ferramentas ADD CONSTRAINT lim_ferramentas_texto CHECK (length(texto) <= 2000) NOT VALID;
ALTER TABLE documentos  ADD CONSTRAINT lim_documentos_nome   CHECK (length(nome) <= 200) NOT VALID;
ALTER TABLE documentos  ADD CONSTRAINT lim_documentos_tipo   CHECK (length(tipo) <= 60) NOT VALID;
ALTER TABLE pedidos     ADD CONSTRAINT lim_pedidos_descricao CHECK (length(descricao) <= 500) NOT VALID;
ALTER TABLE pedidos     ADD CONSTRAINT lim_pedidos_qtd       CHECK (length(quantidade) <= 60) NOT VALID;
ALTER TABLE observacoes ADD CONSTRAINT lim_observacoes_texto CHECK (length(texto) <= 10000) NOT VALID;
ALTER TABLE observacoes_historico ADD CONSTRAINT lim_obs_hist_texto CHECK (length(texto) <= 10000) NOT VALID;
ALTER TABLE eventos     ADD CONSTRAINT lim_eventos_texto     CHECK (length(texto) <= 400) NOT VALID;

-- 4) Conferência (só leitura): deve mostrar quantas pessoas vão ter que criar o PIN de 6 e "contadores" existindo.
SELECT (SELECT count(*) FROM usuarios WHERE pin_fraco) AS pin_para_trocar,
       (SELECT count(*) FROM information_schema.tables WHERE table_name = 'contadores') AS tabela_contadores;
