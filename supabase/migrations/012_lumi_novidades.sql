-- 012: LUMI — novidades da plataforma. (Já aplicada no banco.)
-- As novidades são cadastradas pela liderança e a LUMI apenas as narra,
-- para não exigir um deploy a cada aviso.
CREATE TABLE IF NOT EXISTS novidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  publico TEXT NOT NULL DEFAULT 'todos'
    CHECK (publico IN ('todos','aluno','professor','admin')),
  tipo TEXT NOT NULL DEFAULT 'novidade'
    CHECK (tipo IN ('novidade','melhoria','correcao','aviso')),
  versao TEXT,
  publicada BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_novidades_data ON novidades(created_at DESC);

ALTER TABLE novidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins gerenciam novidades" ON novidades;
CREATE POLICY "Admins gerenciam novidades" ON novidades
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Todos leem novidades publicadas" ON novidades;
CREATE POLICY "Todos leem novidades publicadas" ON novidades
  FOR SELECT USING (publicada = TRUE AND auth.uid() IS NOT NULL);

-- Marcador: o dia em que a pessoa foi saudada. Fica no banco, não no
-- navegador, para quem usa celular e computador ser saudado uma vez só.
CREATE TABLE IF NOT EXISTS lumi_leitura (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ultima_saudacao DATE,
  ultima_novidade_em TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE lumi_leitura ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cada um gerencia a propria leitura" ON lumi_leitura;
CREATE POLICY "Cada um gerencia a propria leitura" ON lumi_leitura
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
