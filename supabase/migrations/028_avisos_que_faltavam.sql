-- ============================================================
-- OS AVISOS QUE FALTAVAM
--
-- A plataforma já tem central de notificações desde a migração 015:
-- tabela `notificacoes`, RLS por dono, sino no topo, tela por portal e
-- seis gatilhos espalhados pelas migrações 015, 020, 021 e 022 (aviso da
-- turma, entrega chegou, atividade corrigida, pedido de liberação de
-- aula, decisão do professor, conclusão de turma).
--
-- ISTO NÃO É UM SEGUNDO SISTEMA. Nenhuma tabela nova, nenhum componente
-- novo, nenhum caminho paralelo: são cinco gatilhos escritos na MESMA
-- tabela, com o MESMO formato, que aparecem na MESMA tela.
--
-- O que faltava:
--   1. nota lançada numa AVALIAÇÃO (prova, trabalho, participação)
--   2. atividade publicada
--   3. atividade chegando no prazo
--   4. pedido pago
--   5. aula publicada
--
-- Por que gatilho no banco, e não código na tela: é onde os seis avisos
-- que já existem moram, e é o único lugar por onde TODOS os caminhos
-- passam. A nota, por exemplo, é lançada pela tela do professor, pela do
-- admin e pelo aviso do provedor de pagamento no caso do pedido — três
-- portas, um gatilho. Se o aviso morasse na tela, a porta que alguém
-- esquecesse de mexer seria a que deixa o aluno sem saber.
-- ============================================================


-- ------------------------------------------------------------
-- 1. DE ONDE VEIO O AVISO — e a trava contra repetição
--
-- A tabela guardava tipo, título, corpo, link e data, mas não guardava
-- QUAL FATO gerou o aviso. Sem isso não há como perguntar "este aluno já
-- foi avisado desta atividade?", e a rotina de prazo avisaria de novo a
-- cada vez que rodasse.
--
-- Duas colunas na tabela que já existe — nenhuma tabela nova:
--   origem     o tipo do fato ('nota', 'atividade', 'prazo', 'pedido', 'aula')
--   origem_id  a linha exata daquele fato
--
-- E a trava é um ÍNDICE ÚNICO, não uma conferência no meio do código.
-- Conferir antes de inserir parece igual e não é: duas execuções ao mesmo
-- tempo conferem as duas, as duas não encontram nada, e as duas inserem.
-- O índice não tem esse buraco — o banco recusa a segunda, sempre.
--
-- Parcial (`where origem is not null`) porque os avisos antigos e os
-- escritos à mão pela coordenação não têm origem, e não podem ser
-- impedidos de se repetir: mandar dois recados iguais é decisão dela.
-- ------------------------------------------------------------
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS origem TEXT;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS origem_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS notificacoes_sem_repetir
  ON notificacoes (user_id, origem, origem_id)
  WHERE origem IS NOT NULL;

COMMENT ON COLUMN notificacoes.origem IS
  'O tipo de fato que gerou o aviso. Junto com origem_id, é o que impede o mesmo aviso duas vezes (índice notificacoes_sem_repetir).';
COMMENT ON COLUMN notificacoes.origem_id IS
  'A linha exata do fato de origem. Para nota é a avaliação (e não a linha da nota): assim, regravar a nota não vira um segundo aviso.';


-- ------------------------------------------------------------
-- 2. OS TIPOS NOVOS
--
-- O tipo decide o ícone e a cor na central (components/Notificacoes/
-- Lista.tsx). Sem entrar no CHECK, o gatilho falharia — e falharia
-- DERRUBANDO a operação que o disparou: o professor não conseguiria
-- lançar a nota por causa do aviso da nota.
-- ------------------------------------------------------------
ALTER TABLE notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;
ALTER TABLE notificacoes ADD CONSTRAINT notificacoes_tipo_check
  CHECK (tipo IN (
    'geral','aviso_turma','novidade','inscricao','nota','atualizacao',
    'atividade','prazo','aula','pedido'
  ));


