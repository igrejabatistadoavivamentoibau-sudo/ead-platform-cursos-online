-- ============================================================
-- A JANELA DA AULA E A JUSTIFICATIVA DE FALTA
--
-- POR QUE A DATA NÃO PODE MORAR NA AULA
-- A aula pertence ao curso, e o mesmo curso é dado por várias turmas em
-- épocas diferentes — a turma de março e a de agosto veem a MESMA aula.
-- Uma data gravada na aula valeria para todas ao mesmo tempo: abrir para
-- a turma de agosto fecharia para a de março, ou o contrário. Por isso a
-- janela é do par (turma, aula).
--
-- Sem linha em `aula_turma`, a aula está liberada. De propósito: a escola
-- não precisa marcar data em nada para continuar funcionando como
-- funciona hoje. Quem quiser controlar, controla; quem não quiser, nem
-- percebe que existe.
-- ============================================================

CREATE TABLE IF NOT EXISTS aula_turma (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turma_id     UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  aula_id      UUID NOT NULL REFERENCES aulas(id)  ON DELETE CASCADE,
  abre_em      TIMESTAMPTZ,
  vence_em     TIMESTAMPTZ,
  definida_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (turma_id, aula_id)
);

CREATE INDEX IF NOT EXISTS idx_aula_turma_turma ON aula_turma(turma_id);
CREATE INDEX IF NOT EXISTS idx_aula_turma_aula  ON aula_turma(aula_id);

COMMENT ON TABLE aula_turma IS
  'Janela de disponibilidade de uma aula DENTRO de uma turma. Sem linha = liberada.';

ALTER TABLE aula_turma ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam janelas de aula" ON aula_turma;
DROP POLICY IF EXISTS "Professor gerencia as janelas da sua turma" ON aula_turma;
DROP POLICY IF EXISTS "Aluno ve a janela da sua turma" ON aula_turma;

CREATE POLICY "Admins gerenciam janelas de aula" ON aula_turma
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Professor gerencia as janelas da sua turma" ON aula_turma
  FOR ALL USING (leciona_turma(turma_id)) WITH CHECK (leciona_turma(turma_id));
-- O aluno precisa LER a janela para a tela saber o que dizer a ele.
CREATE POLICY "Aluno ve a janela da sua turma" ON aula_turma
  FOR SELECT USING (matriculado_turma(turma_id));

