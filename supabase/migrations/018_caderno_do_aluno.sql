-- 018: o caderno do aluno. (Já aplicada.)
--
-- O QUE ELE NÃO É
-- Já existe `resumos_aula`: o que o aluno escreve PARA O PROFESSOR ler. São
-- coisas diferentes e não podiam morar na mesma tabela. O caderno é a
-- margem do livro, o rabisco de quem está aprendendo — ninguém corrige e
-- ninguém dá nota. Misturar os dois faria o aluno escrever pensando em quem
-- vai ler, e um caderno assim deixa de ser caderno.
--
-- O CONTEÚDO É JSONB, NÃO HTML
-- O editor guarda a estrutura (parágrafo, título, item de lista, trecho
-- grifado) em vez do HTML pronto. Duas razões: o dia em que a aparência do
-- caderno mudar, as anotações antigas mudam junto; e texto estruturado não
-- carrega código dentro, então nada que um aluno escreva pode virar
-- comportamento na tela de outra pessoa.

CREATE TABLE IF NOT EXISTS caderno_paginas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aula_id UUID REFERENCES aulas(id) ON DELETE SET NULL,
  curso_id UUID REFERENCES cursos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL DEFAULT 'Sem título' CHECK (char_length(titulo) <= 200),
  conteudo JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  resumo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_caderno_uma_por_aula
  ON caderno_paginas (user_id, aula_id) WHERE aula_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_caderno_pessoa
  ON caderno_paginas (user_id, updated_at DESC);

ALTER TABLE caderno_paginas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cada um cuida do proprio caderno" ON caderno_paginas;
CREATE POLICY "Cada um cuida do proprio caderno" ON caderno_paginas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE caderno_paginas IS
  'Caderno particular do aluno. Ninguém além do dono lê — nem a liderança.';
