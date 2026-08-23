-- ============================================================
-- 025 — LOJA, PAGAMENTOS E MATERIAIS DA AULA
--
-- Três coisas que entram juntas porque se apoiam:
--   • os PRODUTOS da IBAU (livros, apostilas), editáveis pela coordenação;
--   • a REGRA DE PAGAMENTO (parcelas sem juros, desconto à vista), num
--     painel só, valendo para tudo — com exceção por produto quando
--     precisar;
--   • os MATERIAIS COMPLEMENTARES da aula, que a turma presencial pediu.
--
-- DINHEIRO É GUARDADO EM CENTAVOS, SEMPRE, E COMO NÚMERO INTEIRO.
-- Preço em decimal parece mais natural e é a origem clássica do erro de
-- um centavo: 0,1 + 0,2 não dá 0,3 em nenhum computador. Somando parcela
-- por parcela, esse centavo aparece na conta de alguém — e ninguém
-- descobre por que a soma não fecha. Com inteiro, não existe o problema.
--
-- O PAGAMENTO EM SI AINDA NÃO ESTÁ LIGADO. Falta a chave do Asaas. Tudo
-- aqui foi feito para que ligar seja só preencher a chave: as colunas do
-- provedor já existem, e o pedido já nasce com o valor, o meio e o número
-- de parcelas fechados.
-- ============================================================

-- ------------------------------------------------------------
-- A REGRA DE PAGAMENTO
--
-- Uma linha marcada como `geral` vale para a loja inteira. As outras são
-- exceções que um produto específico aponta. Guardar isso como DADO, e
-- não como número escrito no código, é o que permite a coordenação mudar
-- "3x sem juros" para "6x sem juros" sem me acionar.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS politicas_de_pagamento (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome                  TEXT NOT NULL,
  /* Exatamente UMA linha pode ser a geral (índice único mais abaixo). */
  geral                 BOOLEAN NOT NULL DEFAULT FALSE,

  parcelas_sem_juros    INT NOT NULL DEFAULT 1 CHECK (parcelas_sem_juros BETWEEN 1 AND 24),
  parcelas_max          INT NOT NULL DEFAULT 1 CHECK (parcelas_max BETWEEN 1 AND 24),
  /* Acima do "sem juros", quanto se cobra por mês. Zero = não parcela além. */
  juros_ao_mes_pct      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (juros_ao_mes_pct >= 0),

  desconto_avista_pct   NUMERIC(5,2) NOT NULL DEFAULT 0
                        CHECK (desconto_avista_pct >= 0 AND desconto_avista_pct <= 90),
  /* Ninguém parcela um livro de R$ 40 em 12x de R$ 3,33. */
  parcela_minima_centavos INT NOT NULL DEFAULT 2000 CHECK (parcela_minima_centavos >= 0),

  aceita_pix            BOOLEAN NOT NULL DEFAULT TRUE,
  aceita_boleto         BOOLEAN NOT NULL DEFAULT TRUE,
  aceita_cartao         BOOLEAN NOT NULL DEFAULT TRUE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (parcelas_max >= parcelas_sem_juros)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_politica_geral
  ON politicas_de_pagamento(geral) WHERE geral;

COMMENT ON TABLE politicas_de_pagamento IS
  'Parcelas sem juros, desconto à vista e meios aceitos. A linha `geral` vale para tudo.';

-- A escola nasce com uma regra conservadora: à vista, sem desconto. É o
-- que menos surpreende quem abrir a loja antes de configurar qualquer coisa.
INSERT INTO politicas_de_pagamento (nome, geral, parcelas_sem_juros, parcelas_max)
SELECT 'Regra geral da loja', TRUE, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM politicas_de_pagamento WHERE geral);

