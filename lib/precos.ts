/* ============================================================
   A CONTA DO PAGAMENTO

   Aqui moram as três decisões de dinheiro da loja: quanto fica à vista com
   desconto, em quantas vezes dá para parcelar, e quanto sai cada parcela.

   TUDO EM CENTAVOS, E SEMPRE COMO NÚMERO INTEIRO.
   Trabalhar com "49,90" parece natural e é a origem clássica do erro de um
   centavo: nenhum computador consegue representar 0,1 exatamente. Somando
   parcela por parcela, aquele resto aparece — e o cliente vê "3x de
   R$ 33,33" numa compra de R$ 100,00, que dá 99,99. Com inteiro, o
   problema não existe: o que sobra é distribuído de propósito, por quem
   escreveu a regra, e não pela aritmética do computador.

   POR QUE ISTO É UM ARQUIVO SEPARADO, E SEM NADA DE TELA DENTRO
   Porque é a parte que, errada, cobra o valor errado de alguém. Regra de
   dinheiro precisa poder ser lida inteira numa sentada e conferida caso a
   caso — não descoberta no meio de um componente, entre um botão e um
   ícone.
   ============================================================ */

export type MeioDePagamento = 'pix' | 'boleto' | 'cartao'

export interface Politica {
  parcelas_sem_juros: number
  parcelas_max: number
  juros_ao_mes_pct: number
  desconto_avista_pct: number
  parcela_minima_centavos: number
  aceita_pix: boolean
  aceita_boleto: boolean
  aceita_cartao: boolean
}

export interface OpcaoDePagamento {
  meio: MeioDePagamento
  parcelas: number
  /** Valor de cada parcela. A última pode ter alguns centavos a mais. */
  parcelaCentavos: number
  ultimaParcelaCentavos: number
  descontoCentavos: number
  jurosCentavos: number
  totalCentavos: number
  /** O que a pessoa lê na tela. */
  rotulo: string
  /** Uma linha curta de detalhe, quando há o que explicar. */
  detalhe?: string
}

export const NOME_DO_MEIO: Record<MeioDePagamento, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  cartao: 'Cartão de crédito',
}

