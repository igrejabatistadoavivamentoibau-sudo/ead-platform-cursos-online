-- ============================================================
-- A JANELA DA ATIVIDADE
--
-- O que se pediu: o professor marca quando a atividade ABRE e quando
-- VENCE, e depois de vencida o portal não deixa mais anexar. Mais um
-- aviso escrito pelo professor ("faça à punho", "traga na aula"), porque
-- o enunciado e a instrução de entrega são coisas diferentes.
--
-- POR QUE A REGRA MORA AQUI, NO BANCO, E NÃO SÓ NA TELA
--
-- Esconder o botão depois do prazo não é bloquear: é pedir por favor.
-- O aluno usa o mesmo endereço do banco que a tela usa, com a mesma
-- sessão dele. Quem souber abrir o console do navegador entrega uma
-- semana atrasado sem passar por tela nenhuma — e a nota sai errada sem
-- ninguém perceber. Hoje o servidor aceita: a tela já escreve "Prazo
-- vencido" e a entrega passa assim mesmo.
--
-- Então a janela vira um gatilho no banco. Não existe caminho que
-- desvie dele: nem tela, nem console, nem programa de fora. O professor
-- e o admin continuam podendo lançar/corrigir a qualquer momento — quem
-- é barrado é o próprio aluno entregando fora da janela. Para reabrir
-- para um aluno, o professor muda a data. É uma decisão dele, registrada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. As colunas novas em `atividades`
-- ------------------------------------------------------------
ALTER TABLE atividades
  -- Quem criou. Não existia: a autoria era deduzida de turmas.professor_id,
  -- o que não distingue "o admin criou" de "o professor criou".
  ADD COLUMN IF NOT EXISTS criada_por  UUID REFERENCES users(id) ON DELETE SET NULL,
  -- A janela. Com hora, porque "vence dia 17" e "vence dia 17 às 23:59"
  -- são a mesma coisa para a pessoa e coisas diferentes para o relógio.
  ADD COLUMN IF NOT EXISTS abre_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vence_em    TIMESTAMPTZ,
  -- O recado de COMO entregar, separado do enunciado.
  ADD COLUMN IF NOT EXISTS aviso       TEXT;

COMMENT ON COLUMN atividades.abre_em  IS 'Antes disto o aluno vê a atividade mas não entrega. NULL = aberta desde sempre.';
COMMENT ON COLUMN atividades.vence_em IS 'Depois disto o aluno não anexa mais. NULL = sem prazo.';
COMMENT ON COLUMN atividades.aviso    IS 'Instrução de entrega ("faça à punho e fotografe"), separada do enunciado.';

-- ------------------------------------------------------------
-- 2. As atividades que já existem não podem ficar sem prazo
--
-- A coluna antiga `prazo` é DATE. "Vence dia 17" para uma pessoa quer
-- dizer "até o fim do dia 17" — então 23:59:59. E no fuso de Brasília,
-- não no do servidor: sem o `AT TIME ZONE`, uma atividade que vence
-- domingo à noite passaria a vencer domingo às 21h para o aluno.
-- ------------------------------------------------------------
UPDATE atividades
   SET vence_em = ((prazo + TIME '23:59:59') AT TIME ZONE 'America/Sao_Paulo')
 WHERE prazo IS NOT NULL AND vence_em IS NULL;

-- Autoria retroativa: o professor responsável pela turma. É a informação
-- mais verdadeira que existe hoje. Turma sem professor fica NULL, e NULL
-- só o admin edita — que é o comportamento seguro.
UPDATE atividades a
   SET criada_por = t.professor_id
  FROM turmas t
 WHERE t.id = a.turma_id AND a.criada_por IS NULL;

-- ------------------------------------------------------------
-- 3. A coluna `prazo` continua existindo e continua certa
--
-- Não apagamos: durante a publicação convivem por um instante o código
-- novo e o servidor velho, e um `prazo` que sumiu vira erro na tela do
-- aluno. Ela passa a ser um espelho de `vence_em`, mantido pelo banco,
-- para que ninguém precise lembrar de escrever nos dois lugares.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION espelhar_prazo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.prazo := CASE
    WHEN NEW.vence_em IS NULL THEN NULL
    ELSE (NEW.vence_em AT TIME ZONE 'America/Sao_Paulo')::date
  END;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_espelhar_prazo ON atividades;
CREATE TRIGGER trg_espelhar_prazo
  BEFORE INSERT OR UPDATE ON atividades
  FOR EACH ROW EXECUTE FUNCTION espelhar_prazo();

