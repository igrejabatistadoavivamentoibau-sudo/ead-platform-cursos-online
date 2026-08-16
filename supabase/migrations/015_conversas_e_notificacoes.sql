-- 015: Conversas por turma e central de notificações. (Já aplicada.)
-- Cada turma é um canal; membros = alunos matriculados, professor e admins.
-- Aviso do professor vira notificação por gatilho no banco.
-- Ver o arquivo aplicado no Supabase para o conteúdo completo.
CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  autor_nome TEXT NOT NULL,
  autor_papel TEXT NOT NULL DEFAULT 'aluno',
  texto TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 2000),
  aviso BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mensagens_turma_data ON mensagens(turma_id, created_at DESC);
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros leem mensagens da turma" ON mensagens;
CREATE POLICY "Membros leem mensagens da turma" ON mensagens
  FOR SELECT USING (is_admin() OR leciona_turma(turma_id) OR matriculado_turma(turma_id));
DROP POLICY IF EXISTS "Membros escrevem na turma" ON mensagens;
CREATE POLICY "Membros escrevem na turma" ON mensagens
  FOR INSERT WITH CHECK (
    autor_id = auth.uid()
    AND (is_admin() OR leciona_turma(turma_id) OR matriculado_turma(turma_id))
    AND (aviso = FALSE OR is_admin() OR leciona_turma(turma_id))
  );
DROP POLICY IF EXISTS "Autor apaga a propria mensagem" ON mensagens;
CREATE POLICY "Autor apaga a propria mensagem" ON mensagens
  FOR DELETE USING (autor_id = auth.uid() OR is_admin());

CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  corpo TEXT,
  tipo TEXT NOT NULL DEFAULT 'geral'
    CHECK (tipo IN ('geral','aviso_turma','novidade','inscricao','nota','atualizacao')),
  link TEXT,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON notificacoes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_nao_lidas ON notificacoes(user_id) WHERE lida = FALSE;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cada um gerencia as proprias notificacoes" ON notificacoes;
CREATE POLICY "Cada um gerencia as proprias notificacoes" ON notificacoes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION notificar_aviso_da_turma()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nome_turma TEXT;
BEGIN
  IF NEW.aviso IS NOT TRUE THEN RETURN NEW; END IF;
  SELECT nome INTO v_nome_turma FROM turmas WHERE id = NEW.turma_id;
  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link)
  SELECT ta.aluno_id,
         'Aviso de ' || NEW.autor_nome || ' — ' || COALESCE(v_nome_turma, 'sua turma'),
         LEFT(NEW.texto, 300), 'aviso_turma',
         '/dashboard/aluno/conversas?turma=' || NEW.turma_id
  FROM turma_alunos ta
  WHERE ta.turma_id = NEW.turma_id AND ta.aluno_id <> NEW.autor_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_aviso_turma ON mensagens;
CREATE TRIGGER trg_aviso_turma
  AFTER INSERT ON mensagens
  FOR EACH ROW EXECUTE FUNCTION notificar_aviso_da_turma();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mensagens;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
