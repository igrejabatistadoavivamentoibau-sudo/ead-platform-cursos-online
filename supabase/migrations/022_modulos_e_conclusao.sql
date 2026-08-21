-- ============================================================
-- MÓDULOS, MODALIDADE DA TURMA E CONCLUSÃO
--
-- A forma real da escola:
--
--   Curso: Escola de Líderes
--     Módulo 1  →  Turma A (presencial, março)   Turma B (EAD, março)
--     Módulo 2  →  Turma C (presencial, junho)   Turma D (EAD, junho)
--
-- Ou seja: a TURMA pertence ao MÓDULO, não ao curso. E as AULAS também.
--
-- POR QUE `curso_id` CONTINUA EXISTINDO EM AULAS E TURMAS
-- Durante a publicação convivem, por um ou dois minutos, o código novo e
-- o servidor velho. O servidor velho lê `aulas.curso_id` e
-- `turmas.curso_id`; se essas colunas sumissem, ele daria erro 500 na
-- cara de quem estivesse usando a plataforma naquele instante. Então elas
-- ficam, e viram ESPELHO de `modulos.curso_id`, mantido por gatilho.
-- Ninguém precisa lembrar de escrever nos dois lugares.
-- ============================================================

CREATE TABLE IF NOT EXISTS modulos (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curso_id   UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  descricao  TEXT,
  ordem      INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modulos_curso ON modulos(curso_id, ordem);

COMMENT ON TABLE modulos IS 'Etapa de um curso. A turma e as aulas pertencem ao módulo.';
COMMENT ON COLUMN modulos.ordem IS
  'Sequência dentro do curso, começando em 1. É ela que define o pré-requisito.';

ALTER TABLE modulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam modulos" ON modulos;
DROP POLICY IF EXISTS "Todos veem modulos de cursos publicados" ON modulos;

CREATE POLICY "Admins gerenciam modulos" ON modulos
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Leitura ampla: o módulo só tem nome e ordem, e a tela do aluno precisa
-- dele para agrupar as aulas. O que protege conteúdo são as políticas de
-- `aulas` e `turmas`, que continuam valendo.
CREATE POLICY "Todos veem modulos de cursos publicados" ON modulos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cursos c WHERE c.id = modulos.curso_id AND c.publicado = TRUE)
    OR leciona_curso(curso_id) OR is_admin()
  );

-- Todo curso que já existe ganha o "Módulo 1".
INSERT INTO modulos (curso_id, nome, ordem)
SELECT c.id, 'Módulo 1', 1 FROM cursos c
 WHERE NOT EXISTS (SELECT 1 FROM modulos m WHERE m.curso_id = c.id);

ALTER TABLE aulas  ADD COLUMN IF NOT EXISTS modulo_id UUID REFERENCES modulos(id) ON DELETE CASCADE;
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS modulo_id UUID REFERENCES modulos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_aulas_modulo  ON aulas(modulo_id);
CREATE INDEX IF NOT EXISTS idx_turmas_modulo ON turmas(modulo_id);

UPDATE aulas a SET modulo_id = m.id FROM modulos m
 WHERE m.curso_id = a.curso_id AND m.ordem = 1 AND a.modulo_id IS NULL;
UPDATE turmas t SET modulo_id = m.id FROM modulos m
 WHERE m.curso_id = t.curso_id AND m.ordem = 1 AND t.modulo_id IS NULL;

CREATE OR REPLACE FUNCTION espelhar_curso_do_modulo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_curso UUID;
BEGIN
  IF NEW.modulo_id IS NOT NULL THEN
    SELECT curso_id INTO v_curso FROM modulos WHERE id = NEW.modulo_id;
    NEW.curso_id := v_curso;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_espelhar_curso_aulas ON aulas;
CREATE TRIGGER trg_espelhar_curso_aulas
  BEFORE INSERT OR UPDATE OF modulo_id ON aulas
  FOR EACH ROW EXECUTE FUNCTION espelhar_curso_do_modulo();

DROP TRIGGER IF EXISTS trg_espelhar_curso_turmas ON turmas;
CREATE TRIGGER trg_espelhar_curso_turmas
  BEFORE INSERT OR UPDATE OF modulo_id ON turmas
  FOR EACH ROW EXECUTE FUNCTION espelhar_curso_do_modulo();

-- A numeração da aula passa a ser POR MÓDULO. Era única por curso, o que
-- impediria o Módulo 2 de ter uma "Aula 1" — e cada módulo começa do 1,
-- não continua a contagem do anterior.
DROP INDEX IF EXISTS idx_aulas_curso_numero;
CREATE UNIQUE INDEX IF NOT EXISTS idx_aulas_modulo_numero
  ON aulas(modulo_id, numero) WHERE modulo_id IS NOT NULL;

