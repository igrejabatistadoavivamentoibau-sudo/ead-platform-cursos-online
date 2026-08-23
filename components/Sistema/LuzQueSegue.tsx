'use client'

import { useEffect } from 'react'

/* ============================================================
   A LUZ QUE SEGUE O CURSOR

   O cartão tem uma borda em degradê. Este arquivo acrescenta uma
   segunda camada nessa borda: um clarão que acompanha o ponteiro, como
   se a peça tivesse relevo e o cursor fosse a fonte de luz.

   POR QUE NA BORDA, E NÃO POR CIMA DO CARTÃO
   A versão óbvia é um halo em cima do conteúdo. Fica bonito na
   demonstração e péssimo na prática: o halo passa por cima do texto e
   tira contraste de tudo que o cartão tem a dizer. Na borda, o efeito
   aparece inteiro e não encosta em uma letra sequer.

   POR QUE ISTO EXISTE EM JAVASCRIPT
   CSS não sabe onde o ponteiro está. É a única informação que ele não
   tem — e é justamente ela. Então o mínimo possível é feito aqui: duas
   variáveis de posição e uma de intensidade. O desenho, a transição e
   o degradê continuam sendo CSS.

   O CUIDADO QUE FAZ ISTO NÃO PESAR
   - UM ouvinte só, no documento inteiro, em vez de um por cartão. Uma
     tela de cursos tem trinta cartões; trinta ouvintes de movimento do
     mouse é o caminho mais curto para travar a rolagem num celular
     antigo.
   - As contas rodam no quadro do navegador (`requestAnimationFrame`).
     Sem isso, um mouse rápido dispara centenas de eventos por segundo,
     e cada um mediria o cartão de novo — que é a operação cara.
   - Só liga em quem tem MOUSE de verdade (`pointer: fine`). Em telefone
     não existe "passar por cima", e o efeito só custaria bateria.
   - E respeita quem pediu ao sistema para não animar nada.
   ============================================================ */

export default function LuzQueSegue() {
  useEffect(() => {
    const temMouse = window.matchMedia('(pointer: fine)')
    const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!temMouse.matches || menosMovimento.matches) return

    let quadro = 0
    let ultimo: PointerEvent | null = null
    let aceso: HTMLElement | null = null

    const apagar = () => {
      aceso?.style.setProperty('--luz', '0')
      aceso = null
    }

    const desenhar = () => {
      quadro = 0
      const e = ultimo
      if (!e) return

      const alvo = e.target as Element | null
      const cartao =
        alvo && typeof alvo.closest === 'function'
          ? (alvo.closest('.card-alive, .superficie') as HTMLElement | null)
          : null

      /* Trocou de cartão: o anterior apaga. Sem isto, todo cartão por
         onde o cursor passou ficaria aceso para sempre. */
      if (cartao !== aceso) apagar()
      if (!cartao) return

      const r = cartao.getBoundingClientRect()
      cartao.style.setProperty('--luz-x', `${((e.clientX - r.left) / r.width) * 100}%`)
      cartao.style.setProperty('--luz-y', `${((e.clientY - r.top) / r.height) * 100}%`)
      cartao.style.setProperty('--luz', '1')
      aceso = cartao
    }

    const aoMover = (e: PointerEvent) => {
      ultimo = e
      if (!quadro) quadro = requestAnimationFrame(desenhar)
    }

    document.addEventListener('pointermove', aoMover, { passive: true })
    document.addEventListener('pointerleave', apagar)
    /* Ao trocar de tela, o cartão aceso some do documento e a variável
       ficaria pendurada num elemento que não existe mais. */
    window.addEventListener('blur', apagar)

    return () => {
      document.removeEventListener('pointermove', aoMover)
      document.removeEventListener('pointerleave', apagar)
      window.removeEventListener('blur', apagar)
      if (quadro) cancelAnimationFrame(quadro)
      apagar()
    }
  }, [])

  return null
}