-- ------------------------------------------------------------
-- 3. NOTA LANÇADA NUMA AVALIAÇÃO
--
-- CUIDADO PARA NÃO CONFUNDIR COM O QUE JÁ EXISTE. A migração 020 já
-- avisa a nota de uma ATIVIDADE (`entregas.nota`) — o trabalho que o
-- aluno entrega. Esta aqui é a nota de uma AVALIAÇÃO (`notas.valor`):
-- prova, trabalho de sala, participação. São duas tabelas e dois
-- caminhos diferentes, e só o primeiro tinha aviso.
--
-- DESTINATÁRIO: só o aluno da nota. Ninguém mais vê nota de ninguém.
--
-- A origem é a AVALIAÇÃO, não a linha da nota. A tela do professor grava
-- a planilha inteira de uma vez, e um `delete` + `insert` no meio disso
-- trocaria o id da linha — e um id novo viraria um aviso repetido da
-- mesma prova. Por avaliação, isso não acontece.
--
-- Nota CORRIGIDA reaproveita o mesmo aviso (`do update`) em vez de criar
-- outro: o aluno vê um recado por prova, com o valor atual, e ele volta
-- para o alto da lista como não lido. Dois recados sobre a mesma prova
-- seriam confusos justamente no caso em que a segunda informação
-- desmente a primeira.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION avisar_nota_lancada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_titulo TEXT; v_max NUMERIC; v_tipo TEXT; v_quem TEXT; v_primeira BOOLEAN;
BEGIN
  -- Nota apagada ou ainda em branco não é notícia.
  IF NEW.valor IS NULL THEN RETURN NEW; END IF;

  -- Salvar a planilha de novo sem mexer no número não pode avisar nada.
  IF TG_OP = 'UPDATE' AND NEW.valor IS NOT DISTINCT FROM OLD.valor THEN
    RETURN NEW;
  END IF;

  SELECT a.titulo, a.nota_maxima, a.tipo
    INTO v_titulo, v_max, v_tipo
    FROM avaliacoes a WHERE a.id = NEW.avaliacao_id;

  SELECT COALESCE(assinatura_nome, name) INTO v_quem
    FROM users WHERE id = NEW.lancada_por;

  v_primeira := (TG_OP = 'INSERT') OR OLD.valor IS NULL;

  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link, origem, origem_id)
  VALUES (
    NEW.aluno_id,
    CASE
      WHEN NOT v_primeira THEN 'Sua nota foi corrigida'
      WHEN v_tipo = 'prova' THEN 'Saiu a nota da prova'
      WHEN v_tipo = 'trabalho' THEN 'Saiu a nota do trabalho'
      WHEN v_tipo = 'participacao' THEN 'Saiu a nota de participação'
      ELSE 'Saiu uma nota nova'
    END,
    '"' || COALESCE(v_titulo, 'Avaliação') || '": ' ||
      trim(to_char(NEW.valor, 'FM9999990.09')) || ' de ' ||
      trim(to_char(COALESCE(v_max, 10), 'FM9999990.09')) ||
      COALESCE(', lançada por ' || v_quem, '') || '.' ||
      COALESCE(' ' || NEW.observacao, ''),
    'nota',
    '/dashboard/aluno/notas',
    'nota', NEW.avaliacao_id
  )
  ON CONFLICT (user_id, origem, origem_id) WHERE origem IS NOT NULL
  DO UPDATE SET
    titulo = EXCLUDED.titulo,
    corpo = EXCLUDED.corpo,
    link = EXCLUDED.link,
    lida = FALSE,
    created_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avisar_nota_lancada ON notas;
CREATE TRIGGER trg_avisar_nota_lancada
  AFTER INSERT OR UPDATE OF valor ON notas
  FOR EACH ROW EXECUTE FUNCTION avisar_nota_lancada();


