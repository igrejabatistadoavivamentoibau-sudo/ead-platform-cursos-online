import { Node, mergeAttributes } from '@tiptap/core'

/* ============================================================
   A MARCA DE MINUTO

   O que o aluno faria no caderno de papel: "isso ele falou lá pelos 12
   minutos". A diferença é que aqui a marca é VIVA — clicar nela manda o
   vídeo voltar àquele ponto, mesmo que o vídeo esteja na outra tela.

   POR QUE É UM ELEMENTO PRÓPRIO, E NÃO SÓ UM TEXTO EM NEGRITO
   Texto é texto: dá para apagar uma letra no meio e ficar "[1:34" sem
   fechar, ou colar num lugar que quebra o sentido. Como elemento próprio e
   indivisível (um "átomo", no jargão do editor), a marca entra e sai
   inteira — nunca pela metade — e continua sabendo a que segundo se
   refere, mesmo depois de o texto ao redor ser todo reescrito.
   ============================================================ */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    minuto: {
      inserirMinuto: (segundos: number, rotulo: string) => ReturnType
    }
  }
}

export const MarcaDeMinuto = Node.create({
  name: 'minuto',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      segundos: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-minuto') ?? 0),
        renderHTML: (attrs) => ({ 'data-minuto': String(attrs.segundos) }),
      },
      rotulo: {
        default: '0:00',
        parseHTML: (el) => el.getAttribute('data-rotulo') ?? '0:00',
        renderHTML: (attrs) => ({ 'data-rotulo': attrs.rotulo }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-minuto]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'minuto-marcado',
        title: 'Clique para o vídeo voltar a este ponto',
      }),
      `▸ ${node.attrs.rotulo}`,
    ]
  },

  addCommands() {
    return {
      inserirMinuto:
        (segundos: number, rotulo: string) =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent([
              { type: this.name, attrs: { segundos, rotulo } },
              { type: 'text', text: ' ' },
            ])
            .run(),
    }
  },
})
