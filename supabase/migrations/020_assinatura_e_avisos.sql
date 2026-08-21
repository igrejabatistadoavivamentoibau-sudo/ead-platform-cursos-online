-- ============================================================
-- A ASSINATURA ELETRÔNICA E OS DOIS AVISOS QUE FALTAVAM
--
-- Três problemas que são o mesmo problema: ninguém sabia de nada.
--   1. o professor não sabia que tinha chegado trabalho para corrigir;
--   2. o aluno não sabia que a nota tinha saído;
--   3. e quando saía, ele não sabia QUEM corrigiu nem QUANDO.
--
-- Os avisos nascem de gatilho, e não do código do site, por um motivo
-- prático: a entrega é gravada num lugar (ação do aluno) e a correção em
-- outro (ação do professor), e amanhã pode aparecer um terceiro caminho.
-- Regra no banco vale para todos de uma vez, e não depende de ninguém
-- lembrar de chamar a função certa.
-- ============================================================

-- ---------- 1. A assinatura ----------
-- Por que guardar o nome numa coluna própria em vez de usar users.name:
-- o nome muda (casamento, correção de cadastro). A assinatura de um
-- trabalho corrigido em março tem que continuar mostrando o nome de
-- março. Documento assinado não se reescreve depois.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS assinatura_nome   TEXT,
  ADD COLUMN IF NOT EXISTS assinatura_estilo TEXT NOT NULL DEFAULT 'classica',
  ADD COLUMN IF NOT EXISTS assinatura_em     TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT IF EXISTS assinatura_estilo_valido;
ALTER TABLE users ADD CONSTRAINT assinatura_estilo_valido
  CHECK (assinatura_estilo IN ('classica', 'corrente'));

COMMENT ON COLUMN users.assinatura_nome IS
  'Nome completo congelado no momento em que a assinatura foi gerada.';

UPDATE users
   SET assinatura_nome = name,
       assinatura_em   = COALESCE(created_at, NOW())
 WHERE assinatura_nome IS NULL AND name IS NOT NULL;

-- Toda conta nova nasce com a dela. Regra no banco vale para os dois
-- caminhos de criação de usuário (inscrição aprovada e criação direta
-- pelo admin) sem duplicar código — e vale para o próximo que aparecer.
CREATE OR REPLACE FUNCTION assinar_ao_nascer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.assinatura_nome IS NULL AND NEW.name IS NOT NULL THEN
    NEW.assinatura_nome := NEW.name;
    NEW.assinatura_em := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assinar_ao_nascer ON users;
CREATE TRIGGER trg_assinar_ao_nascer
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION assinar_ao_nascer();

-- ---------- 2. Quem corrigiu ----------
-- `entregas` guardava QUANDO foi corrigida, e nunca POR QUEM. Numa turma
-- que troca de professor, ou quando o admin corrige, o aluno recebia uma
-- nota sem dono e sem ter a quem perguntar.
ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS corrigida_por UUID REFERENCES users(id) ON DELETE SET NULL;

-- O gatilho que impede o aluno de mexer na nota precisa cuidar da coluna
-- nova também — senão ele grava o nome de outra pessoa embaixo da
-- própria nota.
CREATE OR REPLACE FUNCTION nota_so_de_quem_corrige()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF e_o_servidor() OR is_admin() THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM atividades a JOIN turmas t ON t.id = a.turma_id
              WHERE a.id = NEW.atividade_id AND t.professor_id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.nota IS DISTINCT FROM OLD.nota
     OR NEW.feedback IS DISTINCT FROM OLD.feedback
     OR NEW.corrigida_em IS DISTINCT FROM OLD.corrigida_em
     OR NEW.corrigida_por IS DISTINCT FROM OLD.corrigida_por THEN
    RAISE EXCEPTION 'Só o professor da turma lança nota e comentário.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION entrega_nasce_sem_nota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF e_o_servidor() OR is_admin() THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM atividades a JOIN turmas t ON t.id = a.turma_id
              WHERE a.id = NEW.atividade_id AND t.professor_id = auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.nota := NULL;
  NEW.feedback := NULL;
  NEW.corrigida_em := NULL;
  NEW.corrigida_por := NULL;
  RETURN NEW;
END;
$$;

-- ---------- 3. Chegou trabalho ----------
CREATE OR REPLACE FUNCTION avisar_entrega_ao_professor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prof UUID; v_turma UUID; v_titulo TEXT; v_aluno TEXT;
BEGIN
  SELECT a.turma_id, a.titulo, t.professor_id
    INTO v_turma, v_titulo, v_prof
    FROM atividades a JOIN turmas t ON t.id = a.turma_id
   WHERE a.id = NEW.atividade_id;

  IF v_prof IS NULL THEN RETURN NEW; END IF;
  -- O professor testando em nome próprio não precisa avisar a si mesmo.
  IF v_prof = NEW.aluno_id THEN RETURN NEW; END IF;

  SELECT name INTO v_aluno FROM users WHERE id = NEW.aluno_id;

  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link)
  VALUES (
    v_prof,
    'Nova entrega para corrigir',
    COALESCE(v_aluno, 'Um aluno') || ' entregou "' || v_titulo || '".',
    'geral',
    '/dashboard/professor/turmas/' || v_turma || '/atividades'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avisar_entrega_ao_professor ON entregas;
CREATE TRIGGER trg_avisar_entrega_ao_professor
  AFTER INSERT ON entregas
  FOR EACH ROW EXECUTE FUNCTION avisar_entrega_ao_professor();

-- ---------- 4. Saiu a nota ----------
CREATE OR REPLACE FUNCTION avisar_correcao_ao_aluno()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_titulo TEXT; v_max NUMERIC; v_quem TEXT;
BEGIN
  -- Só quando a nota realmente aparece ou muda. Salvar duas vezes o mesmo
  -- número não pode gerar dois avisos.
  IF NEW.nota IS NULL OR NEW.nota IS NOT DISTINCT FROM OLD.nota THEN
    RETURN NEW;
  END IF;

  SELECT a.titulo, a.nota_maxima INTO v_titulo, v_max
    FROM atividades a WHERE a.id = NEW.atividade_id;

  SELECT COALESCE(assinatura_nome, name) INTO v_quem
    FROM users WHERE id = NEW.corrigida_por;

  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link)
  VALUES (
    NEW.aluno_id,
    'Sua atividade foi corrigida',
    '"' || v_titulo || '" recebeu nota ' || trim(to_char(NEW.nota, 'FM9999990.09')) ||
      ' de ' || trim(to_char(v_max, 'FM9999990.09')) ||
      COALESCE(', corrigida por ' || v_quem, '') || '.',
    'nota',
    '/dashboard/aluno/atividades'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avisar_correcao_ao_aluno ON entregas;
CREATE TRIGGER trg_avisar_correcao_ao_aluno
  AFTER UPDATE ON entregas
  FOR EACH ROW EXECUTE FUNCTION avisar_correcao_ao_aluno();
