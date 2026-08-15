-- ============================================================
-- 007: Presença automática nas turmas EAD
-- Quando o aluno conclui uma vídeo aula de um curso EAD, o sistema
-- cria (ou reaproveita) um encontro correspondente àquela aula e
-- registra a presença dele automaticamente.
--
-- Feito por gatilho no banco, e não no código do app, para que a regra
-- valha sempre — inclusive se a conclusão vier por outro caminho.
-- ============================================================

-- Liga o encontro à aula que o gerou, para não duplicar
ALTER TABLE encontros ADD COLUMN IF NOT EXISTS aula_id UUID REFERENCES aulas(id) ON DELETE CASCADE;
ALTER TABLE encontros ADD COLUMN IF NOT EXISTS automatico BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_encontros_turma_aula
  ON encontros(turma_id, aula_id) WHERE aula_id IS NOT NULL;

CREATE OR REPLACE FUNCTION registrar_presenca_ead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_curso_id UUID;
  v_modalidade TEXT;
  v_titulo TEXT;
  v_numero INTEGER;
  v_turma RECORD;
  v_encontro_id UUID;
BEGIN
  -- Só age quando a aula passa a estar concluída
  IF NEW.concluida IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.concluida IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT a.curso_id, a.titulo, a.numero INTO v_curso_id, v_titulo, v_numero
  FROM aulas a WHERE a.id = NEW.aula_id;

  IF v_curso_id IS NULL THEN RETURN NEW; END IF;

  SELECT c.modalidade INTO v_modalidade FROM cursos c WHERE c.id = v_curso_id;

  -- Presença automática é comportamento de curso EAD
  IF v_modalidade IS DISTINCT FROM 'ead' THEN
    RETURN NEW;
  END IF;

  -- Para cada turma deste curso em que o aluno está matriculado
  FOR v_turma IN
    SELECT t.id FROM turmas t
    JOIN turma_alunos ta ON ta.turma_id = t.id
    WHERE t.curso_id = v_curso_id AND ta.aluno_id = NEW.aluno_id
  LOOP
    SELECT e.id INTO v_encontro_id
    FROM encontros e
    WHERE e.turma_id = v_turma.id AND e.aula_id = NEW.aula_id;

    IF v_encontro_id IS NULL THEN
      INSERT INTO encontros (turma_id, aula_id, titulo, data, automatico)
      VALUES (v_turma.id, NEW.aula_id,
              'Aula ' || COALESCE(v_numero::text, '') || ' — ' || COALESCE(v_titulo, 'Vídeo aula'),
              CURRENT_DATE, TRUE)
      RETURNING id INTO v_encontro_id;
    END IF;

    INSERT INTO presencas (encontro_id, aluno_id, presente, observacao)
    VALUES (v_encontro_id, NEW.aluno_id, TRUE, 'Presença automática: vídeo aula concluída')
    ON CONFLICT (encontro_id, aluno_id)
    DO UPDATE SET presente = TRUE, updated_at = NOW();
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_presenca_ead ON aula_progresso;
CREATE TRIGGER trg_presenca_ead
  AFTER INSERT OR UPDATE OF concluida ON aula_progresso
  FOR EACH ROW EXECUTE FUNCTION registrar_presenca_ead();
