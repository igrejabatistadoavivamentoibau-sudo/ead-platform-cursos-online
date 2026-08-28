-- ============================================================
-- O MÓDULO É UM NOME, UM RECADO E UM VÍDEO DE BOAS-VINDAS
--
-- Pedido dela: "Módulo é só um nome, as disciplinas que têm as aulas, no
-- módulo deixe disponível a possibilidade de incluir um vídeo de boas
-- vindas."
--
-- O QUE MUDA AQUI (E O QUE NÃO MUDA)
--
-- A estrutura de dados já estava pronta desde a 030: aula pertence a uma
-- disciplina, disciplina pertence a um módulo. O que faltava era o módulo
-- ter algo PRÓPRIO para mostrar — sem isso ele é só uma pasta, e uma pasta
-- não recebe ninguém.
--
-- Então entra UMA coluna: o link do vídeo de boas-vindas.
--
-- POR QUE UM LINK, E NÃO UM ARQUIVO ENVIADO
--
-- O arquivo enviado direto para a plataforma passa pela porta com cadeado
-- (`/api/aulas/[id]/video`), que confere matrícula, módulo aberto e prazo
-- da AULA. Um vídeo de boas-vindas não tem prazo nem número: ele é a porta
-- de entrada do módulo, e quem chega nele já passou pelo cadeado do
-- módulo.
--
-- Guardar o link é o mesmo caminho que a esmagadora maioria das aulas já
-- usa hoje (YouTube não listado, Drive, OneDrive), atravessa o mesmo
-- `analisarVideo` e toca no mesmo player. Não há segunda máquina de vídeo
-- na plataforma — que é a regra do projeto: evoluir o que existe em vez de
-- criar uma segunda versão ao lado.
--
-- A DESCRIÇÃO NÃO PRECISOU DE COLUNA NOVA: `modulos.descricao` já existe e
-- já aparece na tela. Ela vira o recado escrito que acompanha o vídeo.
-- ============================================================

alter table public.modulos
  add column if not exists video_boas_vindas text;

comment on column public.modulos.video_boas_vindas is
  'Link do vídeo de boas-vindas do módulo (YouTube, Vimeo, Drive, OneDrive ou arquivo direto). Lido por lib/video.ts, igual ao vídeo da aula.';

-- ------------------------------------------------------------
-- TODA DISCIPLINA PRECISA DE NOME PRÓPRIO PARA APARECER BEM
--
-- A disciplina automática nasce como 'Conteúdo do módulo' (gatilho da
-- 030). Isso servia enquanto ela ficava ESCONDIDA — o degrau só aparecia
-- quando existia mais de uma matéria.
--
-- Agora que as aulas moram sempre dentro de uma matéria, esse nome vira
-- texto na tela da coordenação. Ele continua sendo o padrão (é neutro e
-- não inventa uma matéria que a escola não tem), e a tela passa a
-- convidar a renomear. Nada de renomear em massa aqui: o nome da matéria
-- é decisão da escola, não do banco.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- CONFERÊNCIA: nenhuma aula pode estar fora de uma disciplina.
--
-- O gatilho `aula_entra_numa_disciplina` (030) já garante isso na
-- entrada. Esta linha é a rede de segurança para o que entrou ANTES dele
-- por algum caminho que não passou pelo gatilho.
-- ------------------------------------------------------------
do $$
declare
  v_soltas integer;
begin
  update public.aulas a
     set disciplina_id = (
       select d.id from public.disciplinas d
        where d.modulo_id = a.modulo_id
        order by d.padrao desc, d.ordem asc
        limit 1
     )
   where a.disciplina_id is null
     and a.modulo_id is not null;

  select count(*) into v_soltas
    from public.aulas
   where disciplina_id is null and modulo_id is not null;

  raise notice 'aulas ainda sem disciplina (esperado 0): %', v_soltas;
end $$;
