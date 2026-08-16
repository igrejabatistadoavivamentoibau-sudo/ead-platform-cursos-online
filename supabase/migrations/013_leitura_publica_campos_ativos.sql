-- 013: Leitura pública das perguntas ATIVAS da ficha. (Já aplicada.)
-- São rótulos de formulário, já exibidos publicamente. As RESPOSTAS
-- continuam fechadas na tabela de inscrições.
DROP POLICY IF EXISTS "Qualquer um le campos ativos" ON campos_inscricao;
CREATE POLICY "Qualquer um le campos ativos" ON campos_inscricao
  FOR SELECT USING (ativo = TRUE);
