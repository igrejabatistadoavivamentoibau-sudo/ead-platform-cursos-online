/* ============================================================
   O COFRE DOS ARQUIVOS

   O PROBLEMA, DITO SEM ENFEITE
   Quando publicamos uma versão nova, os arquivos de código e de estilo da
   versão anterior deixam de existir no servidor. Quem estava com a página
   aberta continua com o endereço VELHO na mão. Ele pede o arquivo, recebe
   "não existe", e a tela desmonta na frente do aluno — texto sem estilo,
   barra lateral sumida, botão que não responde.

   Não é culpa da hospedagem: é assim em qualquer servidor. O que existe de
   pronto para resolver isso são chaves no painel de cada plataforma, uma
   diferente em cada uma. Este arquivo resolve DENTRO da plataforma, sem
   depender de painel nenhum.

   COMO
   Este é um "operário de segundo plano" (service worker): um programinha
   que o navegador guarda e coloca na frente de toda requisição de arquivo,
   inclusive quando a página está sendo montada do zero. Ele guarda uma
   cópia de cada arquivo de /_next/static/ na máquina do aluno. Se o
   servidor não tiver mais aquele arquivo, ele entrega a cópia. A página
   velha continua inteira, funcionando, até a pessoa clicar para atualizar.

   POR QUE GUARDAR NÃO CORRE RISCO DE ENTREGAR COISA VELHA
   Os arquivos de /_next/static/ têm o resumo do próprio conteúdo no nome
   (algo como `pagina-8a6e8136.js`). Conteúdo diferente = nome diferente.
   Então "guardar para sempre" nunca devolve a coisa errada: se mudou, o
   endereço é outro, e esse outro será buscado no servidor normalmente.

   O QUE ELE NÃO TOCA — E ISTO É O MAIS IMPORTANTE DO ARQUIVO
   Só /_next/static/. Nada de páginas, nada de /api, nada de Supabase,
   nada de login, nada de foto, nada que não seja GET. Notas, presenças e
   sessão do aluno NUNCA passam por aqui e NUNCA ficam guardadas. Um cofre
   que guardasse página de aluno seria um vazamento de dados num
   computador compartilhado — por isso o filtro é uma lista fechada, e não
   uma lista de exceções.
   ============================================================ */

const NOME_DO_COFRE = 'ibau-cofre-v1'
const PASTA = '/_next/static/'

/* Teto de arquivos guardados. A plataforma inteira cabe com folga; o teto
   existe só para que anos de publicações não virem um depósito infinito no
   telefone de ninguém. */
const TETO = 600

/** Este endereço é assunto do cofre? Lista fechada, de propósito. */
function ehArquivoDaPlataforma(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(PASTA)
}

self.addEventListener('install', () => {
  // Assume o posto na hora. Sem isto, um cofre novo ficaria "esperando a
  // vez" até todas as abas fecharem — e a correção só valeria amanhã.
  self.skipWaiting()
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      // Some com cofres de gerações anteriores (v1 -> v2 -> ...), não com
      // os arquivos da geração atual.
      const nomes = await caches.keys()
      await Promise.all(
        nomes
          .filter((n) => n.startsWith('ibau-cofre-') && n !== NOME_DO_COFRE)
          .map((n) => caches.delete(n))
      )
      await podar()
      await self.clients.claim()
    })()
  )
})

/** Mantém o cofre abaixo do teto, descartando os mais antigos primeiro. */
async function podar() {
  try {
    const cofre = await caches.open(NOME_DO_COFRE)
    const chaves = await cofre.keys() // vêm na ordem em que entraram
    const sobra = chaves.length - TETO
    for (let i = 0; i < sobra; i++) await cofre.delete(chaves[i])
  } catch (e) {
    /* cofre cheio ou indisponível: seguimos sem podar */
  }
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  if (pedido.method !== 'GET') return

  let url
  try {
    url = new URL(pedido.url)
  } catch (e) {
    return
  }
  // Qualquer coisa fora da lista fechada segue o caminho normal, como se
  // este arquivo não existisse.
  if (!ehArquivoDaPlataforma(url)) return

  evento.respondWith(
    (async () => {
      const cofre = await caches.open(NOME_DO_COFRE)

      // `ignoreSearch` porque o endereço pode vir com sufixos de controle
      // (?dpl=, ?v=) que não mudam o conteúdo do arquivo.
      const guardado = await cofre.match(pedido, { ignoreSearch: true })
      if (guardado) return guardado

      try {
        const resposta = await fetch(pedido)
        if (resposta && resposta.status === 200 && resposta.type !== 'opaque') {
          // Guarda sem segurar a resposta: o aluno recebe o arquivo agora,
          // a cópia entra no cofre em seguida.
          const copia = resposta.clone()
          evento.waitUntil(cofre.put(pedido, copia).then(podar).catch(() => {}))
        }
        return resposta
      } catch (erro) {
        // Sem rede: se tivermos a cópia, o aluno nem percebe.
        const ultimo = await cofre.match(pedido, { ignoreSearch: true })
        if (ultimo) return ultimo
        throw erro
      }
    })()
  )
})

/* ------------------------------------------------------------------
   RECADOS DA PÁGINA

   GUARDAR: na PRIMEIRA visita o cofre ainda não estava no posto quando o
   navegador pediu o estilo e o código — então justamente os arquivos mais
   importantes ficariam de fora. A página manda a lista do que ela usou e
   o cofre busca essas cópias. Da segunda visita em diante isso é
   redundante, e redundância aqui é barata.

   ESVAZIAR: a válvula de escape. Se algum dia o cofre atrapalhar, a
   página manda esvaziar e ele se apaga por inteiro.
   ------------------------------------------------------------------ */
self.addEventListener('message', (evento) => {
  const recado = evento.data || {}

  if (recado.tipo === 'guardar' && Array.isArray(recado.enderecos)) {
    evento.waitUntil(
      (async () => {
        const cofre = await caches.open(NOME_DO_COFRE)
        for (const endereco of recado.enderecos.slice(0, TETO)) {
          try {
            const url = new URL(endereco, self.location.origin)
            if (!ehArquivoDaPlataforma(url)) continue
            if (await cofre.match(url.href, { ignoreSearch: true })) continue
            const r = await fetch(url.href, { credentials: 'same-origin' })
            if (r && r.status === 200) await cofre.put(url.href, r)
          } catch (e) {
            /* um arquivo que não deu para guardar não derruba os outros */
          }
        }
        await podar()
      })()
    )
  }

  if (recado.tipo === 'esvaziar') {
    evento.waitUntil(
      (async () => {
        const nomes = await caches.keys()
        await Promise.all(
          nomes.filter((n) => n.startsWith('ibau-cofre-')).map((n) => caches.delete(n))
        )
      })()
    )
  }
})
