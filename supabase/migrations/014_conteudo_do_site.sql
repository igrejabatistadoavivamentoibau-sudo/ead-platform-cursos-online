-- 014: Conteúdo editável da página inicial. (Já aplicada no banco.)
-- Cada seção é um BLOCO, não uma coluna: assim a liderança cria seções
-- (história, missão, depoimentos) com texto e foto, sem alterar o sistema.
CREATE TABLE IF NOT EXISTS blocos_site (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chave TEXT UNIQUE,
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  texto TEXT,
  imagem_path TEXT,
  layout TEXT NOT NULL DEFAULT 'texto_imagem'
    CHECK (layout IN ('texto_imagem','imagem_texto','texto_centralizado','destaque')),
  ordem INTEGER NOT NULL DEFAULT 0,
  publicado BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blocos_site_ordem ON blocos_site(ordem);

ALTER TABLE blocos_site ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins gerenciam blocos" ON blocos_site;
CREATE POLICY "Admins gerenciam blocos" ON blocos_site
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Qualquer um le blocos publicados" ON blocos_site;
CREATE POLICY "Qualquer um le blocos publicados" ON blocos_site
  FOR SELECT USING (publicado = TRUE);

INSERT INTO storage.buckets (id, name, public)
VALUES ('site', 'site', TRUE) ON CONFLICT (id) DO UPDATE SET public = TRUE;
