import type {
  AdaptadorPagamento,
  CobrancaCriada,
  EventoDeCobranca,
  PedidoDeCobranca,
  StatusCobranca,
  FormaPagamento,
} from './tipos'

/**
 * Adaptador do Asaas.
 *
 * A chave fica só no servidor, em SUPABASE-style variável de ambiente
 * (ASAAS_API_KEY). Nunca chega ao navegador.
 *
 * O ambiente de testes (sandbox) tem endereço próprio: assim dá para
 * validar o fluxo inteiro com dinheiro de mentira antes de ligar de verdade.
 */
const ENDERECO = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
}

/** Situações do Asaas traduzidas para o vocabulário da plataforma. */
const STATUS: Record<string, StatusCobranca> = {
  PENDING: 'pendente',
  AWAITING_PAYMENT: 'pendente',
  RECEIVED: 'pago',
  CONFIRMED: 'pago',
  RECEIVED_IN_CASH: 'pago',
  OVERDUE: 'vencida',
  DELETED: 'cancelada',
  REFUNDED: 'estornada',
  REFUND_REQUESTED: 'estornada',
}

const FORMAS: Record<string, FormaPagamento> = {
  PIX: 'pix',
  BOLETO: 'boleto',
  CREDIT_CARD: 'cartao',
  DEBIT_CARD: 'cartao',
  TRANSFER: 'transferencia',
}

export function criarAdaptadorAsaas(
  chave: string,
  ambiente: 'sandbox' | 'producao' = 'sandbox'
): AdaptadorPagamento {
  const base = ENDERECO[ambiente]

  const chamar = async (caminho: string, init?: RequestInit) => {
    const r = await fetch(`${base}${caminho}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        access_token: chave,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    })
    const corpo = await r.json().catch(() => null)
    if (!r.ok) {
      const msg =
        (corpo as { errors?: { description?: string }[] })?.errors?.[0]?.description ??
        `Asaas respondeu ${r.status}`
      throw new Error(msg)
    }
    return corpo
  }

  /** O Asaas exige o cliente cadastrado antes da cobrança. */
  const garantirCliente = async (p: PedidoDeCobranca['pagador']) => {
    const achado = await chamar(`/customers?email=${encodeURIComponent(p.email)}`)
    const existente = (achado as { data?: { id: string }[] })?.data?.[0]
    if (existente) return existente.id

    const novo = await chamar('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: p.nome,
        email: p.email,
        mobilePhone: p.telefone?.replace(/\D/g, '') || undefined,
        cpfCnpj: p.documento?.replace(/\D/g, '') || undefined,
      }),
    })
    return (novo as { id: string }).id
  }

  return {
    nome: 'asaas',
    rotulo: 'Asaas',

    async criarCobranca(pedido: PedidoDeCobranca): Promise<CobrancaCriada> {
      const clienteId = await garantirCliente(pedido.pagador)
      const criada = await chamar('/payments', {
        method: 'POST',
        body: JSON.stringify({
          customer: clienteId,
          // UNDEFINED deixa o aluno escolher entre Pix, boleto e cartão.
          billingType: 'UNDEFINED',
          value: pedido.valor,
          dueDate: pedido.vencimento ?? undefined,
          description: pedido.descricao,
          externalReference: pedido.referenciaInterna,
        }),
      })
      const c = criada as { id: string; invoiceUrl?: string; status?: string }
      return {
        provedorId: c.id,
        linkPagamento: c.invoiceUrl ?? null,
        status: STATUS[c.status ?? ''] ?? 'pendente',
      }
    },

    async consultarCobranca(provedorId: string): Promise<EventoDeCobranca> {
      const c = (await chamar(`/payments/${provedorId}`)) as {
        id: string
        status?: string
        billingType?: string
        paymentDate?: string
      }
      return {
        provedorId: c.id,
        status: STATUS[c.status ?? ''] ?? 'pendente',
        forma: FORMAS[c.billingType ?? ''] ?? null,
        pagoEm: c.paymentDate ?? null,
      }
    },

    async cancelarCobranca(provedorId: string): Promise<void> {
      await chamar(`/payments/${provedorId}`, { method: 'DELETE' })
    },

    interpretarAviso(corpo: unknown): EventoDeCobranca | null {
      const evento = corpo as { payment?: { id: string; status?: string; billingType?: string; paymentDate?: string } }
      const p = evento?.payment
      if (!p?.id) return null
      const status = STATUS[p.status ?? '']
      if (!status) return null
      return {
        provedorId: p.id,
        status,
        forma: FORMAS[p.billingType ?? ''] ?? null,
        pagoEm: p.paymentDate ?? null,
      }
    },
  }
}
