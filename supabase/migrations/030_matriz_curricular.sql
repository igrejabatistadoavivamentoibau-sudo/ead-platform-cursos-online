-- ============================================================
-- 030 — A MATRIZ CURRICULAR: A DISCIPLINA ENTRA ENTRE O MÓDULO E A AULA
--
-- A forma da escola, nas palavras dela:
--
--   Curso
--     Módulo 1
--       Disciplina A  → 10 aulas, cada uma com nome próprio
--       Disciplina B  → 10 aulas
--     Módulo 2
--       ...
--
-- Hoje a aula pendura direto no módulo (022/023). Faltava o degrau do
-- meio — e sem ele, um módulo com duas disciplinas de dez aulas vira uma
-- fila de vinte aulas numeradas de 1 a 20, sem dizer de qual matéria é
-- qual.
--
-- ============================================================
-- A DECISÃO QUE SUSTENTA ESTA MIGRAÇÃO: `aulas.modulo_id` FICA
--
-- É o mesmo padrão que este projeto já usou duas vezes (o `prazo` na 019,
-- o `curso_id` na 022): a coluna antiga continua existindo, preenchida
-- por gatilho a partir da nova.
--
-- Não é preguiça, é o que impede esta migração de virar uma reescrita.
-- Hoje quinze lugares perguntam "quais aulas são deste módulo?" — a tela
-- de aulas da turma, a contagem do painel do professor, o cadeado do
-- vídeo, o aviso de aula nova, a lista de turmas. Todos continuam
-- funcionando sem uma linha alterada, porque a resposta continua estando
-- onde eles procuram.
--
-- Quem manda passa a ser a DISCIPLINA. O módulo vira o espelho dela.
--
-- ============================================================
-- A OUTRA DECISÃO: TODO MÓDULO TEM PELO MENOS UMA DISCIPLINA
--
-- Um curso simples — três módulos, dez aulas em cada, sem matérias
-- separadas — não pode ser obrigado a inventar uma disciplina para poder
-- cadastrar uma aula. Então todo módulo nasce com uma disciplina
-- automática, marcada com `padrao = true`.
--
-- É essa marca que deixa a TELA decidir: módulo com uma disciplina
-- automática mostra as aulas direto embaixo do módulo, como sempre foi;
-- assim que existe uma segunda disciplina (ou a pessoa dá nome à
-- primeira), o degrau aparece. A estrutura é a mesma para todo mundo; o
-- que muda é o que se mostra.
-- ============================================================


-- ------------------------------------------------------------
-- 1. A TABELA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disciplinas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  modulo_id     UUID NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  descricao     TEXT,
  ordem         INTEGER NOT NULL DEFAULT 1,
  carga_horaria INTEGER,
  /* Nasceu sozinha, para o módulo nunca ficar sem lugar onde pôr aula.
     A tela esconde o degrau enquanto for só esta. */
  padrao        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disciplinas_modulo ON disciplinas(modulo_id, ordem);

COMMENT ON TABLE disciplinas IS
  'Matéria dentro de um módulo. A aula pertence à disciplina; o módulo dela é espelhado em aulas.modulo_id.';
COMMENT ON COLUMN disciplinas.padrao IS
  'TRUE quando nasceu automaticamente com o módulo. A tela esconde o degrau enquanto o módulo tiver só esta.';

ALTER TABLE disciplinas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam disciplinas" ON disciplinas;
CREATE POLICY "Admins gerenciam disciplinas" ON disciplinas
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

/* Leitura ampla, pelo mesmo motivo de `modulos`: a disciplina só tem nome
   e ordem, e a tela do aluno precisa dela para agrupar. O que protege
   conteúdo são as políticas de `aulas` e `turmas`. */
DROP POLICY IF EXISTS "Todos veem disciplinas de cursos publicados" ON disciplinas;
CREATE POLICY "Todos veem disciplinas de cursos publicados" ON disciplinas
  FOR SELECT USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM modulos m
       WHERE m.id = disciplinas.modulo_id
         AND (leciona_curso(m.curso_id)
              OR EXISTS (SELECT 1 FROM cursos c WHERE c.id = m.curso_id AND c.publicado = TRUE))
    )
  );


