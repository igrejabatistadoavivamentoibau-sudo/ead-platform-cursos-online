-- 017: os grifos e as notas de cada pessoa na Bíblia. (Já aplicada.)
--
-- DECISÃO IMPORTANTE: a marcação NÃO guarda a versão.
-- João 3.16 é João 3.16 em qualquer tradução. Se a pessoa grifa lendo a
-- Bíblia Livre e depois abre a Almeida 1911, o grifo tem de estar lá — é a
-- mesma Palavra, só outra roupa. Guardar a versão junto criaria grifos
-- fantasmas que somem quando se troca a tradução.
--
-- O livro é o índice (0 a 65) na ordem canônica, a mesma do arquivo
-- data/biblia/livros.json.

CREATE TABLE IF NOT EXISTS biblia_marcacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  livro SMALLINT NOT NULL CHECK (livro BETWEEN 0 AND 65),
  capitulo SMALLINT NOT NULL CHECK (capitulo >= 1),
  versiculo SMALLINT NOT NULL CHECK (versiculo >= 1),
  cor TEXT CHECK (cor IN ('amarelo','verde','azul','rosa','roxo')),
  nota TEXT CHECK (nota IS NULL OR char_length(nota) <= 4000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, livro, capitulo, versiculo)
);

CREATE INDEX IF NOT EXISTS idx_marcacoes_pessoa_capitulo
  ON biblia_marcacoes (user_id, livro, capitulo);
CREATE INDEX IF NOT EXISTS idx_marcacoes_pessoa_data
  ON biblia_marcacoes (user_id, updated_at DESC);

ALTER TABLE biblia_marcacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cada um cuida das proprias marcacoes" ON biblia_marcacoes;
CREATE POLICY "Cada um cuida das proprias marcacoes" ON biblia_marcacoes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE biblia_marcacoes IS
  'Grifos e anotações pessoais na Bíblia. Valem para todas as traduções.';
