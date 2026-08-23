import { reais } from '@/lib/precos'

/* ============================================================
   COMO UM PEDIDO SE APRESENTA

   O mesmo pedido é lido por duas pessoas com perguntas diferentes: o aluno
   quer saber "e agora, o que eu faço?"; a secretaria quer saber "posso
   entregar?". Um `status` cru — "aguardando_pagamento" — não responde
   nenhuma das duas.

   Então a tradução mora aqui, num lugar só. Se ficasse escrita nas telas,
   as duas diriam coisas ligeiramente diferentes sobre o mesmo pedido, e é
   assim que a secretaria e o aluno passam a discordar sobre o que está
   acontecendo.
   ============================================================ */

export type StatusDoPedido = 'aguardando_pagamento' | 'pago' | 'cancelado' | 'estornado'

export interface ApresentacaoDoStatus {
  rotulo: string
  /** Cor do selo, no vocabulário do projeto. */
  tom: 'ambar' | 'verde' | 'neutro' | 'vermelho'
  /** O que a pessoa que comprou precisa entender. */
  paraOAluno: string
  /** O que quem entrega precisa saber. */
  paraASecretaria: string
}

export const APRESENTACAO: Record<StatusDoPedido, ApresentacaoDoStatus> = {
  aguardando_pagamento: {
    rotulo: 'Aguardando pagamento',
    tom: 'ambar',
    paraOAluno:
      'Assim que o pagamento for confirmado, a secretaria separa seu material para retirada.',
    paraASecretaria: 'Ainda não pago. Não entregue antes de confirmar o recebimento.',
  },
  pago: {
    rotulo: 'Pago',
    tom: 'verde',
    paraOAluno: 'Pagamento confirmado. Retire na secretaria da igreja.',
    paraASecretaria: 'Pode entregar.',
  },
  cancelado: {
    rotulo: 'Cancelado',
    tom: 'neutro',
    paraOAluno: 'Este pedido foi cancelado. Se foi engano, fale com a secretaria.',
    paraASecretaria: 'Cancelado. Não entregue.',
  },
  estornado: {
    rotulo: 'Estornado',
    tom: 'vermelho',
    paraOAluno: 'O valor foi devolvido.',
    paraASecretaria: 'Valor devolvido ao comprador. Não entregue.',
  },
}

export function apresentar(status: string): ApresentacaoDoStatus {
  return APRESENTACAO[status as StatusDoPedido] ?? APRESENTACAO.aguardando_pagamento
}

/** "3x de R$ 33,33 no cartão" — a forma de pagamento em uma linha. */
export function comoFoiPago(meio: string, parcelas: number, totalCentavos: number): string {
  const nome = meio === 'pix' ? 'Pix' : meio === 'boleto' ? 'boleto' : 'cartão'
  if (parcelas <= 1) return `${reais(totalCentavos)} à vista no ${nome}`
  const base = Math.floor(totalCentavos / parcelas)
  return `${parcelas}x de ${reais(base)} no ${nome} — total de ${reais(totalCentavos)}`
}

/** "12/03/2026 às 14:30" */
export function quando(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/** Um número curto que a pessoa consegue ditar por telefone. */
export function numeroDoPedido(id: string): string {
  return id.slice(0, 8).toUpperCase()
}