-- ------------------------------------------------------------
-- 2. A AULA PASSA A PENDURAR NA DISCIPLINA
-- ------------------------------------------------------------
ALTER TABLE aulas ADD COLUMN IF NOT EXISTS disciplina_id UUID REFERENCES disciplinas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_aulas_disciplina ON aulas(disciplina_id);


-- ------------------------------------------------------------
-- 3. TODO MÓDULO QUE JÁ EXISTE GANHA A SUA DISCIPLINA
--    e toda aula que já existe entra nela.
-- ------------------------------------------------------------
INSERT INTO disciplinas (modulo_id, nome, ordem, padrao)
SELECT m.id, 'Conteúdo do módulo', 1, TRUE
  FROM modulos m
 WHERE NOT EXISTS (SELECT 1 FROM disciplinas d WHERE d.modulo_id = m.id);

UPDATE aulas a
   SET disciplina_id = d.id
  FROM disciplinas d
 WHERE a.disciplina_id IS NULL
   AND d.modulo_id = a.modulo_id
   AND d.padrao IS TRUE;


-- ------------------------------------------------------------
-- 4. O MÓDULO NOVO JÁ NASCE COM ONDE PÔR AULA
--
-- Mesmo espírito de `curso_nasce_com_modulo` (022): a estrutura se
-- completa sozinha, e nenhuma tela precisa lembrar de fazer isso.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION modulo_nasce_com_disciplina()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO disciplinas (modulo_id, nome, ordem, padrao)
  VALUES (NEW.id, 'Conteúdo do módulo', 1, TRUE);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_modulo_nasce_com_disciplina ON modulos;
CREATE TRIGGER trg_modulo_nasce_com_disciplina
  AFTER INSERT ON modulos
  FOR EACH ROW EXECUTE FUNCTION modulo_nasce_com_disciplina();


-- ------------------------------------------------------------
-- 5. A REDE DE BAIXO, AGORA COM UM DEGRAU A MAIS
--
-- Substitui `aula_entra_num_modulo` (023). Ela fazia duas coisas: achar o
-- módulo e numerar dentro dele. Agora acha a DISCIPLINA, ESPELHA o módulo
-- a partir dela, e numera dentro da disciplina.
--
-- A NUMERAÇÃO PASSA A SER POR DISCIPLINA, e é o que ela pediu: dez aulas
-- em cada disciplina, cada uma com o seu nome. Numerando por módulo, a
-- segunda disciplina começaria na aula 11 — e "Aula 11 de Bibliologia"
-- não quer dizer nada para ninguém.
--
-- O nome vem antes de `trg_espelhar_curso_aulas` no alfabeto de
-- propósito: os gatilhos BEFORE disparam em ordem alfabética, e este
-- precisa resolver módulo e disciplina ANTES daquele copiar o curso.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION aula_entra_numa_disciplina()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_modulo       UUID;
  v_disciplina   UUID;
  v_pela_disc    BOOLEAN;
