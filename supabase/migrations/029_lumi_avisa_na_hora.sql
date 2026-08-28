-- ============================================================
-- A LUMI AVISA NA HORA
--
-- Uma linha de verdade, e um parágrafo explicando por quê.
--
-- A tabela `notificacoes` já existe (015), já tem regra de dono (RLS) e
-- já é alimentada pelos gatilhos (015, 020, 021, 022 e 028). NADA disso
-- muda. O que falta é a plataforma poder SABER, no instante em que
-- acontece, que apareceu um aviso para quem está com a tela aberta.
--
-- Sem isto, o aviso só aparece na próxima troca de tela. E o caso mais
-- comum é justamente o pior: o aluno parado na tela de notas esperando o
-- professor lançar. Ele fica olhando para uma tela que já está velha.
--
-- A alternativa seria a página perguntar de tempos em tempos "chegou algo
-- para mim?". Isso é uma pergunta ao servidor por pessoa, por intervalo,
-- para todo mundo ao mesmo tempo — quase sempre respondida com "não". O
-- tempo real inverte: o banco fala quando tem o que falar.
--
-- É O MESMO MECANISMO QUE A CONVERSA DA TURMA JÁ USA. `mensagens` está
-- nesta publicação desde a migração 015; `notificacoes` está entrando
-- pela mesma porta. Nenhum caminho novo.
--
-- A REGRA DE QUEM VÊ O QUE CONTINUA VALENDO. Entrar na publicação não
-- abre nada: o tempo real do Supabase aplica a mesma RLS da tabela, e a
-- política de `notificacoes` é `auth.uid() = user_id`. Cada pessoa recebe
-- o que é dela, e só.
-- ============================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A linha inteira precisa viajar para o navegador saber de quem é o
-- aviso; com o padrão do Postgres, um UPDATE viajaria só com a chave.
-- (Hoje a LUMI só escuta INSERT, mas deixar a tabela meio configurada é
-- o tipo de coisa que dá trabalho para descobrir daqui a seis meses.)
ALTER TABLE notificacoes REPLICA IDENTITY FULL;
