-- Tabela de leads capturados via QR code (ex: ConstruNordeste 2026)
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  empresa TEXT,
  contato TEXT NOT NULL, -- email ou WhatsApp
  origem TEXT DEFAULT 'construnordeste-2026',
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_leads_criado_em ON leads(criado_em);
