'use client'

import { useEffect } from 'react'

/* ============================================================
   QUEM COLOCA O COFRE NO POSTO

   Componente sem nada na tela. Ele só faz três coisas, e as três existem
   por um motivo que já custou caro:

   1) REGISTRA o cofre (public/sw.js), que é o que faz a página aberta
      sobreviver a uma publicação.

   2) ENTREGA A LISTA do que esta página usou. Na primeiríssima visita o
      cofre ainda não estava no posto quando o navegador foi buscar o
      estilo e o código — ou seja, os arquivos mais críticos ficariam de
      fora justamente de quem mais precisa. O navegador guarda um registro
      de tudo que baixou (`performance.getEntriesByType('resource')`), e é
      essa lista que mandamos.

   3) MANTÉM A VÁLVULA DE ESCAPE. Um cofre com defeito é pior que não ter
      cofre, porque ele fica grudado no navegador. Então existe um jeito
      de desligar sem precisar de suporte: abrir o endereço com `?cofre=off`
      no fim. Ele se apaga por inteiro, ANOTA que está desligado, e
      recarrega limpo. `?cofre=on` liga de volta.

      A anotação é o que a primeira versão disto errou: ela apagava e
      recarregava, e no recarregamento o próprio componente registrava o
      cofre de novo — desligar não desligava nada. Medido, corrigido.
   ============================================================ */

/** Enquanto esta marca existir, o cofre não é registrado. */
const MARCA_DESLIGADO = 'ibau:cofre-desligado'
/** Suspensão temporária, escrita pelo guardião quando a tela quebra feio. */
const MARCA_SUSPENSO = 'ibau:cofre-suspenso-ate'

export default function AbreOCofre() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const params = new URLSearchParams(window.location.search)
    const pedido = params.get('cofre')

    const recarregarLimpo = () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('cofre')
      url.searchParams.set('v', Date.now().toString(36))
      window.location.replace(url.toString())
    }

    // ---- Válvula de escape: desligar ----
    // Vem antes de tudo: se a pessoa está pedindo para desligar, não é hora
    // de registrar coisa nenhuma.
    if (pedido === 'off') {
      ;(async () => {
        try {
          localStorage.setItem(MARCA_DESLIGADO, '1')
        } catch {
          /* sem armazenamento: pelo menos limpamos o que dá */
        }
        try {
          navigator.serviceWorker.controller?.postMessage({ tipo: 'esvaziar' })
          const registros = await navigator.serviceWorker.getRegistrations()
          await Promise.all(registros.map((r) => r.unregister()))
          if (typeof caches !== 'undefined') {
            const nomes = await caches.keys()
            await Promise.all(nomes.map((n) => caches.delete(n)))
          }
        } catch {
          /* mesmo dando errado, seguimos para a recarga limpa */
        }
        recarregarLimpo()
      })()
      return
    }

    // ---- Válvula de escape: ligar de volta ----
    if (pedido === 'on') {
      try {
        localStorage.removeItem(MARCA_DESLIGADO)
        localStorage.removeItem(MARCA_SUSPENSO)
      } catch {
        /* nada a fazer */
      }
      recarregarLimpo()
      return
    }

    // Desligado à mão, ou suspenso pelo guardião depois de uma tela
    // quebrada. A suspensão tem prazo: um dia ruim não pode custar a
    // proteção para sempre.
    try {
      if (localStorage.getItem(MARCA_DESLIGADO) === '1') return
      const ate = Number(localStorage.getItem(MARCA_SUSPENSO) || 0)
      if (ate && Date.now() < ate) return
      if (ate) localStorage.removeItem(MARCA_SUSPENSO)
    } catch {
      /* sem armazenamento: segue e registra normalmente */
    }

    // Em desenvolvimento o cofre só atrapalha: cada salvamento gera arquivo
    // novo e a gente quer ver a mudança na hora, sem cópia nenhuma no meio.
    if (process.env.NODE_ENV !== 'production') return

    let cancelado = false

    const entregarALista = () => {
      const destino = navigator.serviceWorker.controller
      if (!destino || cancelado) return
      try {
        const enderecos = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((n) => n.includes('/_next/static/'))
        if (enderecos.length) destino.postMessage({ tipo: 'guardar', enderecos })
      } catch {
        /* navegador sem essa medição: o cofre se vira sozinho */
      }
    }

    const registrar = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await navigator.serviceWorker.ready
        if (cancelado) return
        // Na primeira visita o cofre só assume o comando depois do
        // `clients.claim()`; esperamos esse aviso para mandar a lista.
        if (navigator.serviceWorker.controller) entregarALista()
        else navigator.serviceWorker.addEventListener('controllerchange', entregarALista, { once: true })
      } catch {
        // Navegador que recusa operário de segundo plano (aba anônima em
        // alguns casos) simplesmente fica sem a proteção extra. Nada quebra.
      }
    }

    // Depois que a página terminou de carregar: registrar antes disso
    // disputaria banda justamente com o que o aluno está esperando ver.
    if (document.readyState === 'complete') registrar()
    else window.addEventListener('load', registrar, { once: true })

    return () => {
      cancelado = true
    }
  }, [])

  return null
}
