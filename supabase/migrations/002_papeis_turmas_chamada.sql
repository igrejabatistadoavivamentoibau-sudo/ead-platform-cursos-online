-- ============================================================
-- 002: Padronização de papéis (aluno/professor/admin) +
-- Turmas, Matrículas, Encontros e Presenças (chamada)
--
-- Esta migração já foi aplicada diretamente no projeto Supabase de
-- produção. Este arquivo existe para manter o histórico do schema
-- versionado junto com o código.
-- ============================================================

-- 1) Padroniza os valores de role em português e adiciona 'admin'
UPDATE users SET role = 'aluno' WHERE role IN ('student');
UPDATE users SET role = 'professor' WHERE role IN ('instructor', 'teacher', 'director');

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'aluno';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('aluno', 'professor', 'admin'));

-- 2) Função auxiliar para checar se o usuário logado é admin
-- SECURITY DEFINER evita recursão de RLS ao consultar a própria tabela users
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 3) Tabela de Turmas (cohortes de uma turma/curso, com um professor responsável)
CREATE TABLE IF NOT EXISTS turmas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  descricao TEXT,
  curso_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  professor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'em_andamento', 'encerrada')),
  data_inicio DATE,
  data_fim DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4) Matrículas de alunos em turmas
CREATE TABLE IF NOT EXISTS turma_alunos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'concluido')),
  matriculado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(turma_id, aluno_id)
);

-- 5) Encontros (aulas/sessões de uma turma, usadas para a lista de chamada)
CREATE TABLE IF NOT EXISTS encontros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  titulo TEXT,
  data DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6) Presenças por encontro
CREATE TABLE IF NOT EXISTS presencas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  encontro_id UUID NOT NULL REFERENCES encontros(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  presente BOOLEAN NOT NULL DEFAULT FALSE,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(encontro_id, aluno_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_turmas_professor_id ON turmas(professor_id);
CREATE INDEX IF NOT EXISTS idx_turmas_curso_id ON turmas(curso_id);
CREATE INDEX IF NOT EXISTS idx_turma_alunos_turma_id ON turma_alunos(turma_id);
CREATE INDEX IF NOT EXISTS idx_turma_alunos_aluno_id ON turma_alunos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_encontros_turma_id ON encontros(turma_id);
CREATE INDEX IF NOT EXISTS idx_presencas_encontro_id ON presencas(encontro_id);
CREATE INDEX IF NOT EXISTS idx_presencas_aluno_id ON presencas(aluno_id);

-- RLS
ALTER TABLE turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE turma_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE encontros ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas ENABLE ROW LEVEL SECURITY;

-- USERS: admin tem acesso total (além das policies já existentes de "próprio perfil")
CREATE POLICY "Admins veem todos os perfis" ON users FOR SELECT USING (is_admin());
CREATE POLICY "Admins atualizam qualquer perfil" ON users FOR UPDATE USING (is_admin());
CREATE POLICY "Admins criam perfis" ON users FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins removem perfis" ON users FOR DELETE USING (is_admin());

-- COURSES / LESSONS: admin tem acesso total
CREATE POLICY "Admins gerenciam cursos" ON courses FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins gerenciam aulas" ON lessons FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ENROLLMENTS / PROGRESS / CERTIFICATES / REVIEWS: admin tem acesso total
CREATE POLICY "Admins gerenciam inscricoes" ON enrollments FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins gerenciam progresso" ON progress FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins gerenciam certificados" ON certificates FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins gerenciam reviews" ON reviews FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- TURMAS
CREATE POLICY "Admins gerenciam turmas" ON turmas FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Professores veem suas turmas" ON turmas FOR SELECT USING (auth.uid() = professor_id);
CREATE POLICY "Professores atualizam suas turmas" ON turmas FOR UPDATE USING (auth.uid() = professor_id);
CREATE POLICY "Alunos veem turmas em que estao matriculados" ON turmas FOR SELECT USING (
  EXISTS (SELECT 1 FROM turma_alunos WHERE turma_alunos.turma_id = turmas.id AND turma_alunos.aluno_id = auth.uid())
);

-- TURMA_ALUNOS
CREATE POLICY "Admins gerenciam matriculas" ON turma_alunos FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Professores veem matriculas de suas turmas" ON turma_alunos FOR SELECT USING (
  EXISTS (SELECT 1 FROM turmas WHERE turmas.id = turma_alunos.turma_id AND turmas.professor_id = auth.uid())
);
CREATE POLICY "Alunos veem sua propria matricula" ON turma_alunos FOR SELECT USING (auth.uid() = aluno_id);

-- ENCONTROS
CREATE POLICY "Admins gerenciam encontros" ON encontros FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Professores gerenciam encontros de suas turmas" ON encontros FOR ALL USING (
  EXISTS (SELECT 1 FROM turmas WHERE turmas.id = encontros.turma_id AND turmas.professor_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM turmas WHERE turmas.id = encontros.turma_id AND turmas.professor_id = auth.uid())
);
CREATE POLICY "Alunos veem encontros de sua turma" ON encontros FOR SELECT USING (
  EXISTS (SELECT 1 FROM turma_alunos WHERE turma_alunos.turma_id = encontros.turma_id AND turma_alunos.aluno_id = auth.uid())
);

-- PRESENCAS
CREATE POLICY "Admins gerenciam presencas" ON presencas FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Professores gerenciam presencas de suas turmas" ON presencas FOR ALL USING (
  EXISTS (
    SELECT 1 FROM encontros JOIN turmas ON turmas.id = encontros.turma_id
    WHERE encontros.id = presencas.encontro_id AND turmas.professor_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM encontros JOIN turmas ON turmas.id = encontros.turma_id
    WHERE encontros.id = presencas.encontro_id AND turmas.professor_id = auth.uid()
  )
);
CREATE POLICY "Alunos veem sua propria presenca" ON presencas FOR SELECT USING (auth.uid() = aluno_id);