BEGIN
  /* QUAL DOS DOIS MANDOU, e por que a pergunta existe.

     Na inserção não há dúvida: se veio disciplina, é ela; senão,
     descobrimos a partir do módulo ou do curso.

     Na ALTERAÇÃO a pergunta é outra e ignorá-la quebra o que já existe:
     "mover a aula de módulo" grava só o `modulo_id`. Se aqui a gente
     sempre espelhasse o módulo a partir da disciplina, a disciplina
     antiga (que ainda está gravada) desfaria a mudança em silêncio — a
     tela diria que moveu e nada teria movido.

     Então: mudou a disciplina, manda a disciplina. Mudou só o módulo,
     manda o módulo e a disciplina é reescolhida. */
  IF TG_OP = 'UPDATE' THEN
    IF NEW.disciplina_id IS DISTINCT FROM OLD.disciplina_id AND NEW.disciplina_id IS NOT NULL THEN
      v_pela_disc := TRUE;
    ELSIF NEW.modulo_id IS DISTINCT FROM OLD.modulo_id AND NEW.modulo_id IS NOT NULL THEN
      v_pela_disc := FALSE;
      NEW.disciplina_id := NULL;   -- será reescolhida no módulo novo
    ELSE
      RETURN NEW;                  -- nada que interesse mudou
    END IF;
  ELSE
    v_pela_disc := NEW.disciplina_id IS NOT NULL;
  END IF;

  IF v_pela_disc THEN
    -- (a) A disciplina manda; o módulo sai espelhado dela.
    SELECT modulo_id INTO v_modulo FROM disciplinas WHERE id = NEW.disciplina_id;
    IF v_modulo IS NULL THEN
      RAISE EXCEPTION 'Disciplina % nao existe.', NEW.disciplina_id;
    END IF;
    NEW.modulo_id := v_modulo;

  ELSE
    -- (b) Sem disciplina: descobrimos o módulo como antes...
    v_modulo := NEW.modulo_id;

    IF v_modulo IS NULL THEN
      SELECT id INTO v_modulo FROM modulos
       WHERE curso_id = NEW.curso_id ORDER BY ordem, created_at LIMIT 1;

      /* Curso sem módulo nenhum não deveria existir. Criamos em vez de
         recusar: o objetivo aqui continua sendo nunca perder uma aula. */
      IF v_modulo IS NULL THEN
        INSERT INTO modulos (curso_id, nome, ordem)
        VALUES (NEW.curso_id, 'Módulo 1', 1) RETURNING id INTO v_modulo;
      END IF;
      NEW.modulo_id := v_modulo;
    END IF;

    -- ...e caímos na disciplina padrão dele.
    SELECT id INTO v_disciplina FROM disciplinas
     WHERE modulo_id = v_modulo ORDER BY padrao DESC, ordem, created_at LIMIT 1;

    IF v_disciplina IS NULL THEN
      INSERT INTO disciplinas (modulo_id, nome, ordem, padrao)
      VALUES (v_modulo, 'Conteúdo do módulo', 1, TRUE) RETURNING id INTO v_disciplina;
    END IF;

    NEW.disciplina_id := v_disciplina;
  END IF;

  -- (c) A numeração, agora dentro da disciplina.
  IF NEW.numero IS NULL
     OR EXISTS (SELECT 1 FROM aulas
                 WHERE disciplina_id = NEW.disciplina_id
                   AND numero = NEW.numero
                   AND id IS DISTINCT FROM NEW.id) THEN
    SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
      FROM aulas WHERE disciplina_id = NEW.disciplina_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION aula_entra_numa_disciplina() IS
  'Rede de baixo: nenhuma aula fica fora de uma disciplina, o modulo_id sai espelhado dela, e a numeração é por disciplina.';

DROP TRIGGER IF EXISTS trg_aula_entra_num_modulo ON aulas;
DROP TRIGGER IF EXISTS trg_aula_entra_numa_disciplina ON aulas;
CREATE TRIGGER trg_aula_entra_numa_disciplina
  BEFORE INSERT OR UPDATE OF disciplina_id, modulo_id ON aulas
  FOR EACH ROW EXECUTE FUNCTION aula_entra_numa_disciplina();

/* A função antiga fica no banco, sem gatilho nenhum apontando para ela.
   Apagar não custa nada hoje e custa caro no dia em que alguém precisar
   ler o que existia antes para entender uma aula antiga. */


-- ------------------------------------------------------------
-- 6. A NUMERAÇÃO ÚNICA MUDA DE DONO
--
-- Ordem importa: o índice novo entra DEPOIS de o passo 3 ter posto toda
-- aula numa disciplina, senão as aulas antigas (todas com
-- disciplina_id nulo) não seriam cobertas — e o índice velho tem de sair
-- DEPOIS, para nunca existir um instante sem trava nenhuma.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_aulas_disciplina_numero
  ON aulas (disciplina_id, numero) WHERE disciplina_id IS NOT NULL;

DROP INDEX IF EXISTS idx_aulas_modulo_numero;