-- ------------------------------------------------------------
-- O PEDIDO DE LIBERAÇÃO
--
-- Passou o prazo, o aluno não assiste — mas não fica sem caminho: ele
-- pede, o professor lê o motivo e libera ou não. A liberação é sempre de
-- UM aluno em UMA aula de UMA turma; nunca da turma inteira, porque o
-- pedido é individual e a resposta também.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS liberacoes_de_aula (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turma_id     UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  aula_id      UUID NOT NULL REFERENCES aulas(id)  ON DELETE CASCADE,
  aluno_id     UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  motivo       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','liberada','recusada')),
  resposta     TEXT,
  -- Até quando vale a liberação. NULL = sem prazo.
  libera_ate   TIMESTAMPTZ,
  decidida_por UUID REFERENCES users(id) ON DELETE SET NULL,
  decidida_em  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (turma_id, aula_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS idx_liberacoes_turma ON liberacoes_de_aula(turma_id);
CREATE INDEX IF NOT EXISTS idx_liberacoes_aluno ON liberacoes_de_aula(aluno_id);
CREATE INDEX IF NOT EXISTS idx_liberacoes_pendentes
  ON liberacoes_de_aula(turma_id) WHERE status = 'pendente';

ALTER TABLE liberacoes_de_aula ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam liberacoes" ON liberacoes_de_aula;
DROP POLICY IF EXISTS "Professor decide as liberacoes da sua turma" ON liberacoes_de_aula;
DROP POLICY IF EXISTS "Aluno ve os proprios pedidos" ON liberacoes_de_aula;
DROP POLICY IF EXISTS "Aluno faz o proprio pedido" ON liberacoes_de_aula;

CREATE POLICY "Admins gerenciam liberacoes" ON liberacoes_de_aula
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Professor decide as liberacoes da sua turma" ON liberacoes_de_aula
  FOR ALL USING (leciona_turma(turma_id)) WITH CHECK (leciona_turma(turma_id));
CREATE POLICY "Aluno ve os proprios pedidos" ON liberacoes_de_aula
  FOR SELECT USING (auth.uid() = aluno_id);

-- O aluno cria o próprio pedido, e só isso. Não pode ALTERAR: se pudesse,
-- mudaria o status para 'liberada' pelo console e se liberaria sozinho —
-- que é exatamente o que esta tabela existe para impedir.
CREATE POLICY "Aluno faz o proprio pedido" ON liberacoes_de_aula
  FOR INSERT WITH CHECK (
    auth.uid() = aluno_id
    AND matriculado_turma(turma_id)
    AND status = 'pendente'
    AND decidida_por IS NULL
    AND libera_ate IS NULL
  );

-- ============================================================
-- A TRAVA DE VERDADE
--
-- Esconder o vídeo na tela não impede nada: quem sabe abrir o console
-- chama a mesma função que a tela chama e marca a aula como assistida —
-- e, em curso EAD, isso vira PRESENÇA automática. Sem trava no banco,
-- "aula fechada" seria enfeite e a frequência mentiria.
-- ============================================================
CREATE OR REPLACE FUNCTION aula_liberada_para(p_aula UUID, p_aluno UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  j RECORD;
  achou_turma BOOLEAN := FALSE;
BEGIN
  -- O aluno pode estar em mais de uma turma do mesmo curso. Basta UMA
  -- delas estar com a aula aberta: se ele tem direito por algum caminho,
  -- ele tem direito. A tela usa a mesma regra — as duas precisam
  -- concordar, senão a tela diz uma coisa e o servidor faz outra.
  FOR j IN
    SELECT t.id AS turma_id, at.abre_em, at.vence_em
      FROM turma_alunos ta
      JOIN turmas t ON t.id = ta.turma_id
      JOIN aulas  a ON a.curso_id = t.curso_id
      LEFT JOIN aula_turma at ON at.turma_id = t.id AND at.aula_id = a.id
     WHERE ta.aluno_id = p_aluno AND ta.status = 'ativo' AND a.id = p_aula
  LOOP
    achou_turma := TRUE;
    IF j.abre_em IS NULL AND j.vence_em IS NULL THEN RETURN TRUE; END IF;
    IF (j.abre_em  IS NULL OR NOW() >= j.abre_em)
   AND (j.vence_em IS NULL OR NOW() <= j.vence_em) THEN RETURN TRUE; END IF;

    IF EXISTS (
      SELECT 1 FROM liberacoes_de_aula l
       WHERE l.turma_id = j.turma_id AND l.aula_id = p_aula AND l.aluno_id = p_aluno
         AND l.status = 'liberada'
         AND (l.libera_ate IS NULL OR NOW() <= l.libera_ate)
    ) THEN RETURN TRUE; END IF;
  END LOOP;

  -- Aula que não pertence a nenhuma turma do aluno (aula avulsa, curso
  -- aberto) não é assunto desta trava.
  IF NOT achou_turma THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION exigir_aula_liberada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a RECORD;
BEGIN
  IF e_o_servidor() OR is_admin() THEN RETURN NEW; END IF;

  -- O professor do curso também passa: ele precisa poder ver a própria aula.
  IF EXISTS (
    SELECT 1 FROM aulas al JOIN turmas t ON t.curso_id = al.curso_id
     WHERE al.id = NEW.aula_id AND t.professor_id = auth.uid()
  ) THEN RETURN NEW; END IF;

  IF aula_liberada_para(NEW.aula_id, NEW.aluno_id) THEN RETURN NEW; END IF;

  SELECT at.abre_em, at.vence_em INTO a
    FROM aula_turma at
    JOIN turma_alunos ta ON ta.turma_id = at.turma_id AND ta.aluno_id = NEW.aluno_id
   WHERE at.aula_id = NEW.aula_id
   LIMIT 1;

  IF a.abre_em IS NOT NULL AND NOW() < a.abre_em THEN
    RAISE EXCEPTION 'Esta aula abre em %.',
      to_char(a.abre_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY as HH24:MI');
  END IF;
  RAISE EXCEPTION 'O prazo para assistir esta aula encerrou. Peca liberacao ao professor.';
END;
$$;

DROP TRIGGER IF EXISTS trg_exigir_aula_liberada ON aula_progresso;
CREATE TRIGGER trg_exigir_aula_liberada
  BEFORE INSERT OR UPDATE ON aula_progresso
  FOR EACH ROW EXECUTE FUNCTION exigir_aula_liberada();

-- ---------- Avisos dos dois lados do pedido ----------
CREATE OR REPLACE FUNCTION avisar_pedido_de_liberacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_prof UUID; v_aluno TEXT; v_aula TEXT;
BEGIN
  SELECT professor_id INTO v_prof FROM turmas WHERE id = NEW.turma_id;
  IF v_prof IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO v_aluno FROM users WHERE id = NEW.aluno_id;
  SELECT titulo INTO v_aula FROM aulas WHERE id = NEW.aula_id;
  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link)
  VALUES (v_prof, 'Pedido para assistir uma aula',
    COALESCE(v_aluno,'Um aluno') || ' pediu liberacao da aula "' || COALESCE(v_aula,'') || '".',
    'geral', '/dashboard/professor/turmas/' || NEW.turma_id || '/aulas');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avisar_pedido_de_liberacao ON liberacoes_de_aula;
CREATE TRIGGER trg_avisar_pedido_de_liberacao
  AFTER INSERT ON liberacoes_de_aula
  FOR EACH ROW EXECUTE FUNCTION avisar_pedido_de_liberacao();

CREATE OR REPLACE FUNCTION avisar_decisao_de_liberacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_aula TEXT; v_curso UUID;
BEGIN
  IF NEW.status = OLD.status OR NEW.status = 'pendente' THEN RETURN NEW; END IF;
  SELECT titulo, curso_id INTO v_aula, v_curso FROM aulas WHERE id = NEW.aula_id;
  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link)
  VALUES (NEW.aluno_id,
    CASE WHEN NEW.status = 'liberada' THEN 'Aula liberada para voce'
         ELSE 'Pedido de liberacao recusado' END,
    'Aula "' || COALESCE(v_aula,'') || '": ' ||
      CASE WHEN NEW.status = 'liberada' THEN 'o professor liberou.' ELSE 'o professor nao liberou.' END ||
      COALESCE(' ' || NEW.resposta, ''),
    'geral', COALESCE('/dashboard/aluno/cursos/' || v_curso, '/dashboard/aluno/cursos'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avisar_decisao_de_liberacao ON liberacoes_de_aula;
CREATE TRIGGER trg_avisar_decisao_de_liberacao
  AFTER UPDATE ON liberacoes_de_aula
  FOR EACH ROW EXECUTE FUNCTION avisar_decisao_de_liberacao();

-- ============================================================
-- A JUSTIFICATIVA DE FALTA
--
-- Hoje a falta é um número e ponto final: o aluno vê "AUSENTE" e não tem
-- onde dizer que estava no hospital. Quem quer justificar liga para
-- alguém, e a justificativa morre numa conversa de WhatsApp que ninguém
-- acha depois — inclusive na hora de decidir aprovação.
--
-- Aceitar NÃO vira presença. A falta continua registrada, só passa a ter
-- motivo reconhecido. Transformar em presença seria falsificar a chamada,
-- e a lista assinada tem que continuar dizendo o que aconteceu.
-- ============================================================
ALTER TABLE presencas
  ADD COLUMN IF NOT EXISTS justificativa              TEXT,
  ADD COLUMN IF NOT EXISTS justificativa_em           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS justificativa_status       TEXT,
  ADD COLUMN IF NOT EXISTS justificativa_resposta     TEXT,
  ADD COLUMN IF NOT EXISTS justificativa_decidida_por UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS justificativa_decidida_em  TIMESTAMPTZ;

ALTER TABLE presencas DROP CONSTRAINT IF EXISTS justificativa_status_valido;
ALTER TABLE presencas ADD CONSTRAINT justificativa_status_valido
  CHECK (justificativa_status IS NULL
         OR justificativa_status IN ('pendente','aceita','recusada'));

-- A política do aluno era só de leitura, então ele não tinha como
-- escrever nada. Abrir UPDATE resolve o problema e cria outro: Postgres
-- não restringe coluna, então o mesmo UPDATE que grava a justificativa
-- poderia gravar `presente = true`. O gatilho abaixo separa as duas coisas.
DROP POLICY IF EXISTS "Aluno justifica a propria falta" ON presencas;
CREATE POLICY "Aluno justifica a propria falta" ON presencas
  FOR UPDATE USING (auth.uid() = aluno_id) WITH CHECK (auth.uid() = aluno_id);

CREATE OR REPLACE FUNCTION aluno_so_mexe_na_justificativa()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_turma UUID;
BEGIN
  IF e_o_servidor() OR is_admin() THEN RETURN NEW; END IF;

  SELECT e.turma_id INTO v_turma FROM encontros e WHERE e.id = NEW.encontro_id;
  IF v_turma IS NOT NULL AND leciona_turma(v_turma) THEN RETURN NEW; END IF;

  /* Daqui para baixo é o aluno. A única coluna que ele pode ter mexido é
     `justificativa`; todo o resto tem que ter chegado igual.

     CUIDADO COM `COALESCE` AQUI — foi o erro da primeira versão. A
     conferência era `NEW.justificativa_status IS DISTINCT FROM
     COALESCE(OLD.justificativa_status,'pendente')`. Numa falta nunca
     justificada, OLD é NULL e NEW também (o aluno só escreveu o texto).
     A comparação virava "NULL é diferente de 'pendente'?" → sim →
     recusado. O COALESCE inventava um valor que não existia e reprovava
     o caso normal. */
  IF NEW.presente                       IS DISTINCT FROM OLD.presente
     OR NEW.observacao                  IS DISTINCT FROM OLD.observacao
     OR NEW.encontro_id                 IS DISTINCT FROM OLD.encontro_id
     OR NEW.aluno_id                    IS DISTINCT FROM OLD.aluno_id
     OR NEW.justificativa_status        IS DISTINCT FROM OLD.justificativa_status
     OR NEW.justificativa_resposta      IS DISTINCT FROM OLD.justificativa_resposta
     OR NEW.justificativa_decidida_por  IS DISTINCT FROM OLD.justificativa_decidida_por
     OR NEW.justificativa_decidida_em   IS DISTINCT FROM OLD.justificativa_decidida_em THEN
    RAISE EXCEPTION 'Voce so pode escrever a justificativa. Quem decide e o professor.';
  END IF;

  IF NEW.justificativa IS NOT DISTINCT FROM OLD.justificativa THEN
    RETURN NEW;
  END IF;

  IF NEW.presente THEN
    RAISE EXCEPTION 'Esta presenca esta registrada. Nao ha falta para justificar.';
  END IF;
  IF OLD.justificativa_status IN ('aceita','recusada') THEN
    RAISE EXCEPTION 'O professor ja respondeu esta justificativa.';
  END IF;

  NEW.justificativa_status := 'pendente';
  NEW.justificativa_em := NOW();
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aluno_so_mexe_na_justificativa ON presencas;
CREATE TRIGGER trg_aluno_so_mexe_na_justificativa
  BEFORE UPDATE ON presencas
  FOR EACH ROW EXECUTE FUNCTION aluno_so_mexe_na_justificativa();

CREATE OR REPLACE FUNCTION avisar_justificativa()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_turma UUID; v_prof UUID; v_aluno TEXT; v_data DATE; v_titulo TEXT;
BEGIN
  SELECT e.turma_id, e.data, e.titulo INTO v_turma, v_data, v_titulo
    FROM encontros e WHERE e.id = NEW.encontro_id;

  IF NEW.justificativa IS DISTINCT FROM OLD.justificativa
     AND NEW.justificativa IS NOT NULL
     AND NEW.justificativa_status = 'pendente' THEN
    SELECT professor_id INTO v_prof FROM turmas WHERE id = v_turma;
    SELECT name INTO v_aluno FROM users WHERE id = NEW.aluno_id;
    IF v_prof IS NOT NULL THEN
      INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link)
      VALUES (v_prof, 'Justificativa de falta',
        COALESCE(v_aluno,'Um aluno') || ' justificou a falta de ' ||
          to_char(v_data,'DD/MM/YYYY') || '.',
        'geral', '/dashboard/professor/turmas/' || v_turma || '/chamada');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.justificativa_status IS DISTINCT FROM OLD.justificativa_status
     AND NEW.justificativa_status IN ('aceita','recusada') THEN
    INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link)
    VALUES (NEW.aluno_id,
      CASE WHEN NEW.justificativa_status = 'aceita'
           THEN 'Justificativa aceita' ELSE 'Justificativa recusada' END,
      'Falta de ' || to_char(v_data,'DD/MM/YYYY') || ': ' ||
        CASE WHEN NEW.justificativa_status = 'aceita'
             THEN 'o professor aceitou a justificativa.'
             ELSE 'o professor nao aceitou a justificativa.' END ||
        COALESCE(' ' || NEW.justificativa_resposta, ''),
      'geral', '/dashboard/aluno/presencas');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avisar_justificativa ON presencas;
CREATE TRIGGER trg_avisar_justificativa
  AFTER UPDATE ON presencas
  FOR EACH ROW EXECUTE FUNCTION avisar_justificativa();
