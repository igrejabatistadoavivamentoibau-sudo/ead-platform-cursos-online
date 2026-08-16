-- 009: Inscrição pública com fila de aprovação. (Já aplicada no banco.)
-- A senha do inscrito vai direto para o sistema de autenticação e NUNCA
-- passa por esta tabela. Quem libera o acesso é o perfil em public.users,
-- criado só na aprovação — até lá o login responde "conta não liberada".
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS inscricoes_abertas BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS valor_matricula NUMERIC(10,2);

CREATE TABLE IF NOT EXISTS inscricoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  papel TEXT NOT NULL DEFAULT 'aluno' CHECK (papel IN ('aluno','professor')),
  turma_id UUID REFERENCES turmas(id) ON DELETE SET NULL,
  mensagem TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','recusada')),
  motivo TEXT,
  pagamento_status TEXT NOT NULL DEFAULT 'nao_aplicavel'
    CHECK (pagamento_status IN ('nao_aplicavel','pendente','pago','isento')),
  pagamento_valor NUMERIC(10,2),
  pagamento_referencia TEXT,
  decidida_por UUID REFERENCES users(id) ON DELETE SET NULL,
  decidida_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inscricoes_status ON inscricoes(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inscricoes_email_pendente
  ON inscricoes(lower(email)) WHERE status = 'pendente';

ALTER TABLE inscricoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam inscricoes" ON inscricoes;
CREATE POLICY "Admins gerenciam inscricoes" ON inscricoes
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