-- Todo curso novo nasce com "Módulo 1", para a escola não encarar uma
-- tela vazia antes de conseguir criar a primeira aula.
CREATE OR REPLACE FUNCTION curso_nasce_com_modulo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO modulos (curso_id, nome, ordem) VALUES (NEW.id, 'Módulo 1', 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_curso_nasce_com_modulo ON cursos;
CREATE TRIGGER trg_curso_nasce_com_modulo
  AFTER INSERT ON cursos FOR EACH ROW EXECUTE FUNCTION curso_nasce_com_modulo();

-- ============================================================
-- A MODALIDADE É DA TURMA
--
-- "Posso ter as turmas presenciais e EAD" — e no mesmo módulo. Hoje a
-- modalidade é do CURSO inteiro, o que torna isso impossível.
--
-- E havia um defeito ativo por causa disso: `registrar_presenca_ead()`
-- lia a modalidade do curso ANTES de percorrer as turmas e decidia uma
-- vez só. Num curso marcado como EAD, uma turma presencial recebia
-- presença automática por vídeo assistido — a frequência daquela turma
-- estava errada, em silêncio.
-- ============================================================
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS modalidade TEXT NOT NULL DEFAULT 'ead';
ALTER TABLE turmas DROP CONSTRAINT IF EXISTS turmas_modalidade_valida;
ALTER TABLE turmas ADD CONSTRAINT turmas_modalidade_valida
  CHECK (modalidade IN ('ead','presencial'));

UPDATE turmas t SET modalidade = COALESCE(c.modalidade, 'ead')
  FROM cursos c WHERE c.id = t.curso_id;

COMMENT ON COLUMN turmas.modalidade IS
  'presencial ou ead. É a turma que decide: o mesmo módulo pode ter as duas.';

CREATE OR REPLACE FUNCTION registrar_presenca_ead()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_curso UUID; v_titulo TEXT; v_numero INT;
  v_turma RECORD; v_encontro UUID;
BEGIN
  IF NEW.concluida IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.concluida IS TRUE THEN RETURN NEW; END IF;

  SELECT a.curso_id, a.titulo, a.numero INTO v_curso, v_titulo, v_numero
    FROM aulas a WHERE a.id = NEW.aula_id;
  IF v_curso IS NULL THEN RETURN NEW; END IF;

  -- A decisão passou para DENTRO do laço: cada turma responde por si.
  FOR v_turma IN
    SELECT t.id, t.modalidade
      FROM turmas t JOIN turma_alunos ta ON ta.turma_id = t.id
     WHERE t.curso_id = v_curso AND ta.aluno_id = NEW.aluno_id
       -- Aluno inativo ou já concluído não gera presença nova. Antes
       -- gerava: o laço não filtrava o status da matrícula.
       AND ta.status = 'ativo'
  LOOP
    IF v_turma.modalidade IS DISTINCT FROM 'ead' THEN CONTINUE; END IF;

    SELECT e.id INTO v_encontro FROM encontros e
     WHERE e.turma_id = v_turma.id AND e.aula_id = NEW.aula_id;

    IF v_encontro IS NULL THEN
      INSERT INTO encontros (turma_id, aula_id, titulo, data, automatico)
      VALUES (v_turma.id, NEW.aula_id,
              'Aula ' || COALESCE(v_numero::text,'') || ' — ' || COALESCE(v_titulo,'Vídeo aula'),
              CURRENT_DATE, TRUE)
      RETURNING id INTO v_encontro;
    END IF;

    INSERT INTO presencas (encontro_id, aluno_id, presente, observacao)
    VALUES (v_encontro, NEW.aluno_id, TRUE, 'Presença automática: vídeo aula concluída')
    ON CONFLICT (encontro_id, aluno_id) DO UPDATE SET presente = TRUE, updated_at = NOW();
  END LOOP;
  RETURN NEW;
END;
$$;

-- ============================================================
-- CONCLUIR A TURMA
--
-- Aprovado com 7. Abaixo disso, reprovado — e reprovado NÃO é o fim da
-- linha: vira candidato a repetir, e a coordenação decide em qual turma.
--
-- POR QUE A MÉDIA FICA GRAVADA, E NÃO É RECALCULADA DEPOIS
-- Se a situação fosse calculada toda vez que alguém abre a tela, ela
-- mudaria sozinha: o professor corrige uma atividade atrasada em novembro
-- e o aluno reprovado em agosto "vira" aprovado sem ninguém decidir nada.
-- Conclusão é ato, não consulta.
-- ============================================================
ALTER TABLE turma_alunos
  ADD COLUMN IF NOT EXISTS situacao         TEXT NOT NULL DEFAULT 'cursando',
  ADD COLUMN IF NOT EXISTS media_final      NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS frequencia_final INTEGER,
  ADD COLUMN IF NOT EXISTS concluida_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concluida_por    UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observacao_conclusao TEXT;

ALTER TABLE turma_alunos DROP CONSTRAINT IF EXISTS situacao_valida;
ALTER TABLE turma_alunos ADD CONSTRAINT situacao_valida
  CHECK (situacao IN ('cursando','aprovado','reprovado','desistente'));

COMMENT ON COLUMN turma_alunos.media_final IS
  'A média do dia do fechamento, congelada. Não é recalculada depois.';

CREATE INDEX IF NOT EXISTS idx_turma_alunos_situacao
  ON turma_alunos(situacao) WHERE situacao = 'reprovado';

-- O PRÉ-REQUISITO. Devolve `pode` e o `motivo`, em vez de só um booleano:
-- "ainda está cursando o Módulo 1" e "reprovado no Módulo 1" levam a
-- decisões diferentes de quem está matriculando.
CREATE OR REPLACE FUNCTION pode_entrar_no_modulo(p_aluno UUID, p_turma UUID)
RETURNS TABLE(pode BOOLEAN, motivo TEXT)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_curso UUID; v_ordem INT; v_nome_ant TEXT; v_ordem_ant INT; v_situacao TEXT;
BEGIN
  SELECT m.curso_id, m.ordem INTO v_curso, v_ordem
    FROM turmas t JOIN modulos m ON m.id = t.modulo_id WHERE t.id = p_turma;

  IF v_curso IS NULL OR v_ordem IS NULL OR v_ordem <= 1 THEN
    RETURN QUERY SELECT TRUE, NULL::TEXT; RETURN;
  END IF;

  -- O módulo anterior é o de maior ordem ABAIXO deste — e não "ordem - 1".
  -- Se alguém apagar o Módulo 2, o 3 passa a exigir o 1, em vez de exigir
  -- um módulo que não existe mais e travar a escola inteira.
  SELECT m.ordem, m.nome INTO v_ordem_ant, v_nome_ant
    FROM modulos m WHERE m.curso_id = v_curso AND m.ordem < v_ordem
   ORDER BY m.ordem DESC LIMIT 1;

  IF v_ordem_ant IS NULL THEN RETURN QUERY SELECT TRUE, NULL::TEXT; RETURN; END IF;

  SELECT ta.situacao INTO v_situacao
    FROM turma_alunos ta
    JOIN turmas t  ON t.id = ta.turma_id
    JOIN modulos m ON m.id = t.modulo_id
   WHERE ta.aluno_id = p_aluno AND m.curso_id = v_curso AND m.ordem = v_ordem_ant
   ORDER BY CASE ta.situacao WHEN 'aprovado' THEN 1 WHEN 'cursando' THEN 2 ELSE 3 END
   LIMIT 1;

  IF v_situacao = 'aprovado' THEN
    RETURN QUERY SELECT TRUE, NULL::TEXT;
  ELSIF v_situacao IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Este aluno nunca cursou "' || v_nome_ant || '", que vem antes deste módulo.';
  ELSIF v_situacao = 'cursando' THEN
    RETURN QUERY SELECT FALSE, 'Este aluno ainda está cursando "' || v_nome_ant || '". Conclua aquela turma primeiro.';
  ELSE
    RETURN QUERY SELECT FALSE, 'Este aluno não foi aprovado em "' || v_nome_ant || '" (situação: ' || v_situacao || ').';
  END IF;
END;
$$;

-- O gatilho é a rede de baixo: protege quem fala direto com o banco. O
-- caminho de verdade (a tela) é barrado na action, que é onde o
-- administrador tem como decidir uma exceção com o nome dele registrado.
CREATE OR REPLACE FUNCTION exigir_modulo_anterior()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  IF e_o_servidor() OR is_admin() THEN RETURN NEW; END IF;
  SELECT * INTO r FROM pode_entrar_no_modulo(NEW.aluno_id, NEW.turma_id);
  IF NOT r.pode THEN RAISE EXCEPTION '%', r.motivo; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exigir_modulo_anterior ON turma_alunos;
CREATE TRIGGER trg_exigir_modulo_anterior
  BEFORE INSERT ON turma_alunos
  FOR EACH ROW EXECUTE FUNCTION exigir_modulo_anterior();

CREATE OR REPLACE FUNCTION avisar_conclusao_da_turma()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_turma TEXT; v_modulo TEXT;
BEGIN
  IF NEW.situacao = OLD.situacao OR NEW.situacao = 'cursando' THEN RETURN NEW; END IF;

  SELECT t.nome, m.nome INTO v_turma, v_modulo
    FROM turmas t LEFT JOIN modulos m ON m.id = t.modulo_id WHERE t.id = NEW.turma_id;

  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link)
  VALUES (NEW.aluno_id,
    CASE NEW.situacao WHEN 'aprovado' THEN 'Você foi aprovado!'
                      WHEN 'reprovado' THEN 'Resultado da turma'
                      ELSE 'Situação atualizada' END,
    COALESCE(v_modulo || ' — ', '') || COALESCE(v_turma, 'Sua turma') || ': ' ||
      CASE NEW.situacao
        WHEN 'aprovado' THEN 'aprovado com média ' || trim(to_char(NEW.media_final,'FM9990.0')) || '.'
        WHEN 'reprovado' THEN 'média ' || trim(to_char(NEW.media_final,'FM9990.0')) ||
             '. A coordenação vai falar com você sobre refazer o módulo.'
        ELSE 'situação atualizada.' END ||
      COALESCE(' ' || NEW.observacao_conclusao, ''),
    'nota', '/dashboard/aluno/notas');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avisar_conclusao_da_turma ON turma_alunos;
CREATE TRIGGER trg_avisar_conclusao_da_turma
  AFTER UPDATE ON turma_alunos
  FOR EACH ROW EXECUTE FUNCTION avisar_conclusao_da_turma();
