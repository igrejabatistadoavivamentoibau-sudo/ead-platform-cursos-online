/* ============================================================
   A CÓPIA NO APARELHO

   POR QUE ISTO EXISTE
   O caderno é usado durante a aula, muitas vezes no celular, no salão da
   igreja, com a internet que houver. Se a conexão cair no meio de uma
   anotação, o que a pessoa escreveu não pode simplesmente sumir.

   Então tudo o que se escreve é copiado NO PRÓPRIO APARELHO antes de
   qualquer coisa. A cópia só é apagada depois que o servidor confirma que
   guardou. Se a pessoa fechar a página com a internet caída e voltar
   depois, o caderno reconhece que a cópia local é mais nova e devolve o
   texto para ela — em vez de abrir a folha do jeito que o servidor tinha,
   que é mais velho.

   Isso não substitui o salvamento: é o cinto além do airbag.
   ============================================================ */

const PREFIXO = 'ibau:caderno:'

interface Rascunho {
  em: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any
}

function chave(paginaId: string) {
  return PREFIXO + paginaId
}

export const rascunhoLocal = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  guardar(paginaId: string, doc: any) {
    try {
      localStorage.setItem(chave(paginaId), JSON.stringify({ em: Date.now(), doc } as Rascunho))
    } catch {
      // Aparelho sem espaço ou navegação anônima: seguimos sem a cópia.
    }
  },

  ler(paginaId: string): Rascunho | null {
    try {
      const cru = localStorage.getItem(chave(paginaId))
      if (!cru) return null
      const r = JSON.parse(cru) as Rascunho
      return r?.doc ? r : null
    } catch {
      return null
    }
  },

  limpar(paginaId: string) {
    try {
      localStorage.removeItem(chave(paginaId))
    } catch {
      /* nada a fazer */
    }
  },
}

/** Quanto texto tem um documento do editor — para comparar duas versões. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tamanhoDoTexto(doc: any): number {
  let n = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const andar = (no: any) => {
    if (!no) return
    if (typeof no.text === 'string') n += no.text.length
    if (Array.isArray(no.content)) no.content.forEach(andar)
  }
  andar(doc)
  return n
}