-- ------------------------------------------------------------
-- 4. Quem edita a atividade de quem
--
-- Regra pedida: um professor não edita a atividade do outro; o admin
-- edita todas. A leitura continua ampla (o professor da turma precisa
-- VER tudo que foi passado para os alunos dele, mesmo o que o admin
-- criou) — o que fecha é a escrita.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION criou_atividade(p_atividade UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM atividades a
     WHERE a.id = p_atividade AND a.criada_por = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Professores gerenciam atividades de suas turmas" ON atividades;

-- Ver: o professor da turma vê tudo o que os alunos dele recebem.
CREATE POLICY "Professores veem as atividades de suas turmas" ON atividades
  FOR SELECT USING (leciona_turma(turma_id));

-- Criar: na própria turma, e assinando o próprio nome. O `criada_por =
-- auth.uid()` no CHECK impede criar uma atividade já em nome de outra
-- pessoa — que seria o jeito óbvio de furar a regra de edição.
CREATE POLICY "Professores criam atividades nas suas turmas" ON atividades
  FOR INSERT WITH CHECK (leciona_turma(turma_id) AND criada_por = auth.uid());

-- Alterar e apagar: só o que ele mesmo criou.
CREATE POLICY "Professores alteram as proprias atividades" ON atividades
  FOR UPDATE USING (leciona_turma(turma_id) AND criada_por = auth.uid())
           WITH CHECK (leciona_turma(turma_id) AND criada_por = auth.uid());

CREATE POLICY "Professores apagam as proprias atividades" ON atividades
  FOR DELETE USING (leciona_turma(turma_id) AND criada_por = auth.uid());

-- ------------------------------------------------------------
-- 5. Vários arquivos por entrega
--
-- Atividade feita à punho vira três, quatro fotos de páginas. As colunas
-- `arquivo_path`/`arquivo_nome` só cabem um arquivo, e obrigar o aluno a
-- juntar tudo num PDF sozinho é obrigar a maioria a desistir.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entrega_arquivos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entrega_id  UUID NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  tamanho     BIGINT,
  enviado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- O mesmo arquivo não entra duas vezes na mesma entrega.
  UNIQUE (entrega_id, path),
  -- PDF e JPEG, como se pediu. A lista mora aqui porque a tela pode ser
  -- contornada e esta linha não pode.
  CONSTRAINT tipo_aceito CHECK (tipo IN ('application/pdf', 'image/jpeg'))
);

CREATE INDEX IF NOT EXISTS idx_entrega_arquivos_entrega ON entrega_arquivos(entrega_id);

-- Traz para a tabela nova o que já foi entregue, para nada sumir da
-- vista de quem já entregou.
INSERT INTO entrega_arquivos (entrega_id, path, nome, tipo, enviado_em)
SELECT e.id,
       e.arquivo_path,
       COALESCE(e.arquivo_nome, 'arquivo'),
       CASE WHEN lower(e.arquivo_path) LIKE '%.pdf' THEN 'application/pdf' ELSE 'image/jpeg' END,
       COALESCE(e.entregue_em, NOW())
  FROM entregas e
 WHERE e.arquivo_path IS NOT NULL
ON CONFLICT (entrega_id, path) DO NOTHING;

