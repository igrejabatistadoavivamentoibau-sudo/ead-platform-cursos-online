-- ============================================================
-- PUBLICAR A DISCIPLINA INTEIRA, COM UM AVISO SÓ
--
-- O PROBLEMA, MEDIDO EM PRODUÇÃO
--
-- Depois de montar a matriz, o "Módulo 1 - CRER" ficou assim:
--
--     Essencias da Fé   12 aulas   0 publicadas
--     Vida com Deus     12 aulas   0 publicadas
--
-- As aulas nascem como rascunho de propósito (publicar 24 aulas vazias
-- dispararia 24 avisos de "nova aula" para a turma inteira). Só que não
-- existia o botão de publicar em bloco — sobrava "publique uma por uma,
-- 24 vezes". Ninguém faz isso. Resultado: a aluna matriculada abria o
-- curso e não via NADA, e a coordenação concluía, com razão, que a
-- matrícula não tinha funcionado.
--
-- A CORREÇÃO TEM DUAS METADES, E AS DUAS SÃO NECESSÁRIAS
--
-- 1. Uma função que publica a disciplina inteira numa transação só.
-- 2. Um aviso por ALUNO, não por aula. Doze recados de "nova aula
--    disponível" na mesma tela é o caminho mais curto para a escola
--    parar de ler a central de avisos.
-- ============================================================

-- ------------------------------------------------------------
-- A PORTA DE SERVIÇO DO GATILHO
--
-- `avisar_aula_publicada` continua exatamente como está para o caminho
-- normal — publicar UMA aula continua avisando aula por aula, que é o
-- certo. O que ele ganha é uma porta: quando quem chama declarou que
-- está publicando em bloco, ele se cala e deixa o aviso resumido para
-- quem sabe o conjunto inteiro.
--
-- `current_setting(..., true)` com o segundo argumento TRUE devolve NULL
-- em vez de estourar quando a variável não existe — que é o caso de toda
-- publicação normal.
--
-- E a marca é posta com `set_config(..., true)`: LOCAL à transação. Numa
-- plataforma com pool de conexões, marca global vazaria para a próxima
-- requisição que pegasse a mesma conexão, e um professor publicando uma
-- aula sozinha ficaria sem aviso nenhum, sem explicação.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.avisar_aula_publicada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_modulo TEXT;
BEGIN
  IF NEW.publicada IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.publicada IS TRUE THEN RETURN NEW; END IF;

  -- Publicação em bloco: quem chamou manda o aviso resumido.
  IF COALESCE(current_setting('ibau.em_bloco', TRUE), '') = '1' THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_modulo FROM modulos WHERE id = NEW.modulo_id;
  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link, origem, origem_id)
  SELECT ta.aluno_id, 'Nova aula disponível',
         'Aula ' || NEW.numero || ' — "' || NEW.titulo || '"' || COALESCE(' (' || v_modulo || ')','') || '.' ||
           CASE WHEN at.abre_em IS NOT NULL AND at.abre_em > NOW()
                THEN ' Libera em ' || to_char(at.abre_em AT TIME ZONE 'America/Sao_Paulo','DD/MM') || '.' ELSE '' END,
         'aula',
         COALESCE('/dashboard/aluno/cursos/' || NEW.curso_id || '?aula=' || NEW.id, '/dashboard/aluno/cursos'),
         'aula', NEW.id
    FROM turmas t
    JOIN turma_alunos ta ON ta.turma_id = t.id AND ta.status = 'ativo'
    JOIN users u ON u.id = ta.aluno_id AND COALESCE(u.ativo,TRUE)
    LEFT JOIN aula_turma at ON at.turma_id = t.id AND at.aula_id = NEW.id
   WHERE ((NEW.modulo_id IS NOT NULL AND t.modulo_id = NEW.modulo_id)
       OR (NEW.modulo_id IS NULL AND t.curso_id = NEW.curso_id))
     AND (at.vence_em IS NULL OR at.vence_em >= NOW())
  ON CONFLICT (user_id, origem, origem_id) WHERE origem IS NOT NULL DO NOTHING;
  RETURN NEW;
END; $function$;

