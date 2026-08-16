-- 011: Cobranças preparadas para trocar de empresa de pagamento.
-- (Já aplicada no banco.)
-- A cobrança é neutra: valor, situação e vencimento valem para qualquer
-- empresa. O que é específico fica em "provedor" e "provedor_id".
CREATE TABLE IF NOT EXISTS cobrancas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inscricao_id UUID REFERENCES inscricoes(id) ON DELETE SET NULL,
  aluno_id UUID REFERENCES users(id) ON DELETE SET NULL,
  turma_id UUID REFERENCES turmas(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
  vencimento DATE,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','pago','vencida','cancelada','estornada','isenta')),
  forma TEXT CHECK (forma IN ('pix','boleto','cartao','dinheiro','transferencia','outro')),
  provedor TEXT NOT NULL DEFAULT 'manual',
  provedor_id TEXT,
  link_pagamento TEXT,
  pago_em TIMESTAMP WITH TIME ZONE,
  observacao TEXT,
  registrada_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON cobrancas(status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_aluno ON cobrancas(aluno_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cobrancas_provedor
  ON cobrancas(provedor, provedor_id) WHERE provedor_id IS NOT NULL;

ALTER TABLE cobrancas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins gerenciam cobrancas" ON cobrancas;
CREATE POLICY "Admins gerenciam cobrancas" ON cobrancas
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Aluno ve as proprias cobrancas" ON cobrancas;
CREATE POLICY "Aluno ve as proprias cobrancas" ON cobrancas
  FOR SELECT USING (auth.uid() = aluno_id);

CREATE TABLE IF NOT EXISTS config_pagamento (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  provedor TEXT NOT NULL DEFAULT 'manual'
    CHECK (provedor IN ('manual','asaas','mercadopago','stripe')),
  ativo BOOLEAN NOT NULL DEFAULT FALSE,
  ambiente TEXT NOT NULL DEFAULT 'sandbox' CHECK (ambiente IN ('sandbox','producao')),
  chave_pix TEXT,
  instrucoes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
INSERT INTO config_pagamento (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE config_pagamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins gerenciam config de pagamento" ON config_pagamento;
CREATE POLICY "Admins gerenciam config de pagamento" ON config_pagamento
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
