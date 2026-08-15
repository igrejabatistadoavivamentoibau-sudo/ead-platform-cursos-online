-- ============================================================
-- 004: Vídeo aulas, progresso do aluno, permissões granulares
--      e sincronização do papel dentro do token de sessão (JWT)
--
-- Já aplicada no projeto Supabase de produção. Este arquivo mantém o
-- histórico do schema versionado junto com o código.
-- ============================================================

-- ---------- 1) PERMISSÕES GRANULARES ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissoes JSONB;

COMMENT ON COLUMN users.permissoes IS
  'Permissões específicas desta pessoa. NULL = usar o padrão do papel.';

-- ---------- 2) AULAS (vídeo aulas de uma turma) ----------
CREATE TABLE IF NOT EXISTS aulas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  video_url TEXT,
  duracao_minutos INTEGER,
  publicada BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(turma_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_aulas_turma_id ON aulas(turma_id);
CREATE INDEX IF NOT EXISTS idx_aulas_numero ON aulas(turma_id, numero);

-- ---------- 3) PROGRESSO DO ALUNO EM CADA AULA ----------
CREATE TABLE IF NOT EXISTS aula_progresso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aula_id UUID NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concluida BOOLEAN NOT NULL DEFAULT FALSE,
  percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  concluida_em TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(aula_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS idx_aula_progresso_aluno ON aula_progresso(aluno_id);
CREATE INDEX IF NOT EXISTS idx_aula_progresso_aula ON aula_progresso(aula_id);

-- ---------- 4) RLS ----------
ALTER TABLE aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE aula_progresso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam aulas das turmas" ON aulas
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Professores gerenciam aulas de suas turmas" ON aulas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM turmas WHERE turmas.id = aulas.turma_id AND turmas.professor_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM turmas WHERE turmas.id = aulas.turma_id AND turmas.professor_id = auth.uid())
  );

CREATE POLICY "Alunos veem aulas publicadas de sua turma" ON aulas
  FOR SELECT USING (
    publicada = TRUE
    AND EXISTS (
      SELECT 1 FROM turma_alunos
      WHERE turma_alunos.turma_id = aulas.turma_id
        AND turma_alunos.aluno_id = auth.uid()
    )
  );

CREATE POLICY "Admins veem todo progresso" ON aula_progresso
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Aluno gerencia o proprio progresso" ON aula_progresso
  FOR ALL USING (auth.uid() = aluno_id) WITH CHECK (auth.uid() = aluno_id);

CREATE POLICY "Professor ve progresso de suas turmas" ON aula_progresso
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM aulas JOIN turmas ON turmas.id = aulas.turma_id
      WHERE aulas.id = aula_progresso.aula_id AND turmas.professor_id = auth.uid()
    )
  );

-- ---------- 5) PAPEL DENTRO DO TOKEN (PERFORMANCE) ----------
-- Copia o papel para o app_metadata do Auth. Assim o token de sessão já
-- carrega o papel e o servidor não precisa consultar o banco a cada
-- navegação só para saber se a pessoa é aluno, professor ou admin.
CREATE OR REPLACE FUNCTION sincronizar_papel_no_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_papel ON users;
CREATE TRIGGER trg_sincronizar_papel
  AFTER INSERT OR UPDATE OF role ON users
  FOR EACH ROW EXECUTE FUNCTION sincronizar_papel_no_token();

-- Backfill: coloca o papel no token de quem já existe
UPDATE auth.users au
SET raw_app_meta_data =
  COALESCE(au.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', u.role)
FROM public.users u
WHERE u.id = au.id;
