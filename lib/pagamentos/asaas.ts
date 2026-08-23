/* ============================================================
   O PROVEDOR DE PAGAMENTO — A COSTURA, PRONTA E AINDA DESLIGADA

   A escola vai cobrar pelo Asaas. A chave da conta ainda não existe, e por
   isso NADA aqui conversa com eles hoje. O que este arquivo faz é deixar a
   costura pronta: o resto da plataforma já fala com o provedor por estas
   funções, e ligar de verdade é preencher uma variável de ambiente.

   POR QUE ISSO É MELHOR DO QUE "FAZER DEPOIS"
   Porque a parte cara nunca é chamar o provedor: são as decisões em volta.
   Onde o valor é calculado (uma vez só, no servidor), o que acontece
   quando o pagamento cai, o que acontece quando o mesmo aviso chega duas
   vezes, quem tem direito de ver o pedido. Tudo isso já está resolvido e
   conferido. Quando a chave chegar, o que muda é uma requisição HTTP.

   O QUE FALTA, EM UMA LINHA
   As variáveis de ambiente na Vercel:
     ASAAS_API_KEY        a chave da conta (produção ou sandbox)
     ASAAS_AMBIENTE       'sandbox' (padrão) ou 'producao'
     ASAAS_WEBHOOK_TOKEN  a senha que o Asaas manda no aviso de pagamento

   NADA DISSO ENTRA NO CÓDIGO. Chave em arquivo vai parar no GitHub, e
   chave no GitHub é chave vazada — mesmo em repositório privado, mesmo
   apagada depois, porque o histórico guarda.
   ============================================================ */

export interface CobrancaSolicitada {
  pedidoId: string
  totalCentavos: number
  parcelas: number
  meio: 'pix' | 'boleto' | 'cartao'
  descricao: string
  comprador: { id: string; nome: string; email: string }
}

export interface CobrancaCriada {
  cobrancaId: string
  url: string
}

export type ResultadoDoProvedor =
  | { ok: true; cobranca: CobrancaCriada }
  | { ok: false; erro: string; faltaConfigurar?: boolean }

const BASES = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
} as const

export function configuracao() {
  const chave = process.env.ASAAS_API_KEY ?? ''
  const ambiente = process.env.ASAAS_AMBIENTE === 'producao' ? 'producao' : 'sandbox'
  return { chave, ambiente, base: BASES[ambiente], configurado: chave.length > 0 }
}

/** A loja está pronta para cobrar? A tela usa isto para não prometer o que não pode cumprir. */
export function pagamentoLigado(): boolean {
  return configuracao().configurado
}

const MEIO_NO_ASAAS: Record<CobrancaSolicitada['meio'], string> = {
  pix: 'PIX',
  boleto: 'BOLETO',
  cartao: 'CREDIT_CARD',
}

/**
 * Cria a cobrança no provedor.
 *
 * Enquanto a chave não existir, devolve `faltaConfigurar` — e a plataforma
 * segue funcionando: o pedido é registrado como "aguardando pagamento" e a
 * secretaria combina o acerto por fora. É de propósito. A alternativa
 * seria a loja inteira ficar inacessível até a chave chegar, e aí o
 * trabalho de cadastrar produto e preço não poderia nem começar.
 */
export async function criarCobranca(
  pedido: CobrancaSolicitada
): Promise<ResultadoDoProvedor> {
  const cfg = configuracao()
  if (!cfg.configurado) {
    return {
      ok: false,
      faltaConfigurar: true,
      erro: 'O pagamento on-line ainda não está ligado (falta a chave do Asaas).',
    }
  }

  try {
    /* O cliente no Asaas é criado/reaproveitado pelo `externalReference`,
       que é o id da pessoa aqui dentro. Assim a mesma pessoa não vira
       cinco cadastros lá por ter comprado cinco vezes. */
    const cliente = await chamar(cfg, 'POST', '/customers', {
      name: pedido.comprador.nome,
      email: pedido.comprador.email,
      externalReference: pedido.comprador.id,
    })
    if (!cliente.ok) return cliente

    const corpo: Record<string, unknown> = {
      customer: (cliente.dados as { id: string }).id,
      billingType: MEIO_NO_ASAAS[pedido.meio],
      /* O provedor fala em reais com decimal; aqui dentro tudo é centavo
         inteiro. A conversão acontece NESTA linha e em nenhum outro lugar. */
      value: pedido.totalCentavos / 100,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      description: pedido.descricao,
      externalReference: pedido.pedidoId,
      ...(pedido.parcelas > 1
        ? { installmentCount: pedido.parcelas, totalValue: pedido.totalCentavos / 100 }
        : {}),
    }

    const cobranca = await chamar(cfg, 'POST', '/payments', corpo)
    if (!cobranca.ok) return cobranca

    const d = cobranca.dados as { id: string; invoiceUrl?: string; bankSlipUrl?: string }
    return { ok: true, cobranca: { cobrancaId: d.id, url: d.invoiceUrl ?? d.bankSlipUrl ?? '' } }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao falar com o provedor.' }
  }
}

type Resposta = { ok: true; dados: unknown } | { ok: false; erro: string }

async function chamar(
  cfg: ReturnType<typeof configuracao>,
  metodo: string,
  caminho: string,
  corpo?: unknown
): Promise<Resposta> {
  const r = await fetch(`${cfg.base}${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', access_token: cfg.chave },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: 'no-store',
  })

  const dados = await r.json().catch(() => null)
  if (!r.ok) {
    const detalhe =
      (dados as { errors?: { description?: string }[] } | null)?.errors?.[0]?.description ??
      `código ${r.status}`
    return { ok: false, erro: `Asaas recusou: ${detalhe}` }
  }
  return { ok: true, dados }
}

/**
 * Traduz o estado que o provedor usa para o que a plataforma entende.
 *
 * A lista é fechada de propósito: um estado novo, que ninguém previu, NÃO
 * vira "pago" por acidente. Ele simplesmente não muda nada, fica
 * registrado no histórico, e alguém olha.
 */
export function statusDoAviso(evento: string): 'pago' | 'cancelado' | 'estornado' | null {
  const e = (evento ?? '').toUpperCase()
  if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(e)) return 'pago'
  if (['PAYMENT_DELETED', 'PAYMENT_OVERDUE_CANCELED'].includes(e)) return 'cancelado'
  if (['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED'].includes(e)) return 'estornado'
  return null
}