-- ------------------------------------------------------------
-- OS PRODUTOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produtos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            TEXT NOT NULL,
  descricao       TEXT,
  categoria       TEXT NOT NULL DEFAULT 'outro'
                  CHECK (categoria IN ('livro', 'apostila', 'vestuario', 'outro')),
  preco_centavos  INT NOT NULL CHECK (preco_centavos >= 0),
  /* NULL = sem controle de estoque (apostila que a gráfica reimprime). */
  estoque         INT CHECK (estoque IS NULL OR estoque >= 0),
  imagem_path     TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  ordem           INT NOT NULL DEFAULT 0,
  /* Exceção à regra geral de pagamento, quando este produto precisar. */
  politica_id     UUID REFERENCES politicas_de_pagamento(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_vitrine ON produtos(ativo, ordem);

COMMENT ON COLUMN produtos.preco_centavos IS 'Em CENTAVOS e inteiro. R$ 49,90 = 4990.';
COMMENT ON COLUMN produtos.estoque IS 'NULL = ilimitado. 0 = esgotado.';

-- ------------------------------------------------------------
-- OS PEDIDOS
--
-- `tipo` existe desde já para o mesmo caminho de pagamento servir à
-- mensalidade da turma quando a escola decidir cobrar por ela. Sem isso,
-- aquele dia significaria uma segunda tela de pagamento — e duas telas de
-- pagamento divergem, é questão de tempo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comprador_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo               TEXT NOT NULL DEFAULT 'loja' CHECK (tipo IN ('loja', 'matricula')),

  status             TEXT NOT NULL DEFAULT 'aguardando_pagamento'
                     CHECK (status IN ('aguardando_pagamento','pago','cancelado','estornado')),

  subtotal_centavos  INT NOT NULL CHECK (subtotal_centavos >= 0),
  desconto_centavos  INT NOT NULL DEFAULT 0 CHECK (desconto_centavos >= 0),
  juros_centavos     INT NOT NULL DEFAULT 0 CHECK (juros_centavos >= 0),
  total_centavos     INT NOT NULL CHECK (total_centavos >= 0),

  meio               TEXT NOT NULL CHECK (meio IN ('pix','boleto','cartao')),
  parcelas           INT NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 24),

  /* O provedor de pagamento. Preenchido quando a cobrança for criada lá. */
  provedor           TEXT NOT NULL DEFAULT 'asaas',
  provedor_cobranca_id TEXT,
  provedor_url       TEXT,

  /* Retirada na secretaria: é assim que o produto chega à pessoa. */
  retirado_em        TIMESTAMPTZ,
  retirado_por       UUID REFERENCES users(id) ON DELETE SET NULL,

  observacao         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pago_em            TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_comprador ON pedidos(comprador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_cobranca
  ON pedidos(provedor, provedor_cobranca_id) WHERE provedor_cobranca_id IS NOT NULL;

-- ------------------------------------------------------------
-- OS ITENS — com o preço CONGELADO no momento da compra.
--
-- Guardar só o `produto_id` e ler o preço da tabela na hora de exibir
-- parece economia. Não é: no dia em que a coordenação corrigir o preço de
-- um livro, TODOS os pedidos antigos passariam a mostrar o valor novo, e
-- o histórico de quanto cada pessoa pagou viraria ficção.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedido_itens (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id              UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id             UUID REFERENCES produtos(id) ON DELETE SET NULL,
  nome                   TEXT NOT NULL,
  preco_unitario_centavos INT NOT NULL CHECK (preco_unitario_centavos >= 0),
  quantidade             INT NOT NULL CHECK (quantidade > 0),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens ON pedido_itens(pedido_id);

-- ------------------------------------------------------------
-- O QUE O PROVEDOR CONTOU
--
-- Cada aviso recebido vira uma linha, com o corpo inteiro guardado. Isso
-- é o que permite descobrir, meses depois, por que um pedido ficou com o
-- status que ficou — sem depender de o provedor ainda ter o registro.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagamento_eventos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id    UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  provedor     TEXT NOT NULL DEFAULT 'asaas',
  evento       TEXT,
  cobranca_id  TEXT,
  corpo        JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagamento_eventos ON pagamento_eventos(pedido_id, created_at DESC);

-- ------------------------------------------------------------
-- MATERIAIS COMPLEMENTARES DA AULA
--
-- A turma presencial pediu vídeo aula E material de apoio. O vídeo já
-- existia; o material de apoio é isto. Fica pendurado na AULA, e não na
-- turma, porque o material é do conteúdo — todas as turmas daquele módulo
-- recebem o mesmo, e ninguém precisa reenviar a cada turma nova.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materiais (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aula_id     UUID NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  tipo        TEXT NOT NULL DEFAULT 'arquivo' CHECK (tipo IN ('arquivo', 'link')),
  /* Um dos dois, conforme o tipo. */
  path        TEXT,
  url         TEXT,
  tamanho     INT,
  formato     TEXT,
  ordem       INT NOT NULL DEFAULT 0,
  publicado   BOOLEAN NOT NULL DEFAULT TRUE,
  enviado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK ((tipo = 'arquivo' AND path IS NOT NULL) OR (tipo = 'link' AND url IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_materiais_aula ON materiais(aula_id, ordem);

-- ============================================================
-- QUEM PODE VER E MEXER
-- ============================================================

-- Quem dá aula. Existia a mesma pergunta espalhada em várias regras; aqui
-- ela vira uma função só, para as regras dizerem o que querem dizer.
CREATE OR REPLACE FUNCTION e_professor()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
     WHERE id = auth.uid() AND role IN ('professor', 'admin') AND ativo
  );
$$;
ALTER TABLE politicas_de_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamento_eventos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais             ENABLE ROW LEVEL SECURITY;

-- A vitrine e as condições de pagamento: qualquer pessoa logada lê.
DROP POLICY IF EXISTS produtos_leitura ON produtos;
CREATE POLICY produtos_leitura ON produtos FOR SELECT
  USING (auth.uid() IS NOT NULL AND (ativo OR is_admin()));

DROP POLICY IF EXISTS produtos_admin ON produtos;
CREATE POLICY produtos_admin ON produtos FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS politicas_leitura ON politicas_de_pagamento;
CREATE POLICY politicas_leitura ON politicas_de_pagamento FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS politicas_admin ON politicas_de_pagamento;
CREATE POLICY politicas_admin ON politicas_de_pagamento FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- Pedido: cada um enxerga o seu; a coordenação enxerga todos.
DROP POLICY IF EXISTS pedidos_meus ON pedidos;
CREATE POLICY pedidos_meus ON pedidos FOR SELECT
  USING (comprador_id = auth.uid() OR is_admin());

/* Escrever pedido é SÓ pelo servidor. Se a pessoa pudesse inserir a
   própria linha, ela escolheria o total — e um pedido de mil reais viraria
   um pedido de um real pelo console do navegador. O servidor recalcula o
   valor a partir do preço que está no banco, nunca a partir do que o
   navegador mandou. */
DROP POLICY IF EXISTS pedidos_servidor ON pedidos;
CREATE POLICY pedidos_servidor ON pedidos FOR ALL
  USING (e_o_servidor() OR is_admin()) WITH CHECK (e_o_servidor() OR is_admin());

DROP POLICY IF EXISTS itens_meus ON pedido_itens;
CREATE POLICY itens_meus ON pedido_itens FOR SELECT
  USING (EXISTS (SELECT 1 FROM pedidos p
                  WHERE p.id = pedido_id AND (p.comprador_id = auth.uid() OR is_admin())));

DROP POLICY IF EXISTS itens_servidor ON pedido_itens;
CREATE POLICY itens_servidor ON pedido_itens FOR ALL
  USING (e_o_servidor() OR is_admin()) WITH CHECK (e_o_servidor() OR is_admin());

DROP POLICY IF EXISTS eventos_servidor ON pagamento_eventos;
CREATE POLICY eventos_servidor ON pagamento_eventos FOR ALL
  USING (e_o_servidor() OR is_admin()) WITH CHECK (e_o_servidor() OR is_admin());

-- Material: quem pode ver a aula, pode ver o material dela.
DROP POLICY IF EXISTS materiais_leitura ON materiais;
CREATE POLICY materiais_leitura ON materiais FOR SELECT
  USING (auth.uid() IS NOT NULL AND (publicado OR is_admin() OR e_professor()));

DROP POLICY IF EXISTS materiais_escrita ON materiais;
CREATE POLICY materiais_escrita ON materiais FOR ALL
  USING (is_admin() OR e_professor() OR e_o_servidor())
  WITH CHECK (is_admin() OR e_professor() OR e_o_servidor());

-- ------------------------------------------------------------
-- O TOTAL DO PEDIDO TEM QUE FECHAR COM OS ITENS
--
-- Rede de baixo contra o erro de programação mais caro que existe aqui: um
-- pedido cobrado por um valor que não corresponde ao que foi comprado.
-- Confere na hora em que o pedido é fechado, e não deixa passar.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION conferir_total_do_pedido()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_soma   INT;
  v_pedido UUID;
BEGIN
  -- Numa exclusão não existe NEW: o pedido a recalcular é o do item que saiu.
  v_pedido := CASE TG_OP WHEN 'DELETE' THEN OLD.pedido_id ELSE NEW.pedido_id END;

  SELECT COALESCE(SUM(preco_unitario_centavos * quantidade), 0) INTO v_soma
    FROM pedido_itens WHERE pedido_id = v_pedido;

  UPDATE pedidos
     SET subtotal_centavos = v_soma,
         total_centavos = GREATEST(v_soma - desconto_centavos + juros_centavos, 0),
         updated_at = NOW()
   WHERE id = v_pedido;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_conferir_total_do_pedido ON pedido_itens;
CREATE TRIGGER trg_conferir_total_do_pedido
  AFTER INSERT OR UPDATE OR DELETE ON pedido_itens
  FOR EACH ROW EXECUTE FUNCTION conferir_total_do_pedido();

COMMENT ON FUNCTION conferir_total_do_pedido() IS
  'O total do pedido é sempre a soma dos itens menos o desconto. Recalculado no banco.';
