-- ============================================================
-- 024 — DESATIVAR E EXCLUIR PESSOA
--
-- A coordenação precisava tirar alguém da plataforma e não tinha como.
-- São duas necessidades diferentes, e tratá-las como uma só seria errado
-- nos dois sentidos:
--
--   DESATIVAR  — o caso comum. A pessoa saiu da igreja, trancou, parou de
--                estudar. Ela perde o acesso e some das listas, mas o que
--                ela fez continua existindo: nota lançada, presença,
--                trabalho entregue, certificado. É reversível.
--
--   EXCLUIR    — o caso raro. Cadastro errado, duplicado, ou um pedido
--                formal de remoção de dados. Apaga a pessoa e tudo o que
--                está pendurado nela. Não tem volta.
--
-- Este arquivo cria o que sustenta os dois no banco. As travas ficam aqui,
-- e não só na tela, porque tela se contorna pelo console do navegador — e
-- porque uma delas protege contra um estrago irreversível.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS ativo          BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS desativado_em  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS desativado_por UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN users.ativo IS
  'FALSE = perdeu o acesso e some das listas, mas o histórico continua inteiro.';

-- O índice só cobre os desativados: eles são a minoria, e é por eles que
-- as telas perguntam ("mostre também os inativos").
CREATE INDEX IF NOT EXISTS idx_users_inativos ON users(ativo) WHERE ativo = FALSE;

-- ------------------------------------------------------------
-- A TRAVA QUE IMPEDE A ESCOLA DE FICAR SEM DONO
--
-- Excluir, desativar ou rebaixar o ÚLTIMO administrador ativo deixaria a
-- plataforma sem ninguém capaz de criar usuário, abrir turma ou lançar
-- nota — e sem ninguém capaz de desfazer isso, porque desfazer também
-- exige ser administrador. Seria preciso mexer no banco por fora para
-- destravar.
--
-- Um clique não pode ter esse poder. E a trava mora aqui, e não na tela,
-- porque cobre os TRÊS caminhos de uma vez: apagar, desativar e rebaixar.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION exigir_um_admin_ativo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_era_admin_ativo BOOLEAN;
  v_continua        BOOLEAN;
  v_restantes       INT;
BEGIN
  v_era_admin_ativo := (OLD.role = 'admin' AND OLD.ativo);
  IF NOT v_era_admin_ativo THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_continua := (TG_OP <> 'DELETE' AND NEW.role = 'admin' AND NEW.ativo);
  IF v_continua THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_restantes
    FROM users
   WHERE role = 'admin' AND ativo AND id <> OLD.id;

  IF v_restantes = 0 THEN
    RAISE EXCEPTION
      'Esta é a única conta de administrador ativa. Promova outra pessoa a administrador antes de mexer nesta, senão a escola fica sem quem administre.';
  END IF;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_exigir_um_admin_ativo ON users;
CREATE TRIGGER trg_exigir_um_admin_ativo
  BEFORE DELETE OR UPDATE OF role, ativo ON users
  FOR EACH ROW EXECUTE FUNCTION exigir_um_admin_ativo();

-- ------------------------------------------------------------
-- O QUE SE PERDE AO EXCLUIR
--
-- A tela de exclusão mostra isto em números ANTES de perguntar se pode.
-- "Apagar 3 notas, 12 presenças e 1 certificado" é uma decisão; "apagar
-- o usuário" é um botão. A diferença entre as duas frases é o que separa
-- uma escolha de um acidente.
--
-- SECURITY DEFINER porque a conta que consulta é a do administrador, e as
-- regras de linha do banco não deixariam ela contar o que é de outra
-- pessoa — que é justamente o que ela precisa ver aqui.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION resumo_do_usuario(p_id UUID)
RETURNS TABLE(
  notas                 INT,
  presencas             INT,
  entregas              INT,
  certificados          INT,
  matriculas            INT,
  turmas_como_professor INT,
  mensagens             INT,
  anotacoes_biblia      INT,
  paginas_caderno       INT,
  aulas_assistidas      INT
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM notas             WHERE aluno_id     = p_id)::INT,
    (SELECT COUNT(*) FROM presencas         WHERE aluno_id     = p_id)::INT,
    (SELECT COUNT(*) FROM entregas          WHERE aluno_id     = p_id)::INT,
    (SELECT COUNT(*) FROM certificates      WHERE user_id      = p_id)::INT,
    (SELECT COUNT(*) FROM turma_alunos      WHERE aluno_id     = p_id)::INT,
    (SELECT COUNT(*) FROM turmas            WHERE professor_id = p_id)::INT,
    (SELECT COUNT(*) FROM mensagens         WHERE autor_id     = p_id)::INT,
    (SELECT COUNT(*) FROM biblia_marcacoes  WHERE user_id      = p_id)::INT,
    (SELECT COUNT(*) FROM caderno_paginas   WHERE user_id      = p_id)::INT,
    (SELECT COUNT(*) FROM aula_progresso    WHERE aluno_id     = p_id AND concluida)::INT;
$$;

COMMENT ON FUNCTION resumo_do_usuario(UUID) IS
  'O que seria apagado junto com esta pessoa. Serve para a tela avisar antes de perguntar.';

-- ------------------------------------------------------------
-- Quem está desativado não lê mais nada por conta própria.
--
-- O bloqueio de verdade acontece em dois lugares antes daqui: a conta é
-- suspensa no serviço de autenticação (não entra mais), e a plataforma
-- devolve para o login quem já estava dentro. Esta regra é a terceira
-- camada — a que vale mesmo para quem tentar falar direto com o banco
-- usando um token que ainda não venceu.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION esta_ativo()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE((SELECT ativo FROM users WHERE id = auth.uid()), TRUE);
$$;

COMMENT ON FUNCTION esta_ativo() IS
  'FALSE quando a pessoa logada foi desativada. Última camada do bloqueio.';
