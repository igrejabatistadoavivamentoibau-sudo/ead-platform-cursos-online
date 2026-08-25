/* ============================================================
   O PORTEIRO DO LINK DE RECUPERAÇÃO

   POR QUE ISTO EXISTE

   Quando a pessoa clica no link do e-mail, o Supabase confere o token e
   devolve o navegador para a plataforma com a chave de entrada pendurada
   no endereço, depois do "#". Para onde ele devolve é decidido por uma
   LISTA DE ENDEREÇOS PERMITIDOS que mora no painel do Supabase. Se o
   endereço que a gente pede não estiver nessa lista, o Supabase ignora o
   pedido e devolve para o endereço principal do site — a página inicial.

   A saída de manual seria abrir o painel e cadastrar o endereço. Não é o
   acordo deste projeto: painel é trabalho manual que sempre sobra para
   ela, e um dia o domínio muda e ninguém lembra que existia essa lista.

   Então a plataforma passa a aceitar o retorno EM QUALQUER PÁGINA. Este
   pedaço de código roda como primeira coisa de toda página, reconhece o
   retorno, e leva a pessoa para a tela de nova senha. Cadastrado na lista
   ou não, o link funciona.

   POR QUE UM TEXTO NO <head>, E NÃO UM COMPONENTE

   Mesmo motivo do guardião da tela, e mais um, específico daqui: o cliente
   do Supabase, assim que carrega, olha o endereço sozinho procurando
   sessão. Se ele vir a chave primeiro, consome (ou recusa) do jeito dele e
   apaga o endereço — e aí não sobra nada para a nossa tela. Rodando no
   <head>, este código chega ANTES de qualquer módulo carregar.

   E ELE TIRA A CHAVE DA BARRA DE ENDEREÇO

   A chave de entrada vai para a memória da aba (`sessionStorage`) e o "#"
   some do endereço. Assim ela não fica no histórico do navegador, não
   aparece num print de tela e não vai junto num endereço copiado e colado
   para outra pessoa. O que vem depois do "#" nunca chega ao servidor, mas
   fica na tela — e tela também vaza.
   ============================================================ */

/** Onde a chave de entrada fica guardada até a tela de nova senha pegá-la. */
export const CHAVE_DO_LINK = 'ibau:link-de-recuperacao'

/** A tela que faz a troca. */
export const TELA_DE_NOVA_SENHA = '/auth/nova-senha'

/**
 * O texto do porteiro, para ser injetado no <head>.
 *
 * JavaScript simples de propósito — roda cru, exatamente como está aqui.
 *
 * Ele **só olha o que vem depois do "#"**. A entrada pelo Google devolve o
 * código depois do "?", e nada aqui encosta nisso: o login com Google
 * continua igual.
 */
export const PORTEIRO_DO_LINK = `
(function () {
  var CHAVE = '${CHAVE_DO_LINK}';
  var DESTINO = '${TELA_DE_NOVA_SENHA}';

  function atender(porMudancaDeEndereco) {
    var h = window.location.hash || '';
    if (h.length < 2) return;

    /* As duas formas de retorno que o provedor produz:
       - deu certo: vem a chave de entrada E a de renovação;
       - deu errado: vem o motivo (link vencido, link já usado).
       Exigir as DUAS chaves na primeira forma é de propósito: com metade
       delas a sessão morreria no meio da troca de senha. */
    var entrada = h.indexOf('access_token=') > -1 && h.indexOf('refresh_token=') > -1;
    var recusa = h.indexOf('error=') > -1 || h.indexOf('error_code=') > -1;
    if (!entrada && !recusa) return;

    var caminho = window.location.pathname;
    var guardou = false;

    try {
      window.sessionStorage.setItem(CHAVE, h);
      guardou = true;
    } catch (e) {
      /* Navegador em modo privado com armazenamento bloqueado. Não é
         motivo para a pessoa ficar sem trocar a senha: seguimos levando a
         chave no próprio endereço, como o provedor mandou. */
    }

    if (guardou) {
      try {
        window.history.replaceState(
          window.history.state,
          '',
          caminho + (window.location.search || '')
        );
      } catch (e) {}
    }

    if (caminho !== DESTINO) {
      window.location.replace(guardou ? DESTINO : DESTINO + h);
      return;
    }

    /* Já estamos na tela certa. Se a chave chegou por MUDANÇA DE ENDEREÇO
       na mesma página, a tela não foi montada de novo e continuaria
       mostrando o que mostrava antes — por isso o recarregamento. Ver o
       comentário do ouvinte, logo abaixo. */
    if (porMudancaDeEndereco) window.location.reload();
  }

  try {
    atender(false);
  } catch (e) {
    /* Nada aqui pode derrubar a página. Se este código falhar, o pior que
       acontece é a pessoa ver a tela inicial e pedir o link de novo. */
  }

  /* ---- O CASO QUE O TESTE ENCONTROU ----

     Trocar só o pedaço depois do "#" NÃO recarrega a página: para o
     navegador é a mesma página, e nem este código nem a tela rodam de
     novo. Acontece de verdade quando a pessoa já está com a plataforma
     aberta numa aba e cola ali o link que veio do e-mail — a barra de
     endereço muda, e não acontece nada. Ela conclui que o link não
     funciona e pede outro, que vai dar no mesmo.

     O ouvinte fecha esse buraco. */
  try {
    window.addEventListener('hashchange', function () {
      try {
        atender(true);
      } catch (e) {}
    });
  } catch (e) {}
})();
`