ALTER TABLE entrega_arquivos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION entrega_e_minha(p_entrega UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM entregas e WHERE e.id = p_entrega AND e.aluno_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION leciona_entrega(p_entrega UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM entregas e
      JOIN atividades a ON a.id = e.atividade_id
      JOIN turmas t     ON t.id = a.turma_id
     WHERE e.id = p_entrega AND t.professor_id = auth.uid()
  );
$$;

CREATE POLICY "Admins gerenciam anexos" ON entrega_arquivos
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Professor le os anexos das suas turmas" ON entrega_arquivos
  FOR SELECT USING (leciona_entrega(entrega_id));

CREATE POLICY "Aluno gerencia os proprios anexos" ON entrega_arquivos
  FOR ALL USING (entrega_e_minha(entrega_id)) WITH CHECK (entrega_e_minha(entrega_id));

-- ------------------------------------------------------------
-- 6. O GATILHO DA JANELA — o bloqueio de verdade
--
-- Vale para a entrega e para cada anexo. Quem é barrado é o ALUNO agindo
-- em nome próprio; professor e admin passam, porque eles precisam poder
-- corrigir e ajustar depois do prazo.
-- ------------------------------------------------------------
/* O SERVIDOR NÃO É UM ALUNO — a correção que só apareceu ao testar.

   Os gatilhos abaixo olham para `auth.uid()` e concluem "não é admin, não
   leciona, não está matriculado" → recusa. Está certo para qualquer
   pessoa. Mas o próprio servidor da plataforma grava com a chave
   administrativa, que não tem `auth.uid()` nenhum — então o professor
   lançando nota cairia na trava feita para o aluno, e a correção pararia
   de funcionar por inteiro. Só descobri porque o teste tentou lançar uma
   nota depois do prazo, que é o que acontece todo dia na vida real.

   A chave administrativa só existe dentro do servidor; ela nunca chega ao
   navegador, e quem a usa já passou pela conferência de permissão na
   action. Por isso ela é reconhecida aqui e segue em frente. O aluno, que
   fala com o banco usando a sessão dele, continua barrado — e é ele que
   estas travas existem para barrar. */
CREATE OR REPLACE FUNCTION e_o_servidor()
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  claims TEXT;
BEGIN
  claims := nullif(current_setting('request.jwt.claims', true), '');
  -- Sem token nenhum: acesso direto ao banco (migração, manutenção).
  -- As políticas de RLS já barram o navegador nesse caso.
  IF claims IS NULL THEN RETURN TRUE; END IF;
  RETURN (claims::json ->> 'role') = 'service_role';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION exigir_janela_aberta(p_atividade UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
BEGIN
  -- O servidor, o professor da turma e o admin não têm janela: eles
  -- lançam e corrigem quando precisarem.
  IF e_o_servidor() OR is_admin() THEN RETURN; END IF;

  SELECT at.abre_em, at.vence_em, at.publicada, at.turma_id
    INTO a
    FROM atividades at
   WHERE at.id = p_atividade;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atividade não encontrada.';
  END IF;

  IF leciona_turma(a.turma_id) THEN RETURN; END IF;

  -- Daqui para baixo, é o aluno.
  IF NOT matriculado_turma(a.turma_id) THEN
    RAISE EXCEPTION 'Você não está matriculado na turma desta atividade.';
  END IF;

  IF NOT a.publicada THEN
    RAISE EXCEPTION 'Esta atividade ainda não foi liberada pelo professor.';
  END IF;

  IF a.abre_em IS NOT NULL AND NOW() < a.abre_em THEN
    RAISE EXCEPTION 'Esta atividade abre em %.',
      to_char(a.abre_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI');
  END IF;

  IF a.vence_em IS NOT NULL AND NOW() > a.vence_em THEN
    RAISE EXCEPTION 'O prazo desta atividade encerrou em %.',
      to_char(a.vence_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION janela_na_entrega()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM exigir_janela_aberta(NEW.atividade_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_janela_na_entrega ON entregas;
CREATE TRIGGER trg_janela_na_entrega
  BEFORE INSERT OR UPDATE ON entregas
  FOR EACH ROW EXECUTE FUNCTION janela_na_entrega();

CREATE OR REPLACE FUNCTION janela_no_anexo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_atividade UUID;
BEGIN
  SELECT e.atividade_id INTO v_atividade
    FROM entregas e WHERE e.id = COALESCE(NEW.entrega_id, OLD.entrega_id);
  PERFORM exigir_janela_aberta(v_atividade);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_janela_no_anexo ON entrega_arquivos;
CREATE TRIGGER trg_janela_no_anexo
  BEFORE INSERT OR UPDATE OR DELETE ON entrega_arquivos
  FOR EACH ROW EXECUTE FUNCTION janela_no_anexo();

-- ------------------------------------------------------------
-- 7. O aluno não escreve a própria nota
--
-- A política de `entregas` para o aluno é FOR ALL, e Postgres não sabe
-- restringir colunas. Como a entrega é feita com a sessão do próprio
-- aluno, hoje ele consegue gravar `nota` e `feedback` na entrega dele
-- pelo console do navegador. Nunca foi explorado, mas está aberto — e
-- eu estou mexendo exatamente nesta tabela agora.
-- ------------------------------------------------------------
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
     OR NEW.corrigida_em IS DISTINCT FROM OLD.corrigida_em THEN
    RAISE EXCEPTION 'Só o professor da turma lança nota e comentário.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nota_so_de_quem_corrige ON entregas;
CREATE TRIGGER trg_nota_so_de_quem_corrige
  BEFORE UPDATE ON entregas
  FOR EACH ROW EXECUTE FUNCTION nota_so_de_quem_corrige();

-- Na criação da entrega o aluno também não pode já nascer com nota.
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entrega_nasce_sem_nota ON entregas;
CREATE TRIGGER trg_entrega_nasce_sem_nota
  BEFORE INSERT ON entregas
  FOR EACH ROW EXECUTE FUNCTION entrega_nasce_sem_nota();

-- ------------------------------------------------------------
-- 8. O cofre dos arquivos entregues
--
-- As regras do bucket `entregas` diziam `auth.uid() IS NOT NULL`: na
-- prática, QUALQUER pessoa logada lê e escreve QUALQUER arquivo do
-- bucket, inclusive a redação de outro aluno de outra turma. O nome da
-- regra dizia "por dono e equipe"; o conteúdo não dizia isso.
--
-- O caminho de cada arquivo começa com o id do aluno
-- (`{aluno_id}/{atividade_id}-{uuid}.pdf`), então dá para amarrar a
-- regra ao dono de verdade. O professor continua vendo tudo: as telas
-- dele geram link assinado pelo servidor, que não passa por estas regras.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Aluno envia a propria entrega" ON storage.objects;
DROP POLICY IF EXISTS "Leitura das entregas por dono e equipe" ON storage.objects;

CREATE POLICY "Entrega: cada um escreve na propria pasta" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'entregas'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Entrega: cada um le a propria pasta" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'entregas'
    AND auth.uid() IS NOT NULL
    AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin())
  );

-- Trocar um anexo antes do prazo apaga o antigo, em vez de deixar lixo
-- acumulando no bucket para sempre.
CREATE POLICY "Entrega: cada um apaga da propria pasta" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'entregas'
    AND auth.uid() IS NOT NULL
    AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin())
  );
