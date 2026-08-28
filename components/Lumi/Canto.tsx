import type { ReactNode } from 'react'

/**
 * O CANTO DA LUMI.
 *
 * Ela fala de mais de um assunto — "saiu versão nova", "sua nota foi
 * lançada" — e os dois moram no mesmo canto inferior direito. Cada um
 * posicionado por conta própria, os dois se plantavam no MESMO ponto e um
 * cobria o outro: a pessoa via um recado pela metade por baixo do outro,
 * ou clicava num botão achando que era do de cima.
 *
 * Aqui eles viram uma pilha. `flex-col-reverse` faz o mais recente entrar
 * por baixo, junto do canto, e empurrar o anterior para cima — que é como
 * a pessoa espera que se comportem: o que chegou por último está mais
 * perto da mão.
 *
 * `pointer-events-none` na coluna e `pointer-events-auto` em cada recado:
 * sem isso, a coluna inteira (que é alta e invisível) roubaria o clique de
 * tudo que estivesse embaixo dela na tela.
 */
export default function CantoDaLumi({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col-reverse items-end gap-2 [&>*]:pointer-events-auto">
      {children}
    </div>
  )
}
