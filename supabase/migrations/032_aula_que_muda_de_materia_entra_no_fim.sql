-- ============================================================
-- AULA QUE MUDA DE MATÉRIA ENTRA NO FIM DA FILA DE LÁ
--
-- ACHADO POR TESTE, NO BANCO DE PRODUÇÃO, NÃO POR LEITURA.
--
-- A prova era simples: três aulas na matéria automática (1, 2, 3), uma
-- matéria "Bibliologia" nova e vazia, e a "Aula 3" mudando para ela.
-- Esperado: virar a Aula 1 de Bibliologia. O que aconteceu: continuou
-- Aula 3 — sozinha, numa matéria vazia, começando no três.
--
-- POR QUÊ
--
-- O gatilho da 030 só renumerava em dois casos: quando o número vinha
-- vazio, ou quando o número já estava OCUPADO no destino. Uma matéria
-- vazia não ocupa nada, então o 3 passava.
--
-- Isso não é um detalhe de estética. A conversão de um curso antigo —
-- que é justamente o pedido "os cursos já criados precisam ser editáveis"
-- — move aulas de uma matéria para outra o tempo todo. Uma matéria nova
-- que começa na "Aula 7" faz a escola achar que faltam seis aulas.
--
-- A CORREÇÃO
--
-- Quando a aula MUDA de matéria (ou de módulo), ela sempre entra no fim
-- da fila do destino. Nos outros casos nada muda: número informado e
-- livre continua sendo respeitado, e a criação continua numerando
-- sozinha.
--
-- O QUE ESTA MIGRAÇÃO NÃO FAZ, DE PROPÓSITO
--
-- Não compacta a numeração da matéria de ORIGEM. Tirar a Aula 2 de um
-- bloco de cinco deixa 1, 3, 4, 5 — e renumerar as três de baixo mudaria
-- o número de aulas que a escola já citou em avisos e no plano de ensino.
-- Na conversão de verdade isso nem aparece: as aulas saem todas juntas e
-- a matéria de origem fica vazia.
-- ============================================================

CREATE OR REPLACE FUNCTION public.aula_entra_numa_disciplina()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_modulo     UUID;
  v_disciplina UUID;
  v_pela_disc  BOOLEAN;
  v_mudou      BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.disciplina_id IS DISTINCT FROM OLD.disciplina_id AND NEW.disciplina_id IS NOT NULL THEN
      v_pela_disc := TRUE;
      v_mudou := TRUE;
    ELSIF NEW.modulo_id IS DISTINCT FROM OLD.modulo_id AND NEW.modulo_id IS NOT NULL THEN
      v_pela_disc := FALSE;
      v_mudou := TRUE;
      NEW.disciplina_id := NULL;   -- será reescolhida no módulo novo
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    v_pela_disc := NEW.disciplina_id IS NOT NULL;
  END IF;

  IF v_pela_disc THEN
    SELECT modulo_id INTO v_modulo FROM disciplinas WHERE id = NEW.disciplina_id;
    IF v_modulo IS NULL THEN
      RAISE EXCEPTION 'Disciplina % nao existe.', NEW.disciplina_id;
    END IF;
    NEW.modulo_id := v_modulo;
  ELSE
    v_modulo := NEW.modulo_id;
    IF v_modulo IS NULL THEN
      SELECT id INTO v_modulo FROM modulos
       WHERE curso_id = NEW.curso_id ORDER BY ordem, created_at LIMIT 1;
      IF v_modulo IS NULL THEN
        INSERT INTO modulos (curso_id, nome, ordem)
        VALUES (NEW.curso_id, 'Módulo 1', 1) RETURNING id INTO v_modulo;
      END IF;
      NEW.modulo_id := v_modulo;
    END IF;
    SELECT id INTO v_disciplina FROM disciplinas
     WHERE modulo_id = v_modulo ORDER BY padrao DESC, ordem, created_at LIMIT 1;
    IF v_disciplina IS NULL THEN
      INSERT INTO disciplinas (modulo_id, nome, ordem, padrao)
      VALUES (v_modulo, 'Conteúdo do módulo', 1, TRUE) RETURNING id INTO v_disciplina;
    END IF;
    NEW.disciplina_id := v_disciplina;
  END IF;

  /* O `v_mudou` é a linha nova. Sem ele, uma aula que entra numa matéria
     VAZIA guarda o número que tinha na matéria antiga — e a matéria nova
     nasce começando na "Aula 7". */
  IF v_mudou
     OR NEW.numero IS NULL
     OR EXISTS (SELECT 1 FROM aulas
                 WHERE disciplina_id = NEW.disciplina_id
                   AND numero = NEW.numero
                   AND id IS DISTINCT FROM NEW.id) THEN
    SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
      FROM aulas WHERE disciplina_id = NEW.disciplina_id;
  END IF;

  RETURN NEW;
END;
$function$;
