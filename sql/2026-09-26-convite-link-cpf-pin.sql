-- Convite por link (WhatsApp) + login com CPF e PIN.
-- Pegar inteiro no SQL Editor do Neon (projeto raspy-forest-82462838) e rodar UMA vez.
-- Só ADICIONA colunas; não apaga nem altera dados existentes.

-- Usuários: email passa a ser opcional (quem entra com CPF pode não ter email)
ALTER TABLE usuarios ALTER COLUMN email DROP NOT NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cpf TEXT UNIQUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin_tentativas INTEGER DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin_bloqueado_ate TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone TEXT;

-- Convites: agora podem ser por link (sem email)
ALTER TABLE convites ALTER COLUMN email DROP NOT NULL;
ALTER TABLE convites ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;
ALTER TABLE convites ADD COLUMN IF NOT EXISTS nome TEXT;
ALTER TABLE convites ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE convites ADD COLUMN IF NOT EXISTS expira_em TIMESTAMPTZ;
-- Preenchido só nos links de "Novo PIN" (redefinir PIN de alguém que já tem conta)
ALTER TABLE convites ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;