-- ------------------------------------------------------------
-- 4. ATIVIDADE PUBLICADA
--
-- DESTINATÁRIO: os alunos ATIVOS da turma da atividade — que são
-- exatamente os que a enxergam. A atividade pertence à turma (e não ao
-- curso), então quem não está naquela turma não é avisado de nada.
--
-- Dispara quando a atividade nasce publicada e quando uma atividade
-- guardada passa a publicada. As duas portas importam: o professor às
-- vezes escreve com antecedência e publica no dia.
--
-- Se a abertura ainda vai acontecer, a frase DIZ QUANDO. Avisar sem
-- dizer isso faria o aluno abrir a tela, não encontrar nada e concluir
-- que a plataforma está errada.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION avisar_atividade_publicada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_turma TEXT; v_quando TEXT;
BEGIN
  IF NEW.publicada IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.publicada IS TRUE THEN RETURN NEW; END IF;

  SELECT nome INTO v_turma FROM turmas WHERE id = NEW.turma_id;

  v_quando :=
    CASE
      WHEN NEW.abre_em IS NOT NULL AND NEW.abre_em > NOW()
        THEN ' Abre em ' || to_char(NEW.abre_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') || '.'
      WHEN NEW.vence_em IS NOT NULL
        THEN ' Entregar até ' ||
             to_char(NEW.vence_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') || ' às ' ||
             to_char(NEW.vence_em AT TIME ZONE 'America/Sao_Paulo', 'HH24hMI') || '.'
      ELSE ''
    END;

  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link, origem, origem_id)
  SELECT ta.aluno_id,
         'Nova atividade' || COALESCE(' em ' || v_turma, ''),
         '"' || NEW.titulo || '".' || v_quando,
         'atividade',
         '/dashboard/aluno/atividades',
         'atividade', NEW.id
    FROM turma_alunos ta
    JOIN users u ON u.id = ta.aluno_id
   WHERE ta.turma_id = NEW.turma_id
     AND ta.status = 'ativo'
     AND COALESCE(u.ativo, TRUE)
  ON CONFLICT (user_id, origem, origem_id) WHERE origem IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avisar_atividade_publicada ON atividades;
CREATE TRIGGER trg_avisar_atividade_publicada
  AFTER INSERT OR UPDATE OF publicada ON atividades
  FOR EACH ROW EXECUTE FUNCTION avisar_atividade_publicada();


-- ------------------------------------------------------------
-- 5. ATIVIDADE CHEGANDO NO PRAZO
--
-- Este é o único dos cinco que não nasce de uma linha mudando: nada
-- acontece no banco quando o prazo se aproxima. Alguém precisa perguntar.
-- Quem pergunta é o próprio banco, uma vez por dia (ver o fim do arquivo).
--
-- DESTINATÁRIO: só quem tem a atividade PENDENTE — aluno ativo da turma
-- que ainda não entregou. Cobrar prazo de quem já entregou é o jeito mais
-- rápido de a pessoa passar a ignorar os avisos da plataforma.
--
-- QUARENTA E OITO HORAS, e não vinte e quatro: boa parte das atividades
-- desta escola é feita à mão e digitalizada. Um dia de aviso significa,
-- na prática, avisar quem já não tem mais como fazer.
--
-- UMA VEZ SÓ POR ATIVIDADE, garantido pelo índice único. A rotina roda
-- todo dia e a janela de 48h cobre dois dias — sem a trava, quem não
-- entregasse receberia o mesmo recado duas vezes.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION avisar_prazos_proximos(p_horas INTEGER DEFAULT 48)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_criados INTEGER;
BEGIN
  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link, origem, origem_id)
  SELECT ta.aluno_id,
         'Falta pouco para entregar',
         '"' || a.titulo || '" vence em ' ||
           to_char(a.vence_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') || ' às ' ||
           to_char(a.vence_em AT TIME ZONE 'America/Sao_Paulo', 'HH24hMI') ||
           ' e você ainda não entregou.',
         'prazo',
         '/dashboard/aluno/atividades',
         'prazo', a.id
    FROM atividades a
    JOIN turma_alunos ta ON ta.turma_id = a.turma_id AND ta.status = 'ativo'
    JOIN users u ON u.id = ta.aluno_id AND COALESCE(u.ativo, TRUE)
   WHERE a.publicada IS TRUE
     AND a.vence_em IS NOT NULL
     AND a.vence_em > NOW()
     AND a.vence_em <= NOW() + make_interval(hours => p_horas)
     -- Já aberta: cobrar prazo de algo que ainda nem começou é ruído.
     AND (a.abre_em IS NULL OR a.abre_em <= NOW())
     -- PENDENTE: sem entrega nenhuma daquele aluno naquela atividade.
     AND NOT EXISTS (
       SELECT 1 FROM entregas e
        WHERE e.atividade_id = a.id AND e.aluno_id = ta.aluno_id
     )
  ON CONFLICT (user_id, origem, origem_id) WHERE origem IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_criados = ROW_COUNT;
  RETURN v_criados;
END;
$$;


-- ------------------------------------------------------------
-- 6. PEDIDO PAGO
--
-- DESTINATÁRIOS, e só eles:
--   * QUEM COMPROU — precisa saber que o pagamento caiu e que já pode
--     retirar. É o recado que evita a ligação "meu pix já foi?".
--   * A COORDENAÇÃO (admins ativos) — é quem separa e entrega o produto.
--     Sem esse aviso, o pedido pago fica esperando alguém abrir a tela de
--     pedidos por acaso.
-- Professor não entra: a loja não é assunto dele.
--
-- Dispara na virada para "pago", venha ela do aviso automático do Asaas
-- ou da confirmação na mão da secretaria — as duas passam pela mesma
-- coluna, e por isso o gatilho vive aqui e não em cada uma das telas.
--
-- Cada destinatário tem sua própria linha no índice único, então o
-- comprador e cada admin recebem um aviso — e nunca dois.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION avisar_pedido_pago()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_comprador TEXT; v_valor TEXT; v_itens TEXT;
BEGIN
  IF NEW.status <> 'pago' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pago' THEN RETURN NEW; END IF;

  SELECT name INTO v_comprador FROM users WHERE id = NEW.comprador_id;

  -- Dinheiro é inteiro em centavos no projeto inteiro; a vírgula só
  -- aparece na hora de escrever para gente ler.
  v_valor := 'R$ ' || replace(to_char(NEW.total_centavos / 100.0, 'FM999999990.00'), '.', ',');

  -- `pedido_itens.nome` é o nome CONGELADO no fechamento do pedido (ver
  -- migração 025): renomear o produto depois não reescreve o recado.
  SELECT string_agg(pi.nome, ', ' ORDER BY pi.nome)
    INTO v_itens
    FROM pedido_itens pi WHERE pi.pedido_id = NEW.id;

  -- Quem comprou.
  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link, origem, origem_id)
  VALUES (
    NEW.comprador_id,
    'Pagamento confirmado',
    'Seu pedido de ' || v_valor || COALESCE(' (' || v_itens || ')', '') ||
      ' está pago. Retire na secretaria da escola.',
    'pedido',
    '/dashboard/aluno/pedidos',
    'pedido', NEW.id
  )
  ON CONFLICT (user_id, origem, origem_id) WHERE origem IS NOT NULL DO NOTHING;

  -- Quem entrega.
  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link, origem, origem_id)
  SELECT u.id,
         'Pedido pago, pronto para separar',
         COALESCE(v_comprador, 'Um aluno') || ' pagou ' || v_valor ||
           COALESCE(': ' || v_itens, '') || '.',
         'pedido',
         '/dashboard/admin/pedidos',
         'pedido', NEW.id
    FROM users u
   WHERE u.role = 'admin'
     AND COALESCE(u.ativo, TRUE)
     AND u.id <> NEW.comprador_id
  ON CONFLICT (user_id, origem, origem_id) WHERE origem IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avisar_pedido_pago ON pedidos;
