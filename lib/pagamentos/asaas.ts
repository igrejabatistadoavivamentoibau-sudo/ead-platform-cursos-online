import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

/* ============================================================
   O PROVEDOR DE PAGAMENTO

   A escola cobra pelo Asaas. Até a versão anterior, ligar isso exigia três
   variáveis de ambiente num painel de fora — o que, na prática, queria
   dizer: a chave da conta bancária da igreja precisava ser mandada por
   mensagem para outra pessoa configurar.

   Chave que anda por conversa fica na conversa. Fica no histórico do
   aplicativo, no backup do aparelho, e em qualquer lugar por onde a
   conversa tenha passado. Agora a coordenação cola a chave na própria tela
   de Loja e pagamentos e a plataforma guarda.

   ONDE ELA FICA
   No cofre do Supabase (`supabase_vault`), cifrada com uma raiz que não
   mora no banco — um dump, sozinho, não devolve a chave. A tabela que
   aponta para o cofre tem RLS ligada e NENHUMA policy, e as funções que
   abrem o cofre só podem ser chamadas pelo servidor. Ver a migração 026:
   o teste de impersonação encontrou ali um buraco que a leitura do código
   não mostrava.

   A VARIÁVEL DE AMBIENTE CONTINUA VALENDO como segunda opção. Se um dia
   alguém preferir configurar por fora, funciona — mas o caminho normal
   agora é a tela.
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

export type Ambiente = 'sandbox' | 'producao'

const BASES: Record<Ambiente, string> = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
}

export const baseDoAmbiente = (a: Ambiente) => BASES[a]

/** O que a tela mostra depois de ligado. Nunca inclui a chave. */
export interface EstadoDoPagamento {
  ligado: boolean
  ambiente: Ambiente
  contaNome: string | null
  contaEmail: string | null
  chaveFinal: string | null
  webhookRegistrado: boolean
  ligadoEm: string | null
  ligadoPor: string | null
  /** true quando veio de variável de ambiente, e não da tela. */
  porVariavelDeAmbiente: boolean
}

interface Credenciais {
  chave: string
  ambiente: Ambiente
  base: string
  webhookToken: string
  configurado: boolean
}

const semChave = (): Credenciais => ({
  chave: '',
  ambiente: 'sandbox',
  base: BASES.sandbox,
  webhookToken: '',
  configurado: false,
})

/**
 * As credenciais de verdade. SÓ PARA CÓDIGO DE SERVIDOR.
 *
 * A ordem importa: a tela vem primeiro. Se a coordenação trocou a chave
 * aqui dentro, é essa que vale — mesmo que exista uma variável de ambiente
 * antiga esquecida em algum lugar. Do contrário, trocar a chave na tela
 * não teria efeito nenhum e ninguém entenderia por quê.
 *
 * Embrulhada em `cache()` do React: numa mesma requisição, a tela do aluno
 * pergunta se o pagamento está ligado e o checkout pergunta a chave. Sem
 * isso seriam duas idas ao banco para ler a mesma linha.
 */
export const credenciais = cache(async (): Promise<Credenciais> => {
  try {
    const admin = createAdminClient()
    const { data } = await admin.rpc('pagamento_asaas_credenciais')
    const linha = Array.isArray(data) ? data[0] : data
    const chave = (linha?.chave as string) ?? ''
    if (chave) {
      const ambiente: Ambiente = linha.ambiente === 'producao' ? 'producao' : 'sandbox'
      return {
        chave,
        ambiente,
        base: BASES[ambiente],
        webhookToken: (linha.webhook_token as string) ?? '',
        configurado: true,
      }
    }
  } catch {
    /* Banco fora do ar ou migração ainda não aplicada: cai na variável de
       ambiente em vez de derrubar a loja inteira. */
  }

  const doAmbiente = process.env.ASAAS_API_KEY ?? ''
  if (!doAmbiente) return semChave()
  const ambiente: Ambiente = process.env.ASAAS_AMBIENTE === 'producao' ? 'producao' : 'sandbox'
  return {
    chave: doAmbiente,
    ambiente,
    base: BASES[ambiente],
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN ?? '',
    configurado: true,
  }
})

/** A loja está pronta para cobrar? A tela usa isto para não prometer o que não pode cumprir. */
export async function pagamentoLigado(): Promise<boolean> {
  return (await credenciais()).configurado
}

/** O estado para a tela de configuração — sem nenhum segredo dentro. */
export async function estadoDoPagamento(): Promise<EstadoDoPagamento> {
  const vazio: EstadoDoPagamento = {
    ligado: false,
    ambiente: 'sandbox',
    contaNome: null,
    contaEmail: null,
    chaveFinal: null,
    webhookRegistrado: false,
    ligadoEm: null,
    ligadoPor: null,
    porVariavelDeAmbiente: false,
  }

  try {
    const admin = createAdminClient()
    const { data } = await admin.rpc('pagamento_asaas_estado')
    const l = Array.isArray(data) ? data[0] : data
    if (l?.ligado) {
      return {
        ligado: true,
        ambiente: l.ambiente === 'producao' ? 'producao' : 'sandbox',
        contaNome: (l.conta_nome as string) ?? null,
        contaEmail: (l.conta_email as string) ?? null,
        chaveFinal: (l.chave_final as string) ?? null,
        webhookRegistrado: Boolean(l.webhook_id),
        ligadoEm: (l.ligado_em as string) ?? null,
        ligadoPor: (l.ligado_por_nome as string) ?? null,
        porVariavelDeAmbiente: false,
      }
    }
  } catch {
    /* sem tabela ainda */
  }

  if (process.env.ASAAS_API_KEY) {
    return {
      ...vazio,
      ligado: true,
      ambiente: process.env.ASAAS_AMBIENTE === 'producao' ? 'producao' : 'sandbox',
      chaveFinal: process.env.ASAAS_API_KEY.slice(-6),
      webhookRegistrado: Boolean(process.env.ASAAS_WEBHOOK_TOKEN),
      porVariavelDeAmbiente: true,
    }
  }

  return vazio
}

