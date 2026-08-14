-- ============================================================
-- 003: Slides do carrossel da página inicial
-- O admin gerencia as fotos pelo próprio painel (upload + ordem)
--
-- Esta migração já foi aplicada diretamente no projeto Supabase de
-- produção. Este arquivo existe para manter o histórico do schema
-- versionado junto com o código.
-- ============================================================

CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT,
  image_path TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slides_ordem ON slides(ordem);
CREATE INDEX IF NOT EXISTS idx_slides_ativo ON slides(ativo);

ALTER TABLE slides ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante (inclusive não logado) pode ver os slides ativos,
-- pois eles aparecem na página inicial pública.
CREATE POLICY "Todos veem slides ativos" ON slides FOR SELECT USING (ativo = TRUE);

-- Só o admin cria/edita/remove
CREATE POLICY "Admins gerenciam slides" ON slides FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Bucket público de storage para as fotos do carrossel
INSERT INTO storage.buckets (id, name, public)
VALUES ('carrossel', 'carrossel', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- Leitura pública das imagens do bucket
DROP POLICY IF EXISTS "Leitura publica do carrossel" ON storage.objects;
CREATE POLICY "Leitura publica do carrossel"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'carrossel');

-- Escrita apenas por admins
DROP POLICY IF EXISTS "Admins enviam fotos do carrossel" ON storage.objects;
CREATE POLICY "Admins enviam fotos do carrossel"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'carrossel' AND is_admin());

DROP POLICY IF EXISTS "Admins atualizam fotos do carrossel" ON storage.objects;
CREATE POLICY "Admins atualizam fotos do carrossel"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'carrossel' AND is_admin());

DROP POLICY IF EXISTS "Admins removem fotos do carrossel" ON storage.objects;
CREATE POLICY "Admins removem fotos do carrossel"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'carrossel' AND is_admin());