/** 4990 → "R$ 49,90". */
export function reais(centavos: number): string {
  const sinal = centavos < 0 ? '-' : ''
  const n = Math.abs(Math.round(centavos))
  const inteiro = Math.floor(n / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sinal}R$ ${inteiro},${(n % 100).toString().padStart(2, '0')}`
}

/**
 * "49,90", "R$ 49,90", "49.90" ou "1.234,56" → centavos.
 *
 * Aceita os dois separadores porque quem digita não pensa em formato: uma
 * pessoa escreve 49,90 e outra 49.90, e recusar qualquer uma das duas é
 * transformar cadastro de preço em adivinhação.
 */
export function centavosDoTexto(texto: string): number | null {
  const limpo = (texto ?? '').replace(/[^\d,.-]/g, '').trim()
  if (!limpo) return null

  // O último separador é o decimal; os outros são de milhar.
  const ultimaVirgula = limpo.lastIndexOf(',')
  const ultimoPonto = limpo.lastIndexOf('.')
  const corte = Math.max(ultimaVirgula, ultimoPonto)

  let inteiros: string
  let decimais: string
  if (corte === -1) {
    inteiros = limpo
    decimais = '00'
  } else {
    inteiros = limpo.slice(0, corte).replace(/[.,]/g, '')
    decimais = limpo.slice(corte + 1).replace(/[.,]/g, '')
  }

  // "49,9" é R$ 49,90 — e não R$ 49,09.
  decimais = (decimais + '00').slice(0, 2)

  const n = Number(`${inteiros || '0'}.${decimais}`)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

/**
 * Reparte um total em N parcelas SEM PERDER NEM INVENTAR CENTAVO.
 *
 * R$ 100,00 em 3 não dá três valores iguais. Em vez de arredondar cada
 * parcela por conta própria — o que faz a soma fechar em 99,99 ou 100,02 —,
 * as parcelas ficam iguais e o resto inteiro vai para a ÚLTIMA. A soma
 * bate com o total, sempre, por construção.
 */
export function repartir(totalCentavos: number, parcelas: number) {
  const n = Math.max(1, Math.floor(parcelas))
  const base = Math.floor(totalCentavos / n)
  const resto = totalCentavos - base * n
  return { parcelaCentavos: base, ultimaParcelaCentavos: base + resto }
}

const arredondar = (x: number) => Math.round(x)

/**
 * Todas as formas de pagar este valor, já calculadas.
 *
 * A tela só desenha o que sai daqui: ela não decide nada sobre dinheiro.
 * Assim, mudar a regra é mudar um lugar só — e a tela do aluno, o resumo
 * do pedido e o valor que vai para o provedor nunca discordam entre si.
 */
export function opcoesDePagamento(
  subtotalCentavos: number,
  politica: Politica
): OpcaoDePagamento[] {
  const subtotal = Math.max(0, Math.round(subtotalCentavos))
  const opcoes: OpcaoDePagamento[] = []

  const descontoAVista = arredondar((subtotal * Number(politica.desconto_avista_pct || 0)) / 100)
  const totalAVista = Math.max(0, subtotal - descontoAVista)

  const aVista = (meio: MeioDePagamento): OpcaoDePagamento => ({
    meio,
    parcelas: 1,
    parcelaCentavos: totalAVista,
    ultimaParcelaCentavos: totalAVista,
    descontoCentavos: descontoAVista,
    jurosCentavos: 0,
    totalCentavos: totalAVista,
    rotulo: `${NOME_DO_MEIO[meio]} — ${reais(totalAVista)}`,
    detalhe:
      descontoAVista > 0
        ? `${Number(politica.desconto_avista_pct)}% de desconto à vista (economia de ${reais(descontoAVista)})`
        : undefined,
  })

  if (politica.aceita_pix) opcoes.push(aVista('pix'))
  if (politica.aceita_boleto) opcoes.push(aVista('boleto'))

  if (!politica.aceita_cartao) return opcoes

  opcoes.push(aVista('cartao'))

  const semJuros = Math.max(1, Math.floor(politica.parcelas_sem_juros || 1))
  const maximo = Math.max(semJuros, Math.floor(politica.parcelas_max || 1))
  const juros = Number(politica.juros_ao_mes_pct || 0)
  const minima = Math.max(0, Math.floor(politica.parcela_minima_centavos || 0))

  for (let n = 2; n <= maximo; n++) {
    /* Sem juros usa o valor CHEIO, não o de desconto à vista: o desconto é
       justamente o prêmio de quem paga de uma vez. Oferecer os dois seria
       dar o desconto e ainda parcelar. */
    const comJuros = n > semJuros
    if (comJuros && juros <= 0) break // a escola não quis parcelar além do sem juros

    const total = comJuros ? arredondar(subtotal * Math.pow(1 + juros / 100, n)) : subtotal

    const { parcelaCentavos, ultimaParcelaCentavos } = repartir(total, n)

    // Ninguém parcela um livro de R$ 40 em 12x de R$ 3,33.
    if (parcelaCentavos < minima) break

    opcoes.push({
      meio: 'cartao',
      parcelas: n,
      parcelaCentavos,
      ultimaParcelaCentavos,
      descontoCentavos: 0,
      jurosCentavos: total - subtotal,
      totalCentavos: total,
      rotulo: `Cartão — ${n}x de ${reais(parcelaCentavos)}${comJuros ? '' : ' sem juros'}`,
      detalhe: comJuros
        ? `Total de ${reais(total)} — com juros de ${juros}% ao mês`
        : ultimaParcelaCentavos !== parcelaCentavos
          ? `Última parcela de ${reais(ultimaParcelaCentavos)}. Total de ${reais(total)}`
          : `Total de ${reais(total)}`,
    })
  }

  return opcoes
}

/**
 * Reencontra a opção escolhida, a partir do que o navegador mandou.
 *
 * O navegador manda "cartão em 3x", nunca o VALOR — o valor é recalculado
 * aqui, do zero, a partir do preço que está no banco. Sem isso, bastaria
 * o console do navegador para transformar um pedido de mil reais num
 * pedido de um real.
 */
export function escolherOpcao(
  subtotalCentavos: number,
  politica: Politica,
  meio: MeioDePagamento,
  parcelas: number
): OpcaoDePagamento | null {
  return (
    opcoesDePagamento(subtotalCentavos, politica).find(
      (o) => o.meio === meio && o.parcelas === parcelas
    ) ?? null
  )
}
