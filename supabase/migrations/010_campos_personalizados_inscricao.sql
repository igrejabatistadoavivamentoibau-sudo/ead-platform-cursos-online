-- 010: Campos personalizados da ficha de inscrição. (Já aplicada no banco.)
-- Cada pergunta é uma LINHA, não uma coluna: assim a liderança cria e remove
-- campos pela própria plataforma, sem alterar o banco nem o código.
CREATE TABLE IF NOT EXISTS campos_inscricao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rotulo TEXT NOT NULL,
  ajuda TEXT,
  tipo TEXT NOT NULL DEFAULT 'texto'
    CHECK (tipo IN ('texto','texto_longo','numero','data','telefone','email','selecao','sim_nao')),
  opcoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  obrigatorio BOOLEAN NOT NULL DEFAULT FALSE,
  papel TEXT NOT NULL DEFAULT 'aluno' CHECK (papel IN ('aluno','professor','ambos')),
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campos_inscricao_ordem ON campos_inscricao(ordem);

-- Respostas ficam na própria inscrição: apagar a pergunta não apaga o que
-- já foi respondido por quem se inscreveu antes.
ALTER TABLE inscricoes ADD COLUMN IF NOT EXISTS respostas JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE campos_inscricao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins gerenciam campos" ON campos_inscricao;
CREATE POLICY "Admins gerenciam campos" ON campos_inscricao
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