-- ------------------------------------------------------------
-- PUBLICAR (OU ESCONDER) A DISCIPLINA INTEIRA
--
-- Devolve quantas aulas mudaram de estado e para quantos alunos o aviso
-- foi. Os dois números importam na tela: "12 aulas publicadas, 2 alunos
-- avisados" é o que diz à coordenação que a turma soube.
--
-- ESCONDER NÃO AVISA NINGUÉM, de propósito. "As aulas que você via
-- sumiram" não é recado que se dê; se for engano, ela publica de novo e
-- ninguém percebeu. E o aviso antigo continua no sino apontando para uma
-- aula que voltou a ser rascunho — por isso ele é APAGADO junto.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publicar_disciplina(
  p_disciplina UUID,
  p_publicar   BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (aulas INTEGER, avisados INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_modulo   UUID;
  v_curso    UUID;
  v_nome     TEXT;
  v_mudadas  INTEGER := 0;
  v_avisados INTEGER := 0;
BEGIN
  SELECT d.modulo_id, d.nome, m.curso_id
    INTO v_modulo, v_nome, v_curso
    FROM disciplinas d JOIN modulos m ON m.id = d.modulo_id
   WHERE d.id = p_disciplina;

  IF v_modulo IS NULL THEN
    RAISE EXCEPTION 'Essa matéria não existe mais.';
  END IF;

  PERFORM set_config('ibau.em_bloco', '1', TRUE);

  UPDATE aulas
     SET publicada = p_publicar, updated_at = NOW()
   WHERE disciplina_id = p_disciplina
     AND publicada IS DISTINCT FROM p_publicar;
  GET DIAGNOSTICS v_mudadas = ROW_COUNT;

  PERFORM set_config('ibau.em_bloco', '0', TRUE);

  IF v_mudadas = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  IF p_publicar THEN
    /* UM aviso por aluno, com a conta do conjunto. `origem_id` é a
       DISCIPLINA: publicar mais três aulas depois atualiza o mesmo
       recado em vez de empilhar um segundo. */
    INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link, origem, origem_id)
    SELECT DISTINCT ta.aluno_id,
           'Novas aulas disponíveis',
           v_mudadas || CASE WHEN v_mudadas = 1 THEN ' aula de "' ELSE ' aulas de "' END
             || v_nome || '" ' || CASE WHEN v_mudadas = 1 THEN 'foi liberada' ELSE 'foram liberadas' END || '.',
           'aula',
           '/dashboard/aluno/cursos/' || v_curso || '?disciplina=' || p_disciplina,
           'disciplina', p_disciplina
      FROM turmas t
      JOIN turma_alunos ta ON ta.turma_id = t.id AND ta.status = 'ativo'
      JOIN users u ON u.id = ta.aluno_id AND COALESCE(u.ativo, TRUE)
     WHERE t.modulo_id = v_modulo
    ON CONFLICT (user_id, origem, origem_id) WHERE origem IS NOT NULL
    DO UPDATE SET corpo = EXCLUDED.corpo, lida = FALSE, created_at = NOW();
    GET DIAGNOSTICS v_avisados = ROW_COUNT;
  ELSE
    /* Escondeu: o recado que apontava para essas aulas não pode ficar. */
    DELETE FROM notificacoes
     WHERE origem = 'disciplina' AND origem_id = p_disciplina;
    DELETE FROM notificacoes n
     WHERE n.origem = 'aula'
       AND n.origem_id IN (SELECT a.id FROM aulas a WHERE a.disciplina_id = p_disciplina);
  END IF;

  RETURN QUERY SELECT v_mudadas, v_avisados;
END; $function$;

-- A lição da 026: revogar de PUBLIC não basta neste projeto. O Supabase
-- concede EXECUTE direto para `anon` e `authenticated` em toda função
-- nova do esquema `public`, e privilégio concedido direto a um papel não
-- some quando se revoga de PUBLIC. Sem estas duas linhas, qualquer
-- pessoa logada — inclusive aluno — publicaria a matéria que quisesse.
REVOKE EXECUTE ON FUNCTION public.publicar_disciplina(UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- `aula_liberada_para` PASSA A ENXERGAR O MÓDULO
--
-- Dívida anotada desde a 022 e agora urgente: a função ligava aluno e
-- aula por CURSO. Com o curso dividido em três módulos, o aluno do
-- Módulo 1 conseguia gravar progresso de aula do Módulo 3.
--
-- O CUIDADO QUE QUASE INVERTEU A TRAVA: o último ramo da função devolve
-- TRUE quando nenhuma turma cobre a aula — é a saída para aula avulsa e
-- curso aberto, que não são assunto desta trava. Trocando a junção para
-- o módulo sem mais nada, a aula do módulo trancado cairia NESSE ramo e
-- seria LIBERADA — o oposto do conserto.
--
-- Por isso agora há três casos, e não dois:
--   1. alguma turma do aluno cobre esta aula  -> vale a janela de data;
--   2. nenhuma cobre, mas ele TEM turma no curso da aula -> é módulo de
--      outra etapa: recusa;
--   3. ele não tem turma nenhuma neste curso -> avulsa: não é aqui.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aula_liberada_para(p_aula uuid, p_aluno uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  j RECORD;
  achou_turma BOOLEAN := FALSE;
  v_curso UUID;
BEGIN
  SELECT curso_id INTO v_curso FROM aulas WHERE id = p_aula;

  FOR j IN
    SELECT t.id AS turma_id, at.abre_em, at.vence_em
      FROM turma_alunos ta
      JOIN turmas t ON t.id = ta.turma_id
      JOIN aulas  a ON a.id = p_aula
       AND (
         (t.modulo_id IS NOT NULL AND a.modulo_id = t.modulo_id)
         OR (t.modulo_id IS NULL AND a.curso_id = t.curso_id)
       )
      LEFT JOIN aula_turma at ON at.turma_id = t.id AND at.aula_id = a.id
     WHERE ta.aluno_id = p_aluno
       AND ta.status = 'ativo'
  LOOP
    achou_turma := TRUE;

    IF j.abre_em IS NULL AND j.vence_em IS NULL THEN RETURN TRUE; END IF;

    IF (j.abre_em  IS NULL OR NOW() >= j.abre_em)
   AND (j.vence_em IS NULL OR NOW() <= j.vence_em) THEN
      RETURN TRUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM liberacoes_de_aula l
       WHERE l.turma_id = j.turma_id AND l.aula_id = p_aula AND l.aluno_id = p_aluno
         AND l.status = 'liberada'
         AND (l.libera_ate IS NULL OR NOW() <= l.libera_ate)
    ) THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  IF NOT achou_turma THEN
    -- Ele tem turma NESTE curso, só que de outro módulo? Então a aula
    -- é de uma etapa que não é dele.
    IF EXISTS (
      SELECT 1 FROM turma_alunos ta
       JOIN turmas t ON t.id = ta.turma_id
      WHERE ta.aluno_id = p_aluno AND ta.status = 'ativo' AND t.curso_id = v_curso
    ) THEN
      RETURN FALSE;
    END IF;
    -- Aula avulsa / curso sem turma dele: não é assunto desta trava.
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$function$;
