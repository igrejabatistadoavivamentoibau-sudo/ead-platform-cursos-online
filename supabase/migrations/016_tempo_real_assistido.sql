-- 016: a presença passa a depender do tempo REALMENTE assistido. (Já aplicada.)
--
-- Antes guardávamos só o percentual, e o percentual vinha de
-- "posição da agulha / duração". Arrastar a barrinha até o fim marcava a
-- aula inteira e gerava presença sem a pessoa ter assistido nada.
--
-- Agora o navegador manda os SEGUNDOS distintos do vídeo que passaram pela
-- tela, e o servidor guarda também a duração e o momento em que a aula foi
-- aberta pela primeira vez. Com esses três dados dá para checar duas coisas
-- que uma requisição forjada não consegue contornar:
--   1. tempo assistido >= 90% da duração;
--   2. tempo de relógio decorrido compatível com ter assistido.

ALTER TABLE aula_progresso
  ADD COLUMN IF NOT EXISTS segundos_assistidos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duracao_segundos INTEGER,
  ADD COLUMN IF NOT EXISTS iniciado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE aula_progresso
SET iniciado_em = COALESCE(iniciado_em, updated_at, NOW())
WHERE iniciado_em IS NULL;

COMMENT ON COLUMN aula_progresso.segundos_assistidos IS
  'Segundos distintos do vídeo que realmente passaram pela tela. Pular não conta.';
COMMENT ON COLUMN aula_progresso.duracao_segundos IS
  'Duração do vídeo lida pelo player na primeira vez. Não diminui depois.';
COMMENT ON COLUMN aula_progresso.iniciado_em IS
  'Primeira vez que o aluno abriu esta aula. Serve para checar se houve tempo de assistir.';
