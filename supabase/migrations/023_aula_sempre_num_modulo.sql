-- ============================================================
-- 023 — TODA AULA NASCE DENTRO DE UM MÓDULO
--
-- O QUE ESTAVA ERRADO
-- A migração 022 pôs a aula dentro do módulo e passou a numerar por
-- módulo. Mas as duas portas por onde uma aula entra no sistema
-- (`criarAula` e `registrarAulaEnviada`) continuaram gravando só o
-- `curso_id`, sem módulo, e numerando pelo CURSO inteiro.
--
-- O efeito era calado, que é o pior tipo: a aula era criada, aparecia na
-- lista do professor, e simplesmente NÃO EXISTIA para o aluno — porque a
-- tela dele agora monta o curso a partir dos módulos. Ninguém veria erro
-- nenhum; veria uma aula que "sumiu".
--
-- As duas actions foram corrigidas (agora o professor escolhe o módulo).
-- Este gatilho é a rede de baixo: garante a regra mesmo que amanhã apareça
-- um terceiro caminho de inserção — uma importação, um script, uma tela
-- nova. Regra que mora só no código do aplicativo é regra que a próxima
-- tela esquece.
-- ============================================================

CREATE OR REPLACE FUNCTION aula_entra_num_modulo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_curso  UUID;
  v_modulo UUID;
BEGIN
  -- Quem manda é o módulo, quando ele veio. Só usamos o curso para
  -- descobrir o módulo quando ele NÃO veio.
  IF NEW.modulo_id IS NULL THEN
    v_curso := NEW.curso_id;

    SELECT id INTO v_modulo
      FROM modulos WHERE curso_id = v_curso
     ORDER BY ordem, created_at LIMIT 1;

    -- Curso sem módulo nenhum não deveria existir (022 faz todo curso
    -- nascer com o "Módulo 1"), mas um curso criado ANTES daquela
    -- migração, por um caminho que não passou pelo gatilho, deixaria a
    -- aula órfã de novo. Então criamos o módulo em vez de recusar: o
    -- objetivo aqui é nunca perder uma aula.
    IF v_modulo IS NULL THEN
      INSERT INTO modulos (curso_id, nome, ordem)
      VALUES (v_curso, 'Módulo 1', 1)
      RETURNING id INTO v_modulo;
    END IF;

    NEW.modulo_id := v_modulo;
  END IF;

  -- A numeração é por módulo. Se veio vazia, ou se colide com uma aula
  -- que já está lá, recalculamos — em vez de deixar o índice único
  -- derrubar a criação na cara de quem está cadastrando.
  IF NEW.numero IS NULL
     OR EXISTS (SELECT 1 FROM aulas
                 WHERE modulo_id = NEW.modulo_id
                   AND numero = NEW.numero
                   AND id IS DISTINCT FROM NEW.id) THEN
    SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
      FROM aulas WHERE modulo_id = NEW.modulo_id;
  END IF;

  RETURN NEW;
END;
$$;

-- O nome vem antes de `trg_espelhar_curso_aulas` no alfabeto de propósito:
-- o Postgres dispara os gatilhos BEFORE em ordem alfabética, e este aqui
-- precisa resolver o módulo ANTES daquele copiar o curso a partir dele.
DROP TRIGGER IF EXISTS trg_aula_entra_num_modulo ON aulas;
CREATE TRIGGER trg_aula_entra_num_modulo
  BEFORE INSERT ON aulas
  FOR EACH ROW EXECUTE FUNCTION aula_entra_num_modulo();

-- ------------------------------------------------------------
-- Conserto do que já foi criado sem módulo entre a 022 e hoje.
-- Cada aula órfã entra no primeiro módulo do curso dela, no fim da fila.
-- ------------------------------------------------------------
WITH orfas AS (
  SELECT a.id,
         (SELECT m.id FROM modulos m
           WHERE m.curso_id = a.curso_id
           ORDER BY m.ordem, m.created_at LIMIT 1) AS modulo_id,
         ROW_NUMBER() OVER (PARTITION BY a.curso_id ORDER BY a.numero, a.created_at) AS fila
    FROM aulas a
   WHERE a.modulo_id IS NULL
),
base AS (
  SELECT o.modulo_id, COALESCE(MAX(a.numero), 0) AS ultimo
    FROM orfas o LEFT JOIN aulas a ON a.modulo_id = o.modulo_id
   WHERE o.modulo_id IS NOT NULL
   GROUP BY o.modulo_id
)
UPDATE aulas a
   SET modulo_id = o.modulo_id,
       numero    = b.ultimo + o.fila,
       updated_at = NOW()
  FROM orfas o JOIN base b ON b.modulo_id = o.modulo_id
 WHERE a.id = o.id AND o.modulo_id IS NOT NULL;

COMMENT ON FUNCTION aula_entra_num_modulo() IS
  'Rede de baixo: nenhuma aula fica fora de um módulo, e a numeração é sempre por módulo.';
