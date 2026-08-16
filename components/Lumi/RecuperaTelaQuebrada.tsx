'use client'

import { useEffect } from 'react'

const CHAVE_TENTATIVA = 'ibau:recuperou-em'

/**
 * Rede de segurança contra a "tela branca com os textos sem design".
 *
 * POR QUE ISSO ACONTECE
 * O site é servido em pedaços (código e estilo) com nomes que mudam a cada
 * publicação. Quando um deploy acontece com a página aberta, o navegador
 * pode tentar buscar um pedaço que já não existe mais no servidor — ele
 * recebe erro, o estilo não carrega, e sobra o texto cru na tela. É um
 * estado quebrado de verdade, não impressão de quem está vendo.
 *
 * O QUE FAZEMOS
 * Escutamos as falhas de carregamento de pedaço e recarregamos a página
 * uma única vez, buscando tudo do servidor de novo. Do ponto de vista de
 * quem usa, a tela pisca e volta ao normal, em vez de ficar destruída até
 * alguém descobrir sozinho que precisa recarregar.
 *
 * O limite de uma tentativa por minuto é essencial: se a falha for por
 * outro motivo, recarregar em laço deixaria a plataforma inutilizável.
 */
export default function RecuperaTelaQuebrada() {
  useEffect(() => {
    const recarregarUmaVez = (motivo: string) => {
      const ultima = Number(sessionStorage.getItem(CHAVE_TENTATIVA) ?? 0)
      if (Date.now() - ultima < 60_000) return // já tentamos há pouco
      sessionStorage.setItem(CHAVE_TENTATIVA, String(Date.now()))
      console.warn('[LUMI] recarregando para recuperar a tela:', motivo)
      const url = new URL(window.location.href)
      url.searchParams.set('v', Date.now().toString(36))
      window.location.replace(url.toString())
    }

    // Falha ao buscar um arquivo de código ou de estilo
    const aoErrarRecurso = (e: Event) => {
      const alvo = e.target as HTMLElement | null
      if (!alvo) return
      const ehEstilo = alvo.tagName === 'LINK' && (alvo as HTMLLinkElement).rel === 'stylesheet'
      const ehScript = alvo.tagName === 'SCRIPT'
      if (ehEstilo || ehScript) recarregarUmaVez(`${alvo.tagName} não carregou`)
    }

    // O Next avisa por erro quando um pedaço some entre publicações
    const aoErrar = (e: ErrorEvent) => {
      const msg = e.message ?? ''
      if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported/i.test(msg)) {
        recarregarUmaVez(msg)
      }
    }

    const aoRejeitar = (e: PromiseRejectionEvent) => {
      const msg = String((e.reason as Error)?.message ?? e.reason ?? '')
      if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported/i.test(msg)) {
        recarregarUmaVez(msg)
      }
    }

    // O terceiro argumento é obrigatório: falha de recurso não sobe pela
    // árvore, só é capturada na descida.
    window.addEventListener('error', aoErrarRecurso, true)
    window.addEventListener('error', aoErrar)
    window.addEventListener('unhandledrejection', aoRejeitar)
    return () => {
      window.removeEventListener('error', aoErrarRecurso, true)
      window.removeEventListener('error', aoErrar)
      window.removeEventListener('unhandledrejection', aoRejeitar)
    }
  }, [])

  return null
}
