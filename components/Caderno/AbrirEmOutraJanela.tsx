'use client'

import { useState } from 'react'
import { Columns2, Check } from 'lucide-react'

/**
 * Abre o caderno numa janela à parte.
 *
 * O PEDIDO ERA "DUAS TELAS"
 * Quem tem dois monitores quer o vídeo num e o caderno no outro. Uma aba
 * comum não serve: o navegador só mostra uma aba por vez, e trocar de aba a
 * cada anotação é justamente o que se quer evitar.
 *
 * `window.open` com tamanho definido abre uma JANELA de verdade — que a
 * pessoa arrasta para o segundo monitor e deixa lá. A janela vai sem barra
 * lateral e sem barra de cima (ver o layout da rota /janela), então quase
 * tudo o que aparece nela é folha para escrever.
 *
 * As duas janelas continuam conversando: o minuto do vídeo chega no caderno
 * e o clique num minuto anotado leva o vídeo até lá (ver lib/duasTelas).
 */
export default function AbrirEmOutraJanela({ paginaId }: { paginaId: string }) {
  const [abriu, setAbriu] = useState(false)

  const abrir = () => {
    const largura = Math.min(760, Math.round(window.screen.availWidth * 0.45))
    const altura = Math.round(window.screen.availHeight * 0.92)
    // Encostada à direita: é onde ela não cobre o vídeo em quem tem uma
    // tela só, e é para onde a pessoa arrasta em quem tem duas.
    const esquerda = Math.max(0, window.screen.availWidth - largura - 24)

    const janela = window.open(
      `/dashboard/caderno/janela/${paginaId}`,
      `caderno-${paginaId}`,
      `popup=yes,width=${largura},height=${altura},left=${esquerda},top=24,resizable=yes,scrollbars=yes`
    )

    if (janela) {
      janela.focus()
      setAbriu(true)
      setTimeout(() => setAbriu(false), 2600)
    }
  }

  return (
    <button
      type="button"
      onClick={abrir}
      title="Abrir o caderno numa janela separada, para escrever com o vídeo na outra tela"
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-950/[0.08] bg-white px-3 text-[12px] font-semibold text-gray-600 transition-colors hover:border-brand-500/40 hover:text-brand-800"
    >
      {abriu ? (
        <>
          <Check className="h-3.5 w-3.5 text-brand-600" strokeWidth={2.4} />
          Aberto na outra janela
        </>
      ) : (
        <>
          <Columns2 className="h-3.5 w-3.5" strokeWidth={2} />
          Abrir em outra janela
        </>
      )}
    </button>
  )
}