CREATE TRIGGER trg_avisar_pedido_pago
  AFTER INSERT OR UPDATE OF status ON pedidos
  FOR EACH ROW EXECUTE FUNCTION avisar_pedido_pago();


-- ------------------------------------------------------------
-- 7. AULA PUBLICADA
--
-- DESTINATÁRIO: os alunos ativos das turmas DAQUELE MÓDULO — que é
-- exatamente quem enxerga a aula. A aula pertence ao módulo desde a
-- migração 022; usar o curso aqui avisaria o aluno do Módulo 1 sobre uma
-- aula do Módulo 3, que ele nem consegue abrir. (`curso_id` continua
-- servindo de reserva para as turmas antigas, que nasceram sem módulo.)
--
-- E respeita a JANELA DA AULA (`aula_turma`, migração 021): turma cujo
-- prazo daquela aula já passou não é avisada — para aquela turma a aula
-- não está disponível. A turma cuja janela ainda vai abrir É avisada, com
-- a data na frase: a aula é dela, só ainda não chegou a vez.
--
-- Rascunho não avisa ninguém: só quando `publicada` vira verdadeira.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION avisar_aula_publicada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_modulo TEXT;
BEGIN
  IF NEW.publicada IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.publicada IS TRUE THEN RETURN NEW; END IF;

  SELECT nome INTO v_modulo FROM modulos WHERE id = NEW.modulo_id;

  INSERT INTO notificacoes (user_id, titulo, corpo, tipo, link, origem, origem_id)
  SELECT ta.aluno_id,
         'Nova aula disponível',
         'Aula ' || NEW.numero || ' — "' || NEW.titulo || '"' ||
           COALESCE(' (' || v_modulo || ')', '') || '.' ||
           CASE WHEN at.abre_em IS NOT NULL AND at.abre_em > NOW()
                THEN ' Libera em ' ||
                     to_char(at.abre_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') || '.'
                ELSE '' END,
         'aula',
         COALESCE('/dashboard/aluno/cursos/' || NEW.curso_id || '?aula=' || NEW.id,
                  '/dashboard/aluno/cursos'),
         'aula', NEW.id
    FROM turmas t
    JOIN turma_alunos ta ON ta.turma_id = t.id AND ta.status = 'ativo'
    JOIN users u ON u.id = ta.aluno_id AND COALESCE(u.ativo, TRUE)
    LEFT JOIN aula_turma at ON at.turma_id = t.id AND at.aula_id = NEW.id
   WHERE (
           (NEW.modulo_id IS NOT NULL AND t.modulo_id = NEW.modulo_id)
        OR (NEW.modulo_id IS NULL AND t.curso_id = NEW.curso_id)
         )
     AND (at.vence_em IS NULL OR at.vence_em >= NOW())
  ON CONFLICT (user_id, origem, origem_id) WHERE origem IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avisar_aula_publicada ON aulas;
CREATE TRIGGER trg_avisar_aula_publicada
  AFTER INSERT OR UPDATE OF publicada ON aulas
  FOR EACH ROW EXECUTE FUNCTION avisar_aula_publicada();


-- ------------------------------------------------------------
-- 8. FECHAR AS FUNÇÕES
--
-- A lição cara da migração 026, e ela vale para toda função nova em
-- `public`: o Supabase concede EXECUTE em funções novas DIRETAMENTE a
-- `anon` e `authenticated`. Revogar de `PUBLIC` não desfaz isso — são
-- concessões separadas, e a específica sobrevive.
--
-- Sem estas linhas, qualquer pessoa logada chamaria
-- `avisar_prazos_proximos()` pela API e encheria a central de avisos de
-- toda a escola. As funções de gatilho vão junto por higiene.
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION avisar_prazos_proximos(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION avisar_nota_lancada() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION avisar_atividade_publicada() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION avisar_pedido_pago() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION avisar_aula_publicada() FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------
-- 9. QUEM PERGUNTA PELO PRAZO, TODO DIA
--
-- `pg_cron` roda dentro do próprio Postgres. É o caminho que não depende
-- de painel nenhum, não depende de a Vercel acordar a aplicação e não
-- precisa de um endereço público protegido por senha — que seria mais
-- uma coisa para vazar.
--
-- 11:00 UTC = 8h da manhã em Brasília. O banco trabalha em UTC; o horário
-- foi escolhido pensando em quem lê: recado de prazo às 3 da manhã é
-- recado que ninguém vê.
--
-- `DO` com tratamento de erro para a migração poder rodar de novo sem
-- reclamar que a tarefa já existe.
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('ibau_prazos_proximos');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'ibau_prazos_proximos',
  '0 11 * * *',
  $$SELECT avisar_prazos_proximos(48)$$
);
