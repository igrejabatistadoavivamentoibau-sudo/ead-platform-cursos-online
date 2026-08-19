/* ============================================================
   O GUARDIÃO DA TELA

   POR QUE ESTE CÓDIGO É UM TEXTO, E NÃO UM COMPONENTE

   A "tela branca com os textos sem design" já foi atacada duas vezes com
   um componente React, e as duas falharam — por um motivo que só ficou
   claro agora: o estilo quebra ANTES do React existir.

   A sequência real é esta:
     1. o navegador lê o <head> e pede o arquivo de estilo;
     2. o arquivo não existe mais (a publicação trocou o nome dele);
     3. o navegador dispara um erro AGORA, e segue desenhando sem estilo;
     4. segundos depois o React acorda e instala o ouvinte de erro.
   No passo 4 o erro do passo 3 já passou. Ninguém escutou. A rede de
   segurança chegava sempre atrasada.

   Este arquivo devolve um pedaço de código que o navegador executa como
   PRIMEIRA coisa da página, antes de qualquer estilo e de qualquer outro
   script. Ele não depende do React, não depende de nada carregar direito —
   é justamente para quando as coisas não carregam.

   E ele não confia só em escutar o erro: também CONFERE o resultado. Um
   elemento invisível serve de sentinela — se o estilo tivesse carregado,
   ele estaria escondido. Se ele aparece, o estilo não veio, ponto final.
   Estado se confere a qualquer hora; evento só existe no instante em que
   acontece.
   ============================================================ */

/**
 * O texto do guardião, para ser injetado no <head>.
 *
 * Escrito em JavaScript simples de propósito (nada de sintaxe moderna que
 * precise ser convertida): ele roda cru, exatamente como está aqui.
 */
export const GUARDIAO_DA_TELA = `
(function () {
  try {
    var CHAVE = 'ibau:recuperou-em';
    var ID_SENTINELA = 'ibau-sentinela-estilo';

    function recuperar(motivo) {
      try {
        var ultima = Number(sessionStorage.getItem(CHAVE) || 0);
        // Uma tentativa por minuto. Sem esta trava, uma falha permanente
        // (servidor fora do ar, por exemplo) viraria um laço de recargas e
        // a plataforma ficaria inutilizável.
        if (Date.now() - ultima < 60000) return;
        sessionStorage.setItem(CHAVE, String(Date.now()));
      } catch (e) { /* navegador sem armazenamento: segue mesmo assim */ }

      try { console.warn('[IBAU] recuperando a tela:', motivo); } catch (e) {}

      // Endereço com marca de tempo: obriga o navegador a buscar tudo de
      // novo do servidor, em vez de reaproveitar o que ele guardou — que é
      // exatamente o que está quebrado.
      var url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString(36));
      window.location.replace(url.toString());
    }

    // ---- 0. A largura da barra lateral, ANTES do primeiro traço ----
    // A preferência de barra recolhida mora no navegador. Se ela só fosse
    // lida depois que o React acorda, a barra nasceria larga e saltaria
    // para estreita na frente do aluno. Marcando aqui, o estilo já desenha
    // com a largura certa — e ninguém vê pulo nenhum.
    try {
      if (localStorage.getItem('ibau:sidebar-collapsed') === '1') {
        document.documentElement.setAttribute('data-nav-recolhida', '1');
      }
    } catch (e) { /* sem armazenamento: nasce larga, que é o padrão */ }

    // ---- 1. Escuta as falhas de carregamento, desde o primeiro arquivo ----
    window.addEventListener('error', function (e) {
      var alvo = e && e.target;
      if (!alvo || !alvo.tagName) return;
      var tag = alvo.tagName.toUpperCase();
      if (tag === 'LINK' && alvo.rel === 'stylesheet') recuperar('estilo nao carregou');
      else if (tag === 'SCRIPT') recuperar('script nao carregou');
    }, true);

    window.addEventListener('error', function (e) {
      var msg = (e && e.message) || '';
      if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported/i.test(msg)) {
        recuperar(msg);
      }
    });

    window.addEventListener('unhandledrejection', function (e) {
      var r = e && e.reason;
      var msg = (r && r.message) || String(r || '');
      if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported/i.test(msg)) {
        recuperar(msg);
      }
    });

    // ---- 2. Confere o resultado: o estilo chegou a valer? ----
    function conferirEstilo() {
      var s = document.getElementById(ID_SENTINELA);
      if (!s) return;
      // A sentinela usa a classe que o nosso estilo esconde. Se ela está
      // visível, o estilo não foi aplicado — e a tela está crua.
      var visivel = getComputedStyle(s).display !== 'none';
      if (visivel) recuperar('estilo ausente (sentinela visivel)');
    }

    // Duas conferidas: uma quando a página termina de montar, outra um
    // pouco depois, para o caso de o estilo estar apenas demorando.
    if (document.readyState === 'complete') {
      setTimeout(conferirEstilo, 400);
    } else {
      window.addEventListener('load', function () { setTimeout(conferirEstilo, 400); });
    }
    setTimeout(conferirEstilo, 2500);
  } catch (e) {
    // Guardião com defeito não pode derrubar a plataforma.
  }
})();
`.trim()
