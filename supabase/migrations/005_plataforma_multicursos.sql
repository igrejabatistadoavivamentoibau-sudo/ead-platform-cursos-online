-- ============================================================
-- 005: Plataforma multicursos
-- O curso passa a ser a peça central: guarda a biblioteca de aulas,
-- e cada turma é um grupo de alunos cursando aquele curso.
-- Já aplicada no Supabase de produção; versionada aqui junto ao código.
-- ============================================================

CREATE TABLE IF NOT EXISTS cursos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  descricao TEXT,
  categoria TEXT,
  nivel TEXT NOT NULL DEFAULT 'iniciante' CHECK (nivel IN ('iniciante','intermediario','avancado')),
  capa_path TEXT,
  cor TEXT NOT NULL DEFAULT 'esmeralda',
  carga_horaria INTEGER,
  publicado BOOLEAN NOT NULL DEFAULT FALSE,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cursos_publicado ON cursos(publicado);
CREATE INDEX IF NOT EXISTS idx_cursos_ordem ON cursos(ordem);

ALTER TABLE aulas ADD COLUMN IF NOT EXISTS curso_id UUID REFERENCES cursos(id) ON DELETE CASCADE;
ALTER TABLE aulas ALTER COLUMN turma_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aulas_curso_id ON aulas(curso_id);
ALTER TABLE aulas DROP CONSTRAINT IF EXISTS aulas_turma_id_numero_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_aulas_curso_numero ON aulas(curso_id, numero) WHERE curso_id IS NOT NULL;

ALTER TABLE turmas DROP CONSTRAINT IF EXISTS turmas_curso_id_fkey;
UPDATE turmas SET curso_id = NULL;
ALTER TABLE turmas ADD CONSTRAINT turmas_curso_id_fkey
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE SET NULL;

ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos veem cursos publicados" ON cursos
  FOR SELECT USING (publicado = TRUE);
CREATE POLICY "Admins gerenciam cursos novos" ON cursos
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Professores veem cursos de suas turmas" ON cursos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM turmas WHERE turmas.curso_id = cursos.id AND turmas.professor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Professores gerenciam aulas de suas turmas" ON aulas;
DROP POLICY IF EXISTS "Alunos veem aulas publicadas de sua turma" ON aulas;

CREATE POLICY "Professores gerenciam aulas de seus cursos" ON aulas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM turmas WHERE turmas.curso_id = aulas.curso_id AND turmas.professor_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM turmas WHERE turmas.curso_id = aulas.curso_id AND turmas.professor_id = auth.uid())
  );

CREATE POLICY "Alunos veem aulas publicadas de seus cursos" ON aulas
  FOR SELECT USING (
    publicada = TRUE
    AND EXISTS (
      SELECT 1 FROM turma_alunos ta
      JOIN turmas t ON t.id = ta.turma_id
      WHERE ta.aluno_id = auth.uid() AND t.curso_id = aulas.curso_id
    )
  );

DROP POLICY IF EXISTS "Professor ve progresso de suas turmas" ON aula_progresso;
CREATE POLICY "Professor ve progresso de seus cursos" ON aula_progresso
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM aulas a
      JOIN turmas t ON t.curso_id = a.curso_id
      WHERE a.id = aula_progresso.aula_id AND t.professor_id = auth.uid()
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('cursos', 'cursos', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "Leitura publica das capas de curso" ON storage.objects;
CREATE POLICY "Leitura publica das capas de curso"
  ON storage.objects FOR SELECT USING (bucket_id = 'cursos');
DROP POLICY IF EXISTS "Admins enviam capas de curso" ON storage.objects;
CREATE POLICY "Admins enviam capas de curso"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cursos' AND is_admin());
DROP POLICY IF EXISTS "Admins removem capas de curso" ON storage.objects;
CREATE POLICY "Admins removem capas de curso"
  ON storage.objects FOR DELETE USING (bucket_id = 'cursos' AND is_admin());
