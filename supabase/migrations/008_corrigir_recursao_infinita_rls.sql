-- ============================================================
-- 008: Corrige a recursão infinita nas regras de segurança.
--
-- O PROBLEMA
-- A regra de "turmas" perguntava para "turma_alunos" quem estava
-- matriculado. A regra de "turma_alunos" perguntava para "turmas"
-- quem era o professor. Cada uma disparava a outra, para sempre, e o
-- banco abortava com "infinite recursion detected in policy".
--
-- O efeito prático: qualquer leitura de turmas falhava. As telas
-- mostravam "nenhuma turma criada ainda" mesmo com dados no banco.
--
-- A SOLUÇÃO
-- Trocar as subconsultas por funções SECURITY DEFINER, que rodam com
-- os direitos do dono do banco e por isso NÃO reentram nas regras de
-- segurança. Isso corta o ciclo na raiz. É o mesmo mecanismo que
-- is_admin() já usava sem nunca dar problema.
-- ============================================================

CREATE OR REPLACE FUNCTION leciona_curso(p_curso UUID)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM turmas WHERE curso_id = p_curso AND professor_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Alunos veem turmas em que estao matriculados" ON turmas;
CREATE POLICY "Alunos veem turmas em que estao matriculados" ON turmas
  FOR SELECT USING (matriculado_turma(id));

DROP POLICY IF EXISTS "Professores veem matriculas de suas turmas" ON turma_alunos;
CREATE POLICY "Professores veem matriculas de suas turmas" ON turma_alunos
  FOR SELECT USING (leciona_turma(turma_id));

DROP POLICY IF EXISTS "Alunos veem encontros de sua turma" ON encontros;
CREATE POLICY "Alunos veem encontros de sua turma" ON encontros
  FOR SELECT USING (matriculado_turma(turma_id));

DROP POLICY IF EXISTS "Professores gerenciam encontros de suas turmas" ON encontros;
CREATE POLICY "Professores gerenciam encontros de suas turmas" ON encontros
  FOR ALL USING (leciona_turma(turma_id)) WITH CHECK (leciona_turma(turma_id));

DROP POLICY IF EXISTS "Professores gerenciam aulas de seus cursos" ON aulas;
CREATE POLICY "Professores gerenciam aulas de seus cursos" ON aulas
  FOR ALL USING (leciona_curso(curso_id)) WITH CHECK (leciona_curso(curso_id));

DROP POLICY IF EXISTS "Professores veem cursos de suas turmas" ON cursos;
CREATE POLICY "Professores veem cursos de suas turmas" ON cursos
  FOR SELECT USING (leciona_curso(id));
