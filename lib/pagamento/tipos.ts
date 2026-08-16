/**
 * Contrato único de pagamento.
 *
 * A plataforma inteira conversa com ESTA interface, nunca com o Asaas
 * diretamente. Trocar de empresa vira escrever um novo adaptador que
 * implemente estas funções — nenhuma tela, nenhuma regra de negócio e
 * nenhuma cobrança antiga precisa mudar.
 *
 * A instituição usa Asaas hoje, mas deixou claro que isso pode mudar.
 * É esse aviso que justifica a camada: sem ela, o nome da empresa se
 * espalharia por dezenas de arquivos.
 */

export type ProvedorPagamento = 'manual' | 'asaas' | 'mercadopago' | 'stripe'
export type FormaPagamento = 'pix' | 'boleto' | 'cartao' | 'dinheiro' | 'transferencia' | 'outro'
export type StatusCobranca = 'pendente' | 'pago' | 'vencida' | 'cancelada' | 'estornada' | 'isenta'

export interface DadosPagador {
  nome: string
  email: string
  telefone?: string | null
  /** CPF/CNPJ. Obrigatório no Asaas; outros provedores podem ignorar. */
  documento?: string | null
}

export interface PedidoDeCobranca {
  descricao: string
  valor: number
  vencimento?: string | null
  pagador: DadosPagador
  /** Nosso id, enviado ao provedor para reconciliar depois. */
  referenciaInterna: string
}

export interface CobrancaCriada {
  provedorId: string
  linkPagamento: string | null
  status: StatusCobranca
}

export interface EventoDeCobranca {
  provedorId: string
  status: StatusCobranca
  forma?: FormaPagamento | null
  pagoEm?: string | null
}

/** O que todo adaptador de pagamento precisa saber fazer. */
export interface AdaptadorPagamento {
  readonly nome: ProvedorPagamento
  readonly rotulo: string
  criarCobranca(pedido: PedidoDeCobranca): Promise<CobrancaCriada>
  consultarCobranca(provedorId: string): Promise<EventoDeCobranca>
  cancelarCobranca(provedorId: string): Promise<void>
  /** Traduz o aviso automático do provedor. Nulo quando não interessa. */
  interpretarAviso(corpo: unknown): EventoDeCobranca | null
}

export const ROTULO_PROVEDOR: Record<ProvedorPagamento, string> = {
  manual: 'Controle manual (Pix na chave da igreja)',
  asaas: 'Asaas',
  mercadopago: 'Mercado Pago',
  stripe: 'Stripe',
}
