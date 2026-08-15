-- ============================================================
-- 006: Modalidade (presencial x EAD), avaliações e notas,
--      atividades com entrega, resumo de aula pelo aluno.
-- ============================================================

-- ---------- 1) MODALIDADE DO CURSO ----------
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS modalidade TEXT NOT NULL DEFAULT 'ead'
  CHECK (modalidade IN ('ead', 'presencial'));

COMMENT ON COLUMN cursos.modalidade IS
  'ead = aluno assiste sozinho e a presença vem da conclusão do vídeo; '
  'presencial = encontros em sala com chamada preenchida pelo professor.';

-- Aula avulsa: vídeo gravado enviado direto para a plataforma
ALTER TABLE aulas ADD COLUMN IF NOT EXISTS video_path TEXT;
ALTER TABLE aulas ADD COLUMN IF NOT EXISTS avulsa BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN aulas.video_path IS
  'Arquivo de vídeo hospedado no Storage. Alternativa ao video_url (YouTube/Vimeo).';

-- ---------- 2) AVALIAÇÕES E NOTAS ----------
CREATE TABLE IF NOT EXISTS avaliacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'prova' CHECK (tipo IN ('prova','trabalho','participacao','outro')),
  peso NUMERIC(5,2) NOT NULL DEFAULT 1,
  nota_maxima NUMERIC(5,2) NOT NULL DEFAULT 10,
  data DATE,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_turma ON avaliacoes(turma_id);

CREATE TABLE IF NOT EXISTS notas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avaliacao_id UUID NOT NULL REFERENCES avaliacoes(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  valor NUMERIC(5,2),
  observacao TEXT,
  lancada_por UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(avaliacao_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS idx_notas_aluno ON notas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_notas_avaliacao ON notas(avaliacao_id);

-- ---------- 3) ATIVIDADES E ENTREGAS ----------
CREATE TABLE IF NOT EXISTS atividades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prazo DATE,
  nota_maxima NUMERIC(5,2) NOT NULL DEFAULT 10,
  aceita_arquivo BOOLEAN NOT NULL DEFAULT TRUE,
  publicada BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atividades_turma ON atividades(turma_id);

CREATE TABLE IF NOT EXISTS entregas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  atividade_id UUID NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  texto TEXT,
  arquivo_path TEXT,
  arquivo_nome TEXT,
  entregue_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  nota NUMERIC(5,2),
  feedback TEXT,
  corrigida_em TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(atividade_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS idx_entregas_aluno ON entregas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_entregas_atividade ON entregas(atividade_id);

-- ---------- 4) RESUMO DA AULA PELO ALUNO ----------
CREATE TABLE IF NOT EXISTS resumos_aula (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aula_id UUID NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  enviado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  feedback TEXT,
  lido BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(aula_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS idx_resumos_aluno ON resumos_aula(aluno_id);
CREATE INDEX IF NOT EXISTS idx_resumos_aula ON resumos_aula(aula_id);

-- ---------- 5) RLS ----------
ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumos_aula ENABLE ROW LEVEL SECURITY;

-- Função auxiliar: a pessoa leciona nesta turma?
CREATE OR REPLACE FUNCTION leciona_turma(p_turma UUID)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM turmas WHERE id = p_turma AND professor_id = auth.uid());
$$;

-- Função auxiliar: a pessoa é aluno matriculado nesta turma?
CREATE OR REPLACE FUNCTION matriculado_turma(p_turma UUID)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM turma_alunos WHERE turma_id = p_turma AND aluno_id = auth.uid()
  );
$$;

-- AVALIAÇÕES
CREATE POLICY "Admins gerenciam avaliacoes" ON avaliacoes
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Professores gerenciam avaliacoes de suas turmas" ON avaliacoes
  FOR ALL USING (leciona_turma(turma_id)) WITH CHECK (leciona_turma(turma_id));
CREATE POLICY "Alunos veem avaliacoes de sua turma" ON avaliacoes
  FOR SELECT USING (matriculado_turma(turma_id));

-- NOTAS
CREATE POLICY "Admins gerenciam notas" ON notas
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Professores gerenciam notas de suas turmas" ON notas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM avaliacoes a WHERE a.id = notas.avaliacao_id AND leciona_turma(a.turma_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM avaliacoes a WHERE a.id = notas.avaliacao_id AND leciona_turma(a.turma_id))
  );
CREATE POLICY "Aluno ve a propria nota" ON notas
  FOR SELECT USING (auth.uid() = aluno_id);

-- ATIVIDADES
CREATE POLICY "Admins gerenciam atividades" ON atividades
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Professores gerenciam atividades de suas turmas" ON atividades
  FOR ALL USING (leciona_turma(turma_id)) WITH CHECK (leciona_turma(turma_id));
CREATE POLICY "Alunos veem atividades publicadas de sua turma" ON atividades
  FOR SELECT USING (publicada = TRUE AND matriculado_turma(turma_id));

-- ENTREGAS
CREATE POLICY "Admins gerenciam entregas" ON entregas
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Professores veem e corrigem entregas de suas turmas" ON entregas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM atividades a WHERE a.id = entregas.atividade_id AND leciona_turma(a.turma_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM atividades a WHERE a.id = entregas.atividade_id AND leciona_turma(a.turma_id))
  );
CREATE POLICY "Aluno gerencia a propria entrega" ON entregas
  FOR ALL USING (auth.uid() = aluno_id) WITH CHECK (auth.uid() = aluno_id);

-- RESUMOS
CREATE POLICY "Admins veem resumos" ON resumos_aula
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Aluno gerencia o proprio resumo" ON resumos_aula
  FOR ALL USING (auth.uid() = aluno_id) WITH CHECK (auth.uid() = aluno_id);
CREATE POLICY "Professor le resumos de seus cursos" ON resumos_aula
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM aulas a JOIN turmas t ON t.curso_id = a.curso_id
      WHERE a.id = resumos_aula.aula_id AND t.professor_id = auth.uid()
    )
  );

-- ---------- 6) STORAGE ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('aulas', 'aulas', TRUE) ON CONFLICT (id) DO UPDATE SET public = TRUE;

INSERT INTO storage.buckets (id, name, public)
VALUES ('entregas', 'entregas', FALSE) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Leitura publica dos videos de aula" ON storage.objects;
CREATE POLICY "Leitura publica dos videos de aula"
  ON storage.objects FOR SELECT USING (bucket_id = 'aulas');

DROP POLICY IF EXISTS "Equipe envia videos de aula" ON storage.objects;
CREATE POLICY "Equipe envia videos de aula"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'aulas' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Equipe remove videos de aula" ON storage.objects;
CREATE POLICY "Equipe remove videos de aula"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'aulas' AND auth.uid() IS NOT NULL);

-- Entregas são privadas: cada aluno só acessa a própria pasta
DROP POLICY IF EXISTS "Aluno envia a propria entrega" ON storage.objects;
CREATE POLICY "Aluno envia a propria entrega"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'entregas' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Leitura das entregas por dono e equipe" ON storage.objects;
CREATE POLICY "Leitura das entregas por dono e equipe"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'entregas' AND auth.uid() IS NOT NULL);
