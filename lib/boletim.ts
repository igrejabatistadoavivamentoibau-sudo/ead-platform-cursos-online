/* ============================================================
   O BOLETIM — a média, num lugar só

   POR QUE ISTO EXISTE COMO ARQUIVO
   A média do aluno vai aparecer em três lugares: na tela de notas dele, no
   boletim impresso, e na hora de concluir a turma (onde ela decide quem
   passa e quem repete). Se cada um calcular do seu jeito, um dia a tela
   mostra 7,1 e a conclusão reprova por 6,9 — e não vai existir resposta
   boa para dar ao aluno. A conta mora aqui, e os três perguntam.

   COMO A MÉDIA É FEITA
   Tudo é trazido para a escala de 0 a 10 antes de qualquer soma. Uma prova
   que vale 20 e uma atividade que vale 5 não podem ser somadas cruas — o
   peso da prova viraria quatro vezes maior sem ninguém decidir isso.

   Depois de normalizado, cada item entra com o próprio peso: a avaliação
   usa o peso que o professor definiu; a atividade entra com peso 1. É a
   regra mais simples que dá para explicar para um aluno em voz alta, que
   é o teste que importa num boletim.

   O QUE CONTA E O QUE NÃO CONTA — a decisão que muda nota
   - avaliação sem nota lançada: NÃO conta. O professor ainda não corrigiu;
     castigar o aluno pela demora do professor seria errado.
   - atividade entregue e ainda não corrigida: NÃO conta, mesma razão.
   - atividade NÃO entregue com prazo já vencido: conta como ZERO. Aqui a
     omissão é do aluno, e ignorar seria premiar quem não entregou — a
     média de quem fez metade das tarefas ficaria igual à de quem fez tudo.
   - atividade não entregue com prazo em aberto: NÃO conta. Ainda dá tempo.

   Cada item volta com o motivo escrito, para o boletim poder mostrar a
   conta em vez de só o resultado.
   ============================================================ */

export const NOTA_DE_APROVACAO = 7

export type SituacaoDoItem =
  | 'com_nota'
  | 'sem_nota'
  | 'aguardando_correcao'
  | 'nao_entregue'
  | 'prazo_aberto'

export interface ItemDoBoletim {
  id: string
  titulo: string
  origem: 'avaliacao' | 'atividade'
  tipo: string
  peso: number
  notaMaxima: number
  /** O que o professor lançou, na escala original do item. */
  valor: number | null
  /** O mesmo valor levado para 0–10, que é o que entra na conta. */
  valorEmDez: number | null
  situacao: SituacaoDoItem
  conta: boolean
  observacao?: string | null
}

export interface BoletimDoAluno {
  alunoId: string
  alunoNome: string
  itens: ItemDoBoletim[]
  /** Média final de 0 a 10, ou null quando ainda não há nada para contar. */
  media: number | null
  /** Quantos itens entraram na conta. */
  itensContados: number
  aprovado: boolean | null
  frequencia: number | null
  presencas: number
  encontros: number
}

/** Arredonda para uma casa, do jeito que se lê num boletim. */
export function umaCasa(n: number): number {
  return Math.round(n * 10) / 10
}

export function situacaoPorExtenso(s: SituacaoDoItem): string {
  switch (s) {
    case 'com_nota':
      return 'Nota lançada'
    case 'sem_nota':
      return 'Sem nota lançada — não entra na média'
    case 'aguardando_correcao':
      return 'Entregue, aguardando correção — não entra na média'
    case 'nao_entregue':
      return 'Não entregue no prazo — conta como zero'
    case 'prazo_aberto':
      return 'Prazo em aberto — ainda não entra na média'
  }
}

export interface EntradaAvaliacao {
  id: string
  titulo: string
  tipo: string
  peso: number
  nota_maxima: number
  valor: number | null
  observacao?: string | null
}

export interface EntradaAtividade {
  id: string
  titulo: string
  nota_maxima: number
  vence_em: string | null
  /** null quando o aluno não entregou. */
  entregue: boolean
  nota: number | null
  feedback?: string | null
}

/**
 * Monta o boletim de um aluno a partir do que veio do banco.
 *
 * Função pura de propósito: sem Supabase, sem React, sem relógio próprio.
 * Assim ela pode ser testada sozinha, com casos escritos à mão — que é o
 * que se quer de uma conta que decide aprovação.
 */
export function montarBoletim(entrada: {
  alunoId: string
  alunoNome: string
  avaliacoes: EntradaAvaliacao[]
  atividades: EntradaAtividade[]
  presencas?: number
  encontros?: number
  agora?: number
}): BoletimDoAluno {
  const agora = entrada.agora ?? Date.now()
  const itens: ItemDoBoletim[] = []

  for (const av of entrada.avaliacoes) {
    const maxima = Number(av.nota_maxima) || 10
    const temNota = av.valor !== null && av.valor !== undefined
    itens.push({
      id: av.id,
      titulo: av.titulo,
      origem: 'avaliacao',
      tipo: av.tipo,
      peso: Number(av.peso) || 1,
      notaMaxima: maxima,
      valor: temNota ? Number(av.valor) : null,
      valorEmDez: temNota ? (Number(av.valor) / maxima) * 10 : null,
      situacao: temNota ? 'com_nota' : 'sem_nota',
      conta: temNota,
      observacao: av.observacao ?? null,
    })
  }

  for (const at of entrada.atividades) {
    const maxima = Number(at.nota_maxima) || 10
    const temNota = at.nota !== null && at.nota !== undefined
    const venceu = !!at.vence_em && agora > new Date(at.vence_em).getTime()

    let situacao: SituacaoDoItem
    let valorEmDez: number | null
    let conta: boolean

    if (temNota) {
      situacao = 'com_nota'
      valorEmDez = (Number(at.nota) / maxima) * 10
      conta = true
    } else if (at.entregue) {
      situacao = 'aguardando_correcao'
      valorEmDez = null
      conta = false
    } else if (venceu) {
      // A única situação em que a ausência de nota vira zero de verdade.
      situacao = 'nao_entregue'
      valorEmDez = 0
      conta = true
    } else {
      situacao = 'prazo_aberto'
      valorEmDez = null
      conta = false
    }

    itens.push({
      id: at.id,
      titulo: at.titulo,
      origem: 'atividade',
      tipo: 'atividade',
      peso: 1,
      notaMaxima: maxima,
      valor: temNota ? Number(at.nota) : null,
      valorEmDez,
      situacao,
      conta,
      observacao: at.feedback ?? null,
    })
  }

  let soma = 0
  let pesos = 0
  for (const i of itens) {
    if (!i.conta || i.valorEmDez === null) continue
    soma += i.valorEmDez * i.peso
    pesos += i.peso
  }

  const media = pesos > 0 ? umaCasa(soma / pesos) : null
  const encontros = entrada.encontros ?? 0
  const presencas = entrada.presencas ?? 0

  return {
    alunoId: entrada.alunoId,
    alunoNome: entrada.alunoNome,
    itens,
    media,
    itensContados: itens.filter((i) => i.conta).length,
    aprovado: media === null ? null : media >= NOTA_DE_APROVACAO,
    frequencia: encontros > 0 ? Math.round((presencas / encontros) * 100) : null,
    presencas,
    encontros,
  }
}