/** A senha que o aviso de pagamento tem de trazer. */
export async function tokenDoAviso(): Promise<string> {
  return (await credenciais()).webhookToken
}

/* ============================================================
   CONFERIR A CHAVE ANTES DE GUARDAR

   Guardar sem conferir faria a tela dizer "ligado" com uma chave errada — e
   o erro só apareceria na primeira compra de um aluno, que é o pior lugar
   possível para descobrir.

   `/myAccount` é a chamada mais barata que o Asaas oferece e devolve
   justamente o que a tela precisa mostrar depois: de qual conta é a chave.
   ============================================================ */

export type Conferencia =
  | { ok: true; nome: string; email: string }
  | { ok: false; erro: string }

export async function conferirChave(chave: string, ambiente: Ambiente): Promise<Conferencia> {
  const limpa = (chave ?? '').trim()
  if (!limpa) return { ok: false, erro: 'Cole a chave da API antes de ligar.' }

  let r: Response
  try {
    r = await fetch(`${BASES[ambiente]}/myAccount`, {
      headers: { access_token: limpa, 'content-type': 'application/json' },
      cache: 'no-store',
    })
  } catch {
    return {
      ok: false,
      erro: 'Não consegui falar com o Asaas agora. Verifique a internet e tente de novo.',
    }
  }

  if (r.status === 401 || r.status === 403) {
    /* O engano mais comum, de longe: a chave de produção colada com
       "Teste (sandbox)" marcado, ou o contrário. Cada ambiente do Asaas tem
       a sua chave, e uma nunca vale no outro. Sem esta frase, a pessoa
       relê a chave dez vezes procurando um erro de digitação que não
       existe. */
    return {
      ok: false,
      erro:
        ambiente === 'producao'
          ? 'O Asaas recusou esta chave em PRODUÇÃO. Confira se ela não é a chave de teste (sandbox) — são chaves diferentes, uma não vale no lugar da outra.'
          : 'O Asaas recusou esta chave no ambiente de TESTE. Confira se ela não é a chave de produção — são chaves diferentes, uma não vale no lugar da outra.',
    }
  }

  const dados = (await r.json().catch(() => null)) as {
    name?: string
    email?: string
    errors?: { description?: string }[]
  } | null

  if (!r.ok) {
    return {
      ok: false,
      erro: `O Asaas recusou: ${dados?.errors?.[0]?.description ?? `código ${r.status}`}`,
    }
  }

  return { ok: true, nome: dados?.name ?? 'Conta Asaas', email: dados?.email ?? '' }
}

/* ============================================================
   REGISTRAR O AVISO DE PAGAMENTO, SOZINHO

   Quem paga um boleto não volta à plataforma dizer que pagou: o Asaas
   avisa por uma requisição. Esse aviso precisa estar cadastrado lá, e dá
   para cadastrar pela própria API — então a plataforma faz isso na hora de
   ligar, em vez de mandar alguém procurar o menu certo no painel do Asaas.

   Se falhar, NÃO é motivo para recusar a chave. A cobrança passa a
   funcionar do mesmo jeito; o que fica pendente é a baixa automática. A
   tela então mostra o endereço e a senha para cadastrar à mão.
   ============================================================ */

export type RegistroDeAviso =
  | { ok: true; webhookId: string }
  | { ok: false; erro: string }

export async function registrarAviso(
  chave: string,
  ambiente: Ambiente,
  url: string,
  token: string
): Promise<RegistroDeAviso> {
  const corpo = {
    name: 'Escola de Líderes IBAU',
    url,
    email: '',
    enabled: true,
    interrupted: false,
    authToken: token,
    sendType: 'SEQUENTIALLY',
    events: [
      'PAYMENT_RECEIVED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_OVERDUE',
      'PAYMENT_DELETED',
      'PAYMENT_REFUNDED',
    ],
  }

  try {
    const r = await fetch(`${BASES[ambiente]}/webhooks`, {
      method: 'POST',
      headers: { access_token: chave.trim(), 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
      cache: 'no-store',
    })
    const dados = (await r.json().catch(() => null)) as {
      id?: string
      errors?: { description?: string }[]
    } | null

    if (!r.ok || !dados?.id) {
      return {
        ok: false,
        erro: dados?.errors?.[0]?.description ?? `o Asaas respondeu com o código ${r.status}`,
      }
    }
    return { ok: true, webhookId: dados.id }
  } catch {
    return { ok: false, erro: 'não consegui falar com o Asaas' }
  }
}

/* ============================================================
   COBRAR
   ============================================================ */

const MEIO_NO_ASAAS: Record<CobrancaSolicitada['meio'], string> = {
  pix: 'PIX',
  boleto: 'BOLETO',
  cartao: 'CREDIT_CARD',
}

/**
 * Cria a cobrança no provedor.
 *
 * Sem chave, devolve `faltaConfigurar` — e a plataforma segue funcionando:
 * o pedido é registrado como "aguardando pagamento" e a secretaria combina
 * o acerto por fora. É de propósito. A alternativa seria a loja inteira
 * ficar inacessível até a chave chegar, e aí o trabalho de cadastrar
 * produto e preço não poderia nem começar.
 */
export async function criarCobranca(
  pedido: CobrancaSolicitada
): Promise<ResultadoDoProvedor> {
  const cfg = await credenciais()
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
  cfg: Credenciais,
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
