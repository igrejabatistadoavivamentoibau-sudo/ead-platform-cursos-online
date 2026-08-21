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
    var CHAVE_VEZES = 'ibau:recuperou-vezes';
    var ID_SENTINELA = 'ibau-sentinela-estilo';

    /* ---- QUANTAS TENTATIVAS, E POR QUE ESTE NÚMERO ----

       A versão anterior travava em "uma tentativa por minuto". Parecia
       prudente e estava errada: se a primeira recarga não resolvesse, a
       segunda — a que apaga o que guardamos no aparelho — só poderia
       acontecer um minuto depois. Ou seja, a válvula de escape existia no
       papel e ficava fechada justamente na hora do aperto.

       O certo é o contrário: escalar rápido e parar cedo.
         1ª falha -> recarrega (quase sempre resolve: a publicação trocou
                     os arquivos e basta buscar os novos)
         2ª falha -> apaga TUDO o que é nosso no aparelho e recarrega
         3ª falha -> para. Se nem assim, o problema não é nosso (servidor
                     fora do ar, internet caída) e ficar recarregando só
                     piora. Melhor a pessoa ver a página como está do que
                     um piscar infinito.
       O intervalo mínimo de 3 segundos é só para não empilhar duas
       recargas no mesmo instante. */
    var LIMITE_DE_TENTATIVAS = 2;

    function recuperar(motivo) {
      var vezes = 1;
      try {
        var ultima = Number(sessionStorage.getItem(CHAVE) || 0);
        if (Date.now() - ultima < 3000) return;
        vezes = Number(sessionStorage.getItem(CHAVE_VEZES) || 0) + 1;
        if (vezes > LIMITE_DE_TENTATIVAS) {
          try { console.warn('[IBAU] a tela segue quebrada e nao vou recarregar de novo:', motivo); } catch (e) {}
          return;
        }
        sessionStorage.setItem(CHAVE, String(Date.now()));
        sessionStorage.setItem(CHAVE_VEZES, String(vezes));
      } catch (e) { /* navegador sem armazenamento: segue mesmo assim */ }

      try { console.warn('[IBAU] recuperando a tela:', motivo, '| tentativa', vezes); } catch (e) {}

      // Endereço com marca de tempo: obriga o navegador a buscar tudo de
      // novo do servidor, em vez de reaproveitar o que ele guardou — que é
      // exatamente o que está quebrado.
      var url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString(36));

      // ---- O FREIO DE MÃO ----
      // A segunda tentativa não repete a primeira: ela apaga o cofre e o
      // operário de segundo plano antes de recarregar. A plataforma volta
      // ao estado de quem nunca entrou nela. É a garantia escrita de que
      // nenhuma invenção nossa — nem o cofre — consegue deixar a escola
      // presa numa tela quebrada.
      if (vezes >= LIMITE_DE_TENTATIVAS && navigator.serviceWorker && window.caches) {
        // A suspensão com prazo é o detalhe que faz diferença: sem ela, a
        // página recarregaria e o cofre se registraria de novo na hora,
        // trazendo de volta exatamente o que acabamos de apagar. Um dia,
        // depois, ele volta sozinho — um deploy ruim não pode custar a
        // proteção para sempre.
        try {
          localStorage.setItem('ibau:cofre-suspenso-ate', String(Date.now() + 86400000));
        } catch (e) {}

        var voltar = function () { window.location.replace(url.toString()); };
        var limpeza = [
          navigator.serviceWorker.getRegistrations().then(function (rs) {
            return Promise.all(rs.map(function (r) { return r.unregister(); }));
          }),
          caches.keys().then(function (ns) {
            return Promise.all(ns.map(function (n) { return caches.delete(n); }));
          })
        ];
        // Se a limpeza travar, recarrega assim mesmo em 1,5s: nunca
        // deixamos o aluno parado esperando uma faxina.
        setTimeout(voltar, 1500);
        Promise.all(limpeza).then(voltar, voltar);
        return;
      }

      window.location.replace(url.toString());
    }

    // Uma tela que chegou inteira zera o contador: as falhas que interessam
    // são as SEGUIDAS, não duas quedas separadas por uma semana boa.
    function tudoCerto() {
      try { sessionStorage.removeItem(CHAVE_VEZES); } catch (e) {}
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
      else tudoCerto();
    }

    /* ---- QUANDO CONFERIR, E POR QUE MAIS DE UMA VEZ ----

       Eram duas conferidas (400ms e 2,5s). Faltava uma, e a falta só
       apareceu quando testei o pior caso: a primeira recarga acontece,
       a tela continua quebrada, e as duas conferidas da nova página caem
       DENTRO do intervalo mínimo de 3 segundos entre tentativas — então
       a segunda tentativa, a que apaga o que guardamos no aparelho, nunca
       chegava a acontecer. A válvula existia e não abria.

       Agora são quatro, espaçadas até passar dos 3 segundos. Conferir de
       novo não custa nada (é ler uma propriedade de um elemento) e, se a
       tela estiver boa, cada conferida apenas confirma isso e zera o
       contador. */
    var MOMENTOS = [400, 2500, 5200, 8000];
    function agendarConferidas() {
      for (var i = 0; i < MOMENTOS.length; i++) setTimeout(conferirEstilo, MOMENTOS[i]);
    }
    if (document.readyState === 'complete') agendarConferidas();
    else window.addEventListener('load', agendarConferidas);
  } catch (e) {
    // Guardião com defeito não pode derrubar a plataforma.
  }
})();
`.trim()
