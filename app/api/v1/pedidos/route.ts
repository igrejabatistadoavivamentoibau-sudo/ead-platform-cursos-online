import { quemChamaPorToken, tokenDoCabecalho } from '@/lib/nucleo/identidade'
import { corpoInvalido, daRegra, naoAutenticado, rota } from '@/lib/nucleo/resposta'
import { fecharPedidoDe, type ItemDoCarrinho } from '@/lib/nucleo/loja'
import type { MeioDePagamento } from '@/lib/precos'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/* ============================================================
   POST /api/v1/pedidos

   O checkout da loja, para um aplicativo nativo. Chama a MESMA função que
   o botão "Finalizar pedido" do site chama — `fecharPedidoDe`, em
   `lib/nucleo/loja.ts`. Não existe uma segunda conta de preço aqui.

   Corpo esperado:
     { "itens": [{ "produtoId": "uuid", "quantidade": 2 }],
       "meio": "pix" | "boleto" | "cartao",
       "parcelas": 1 }

   Resposta:
     201 { ok: true, pedidoId, url, aguardandoChave }
     422 { ok: false, erro: "..." }   — a regra recusou (esgotado, etc.)
     401 { ok: false, erro: "..." }   — token vencido ou conta desativada

   NÃO EXISTE CAMPO DE VALOR NESTE CORPO, e isso é a decisão inteira. O
   cliente diz o que quer e como quer pagar; quanto custa é conta do
   servidor, a partir do banco. Um `curl` mal-intencionado não tem onde
   escrever "total: 1".

   A CONFERÊNCIA DE ESTOQUE, DE PRODUTO ATIVO E DE FORMA DE PAGAMENTO
   também está lá dentro — não aqui. Regra que mora na porta é regra que
   vale só naquela porta, e era esse o problema que este arquivo existe
   para não repetir.
   ============================================================ */

const MEIOS: MeioDePagamento[] = ['pix', 'boleto', 'cartao']

export async function POST(req: Request) {
  return rota(async () => {
    const quem = await quemChamaPorToken(tokenDoCabecalho(req))
    if (!quem) return naoAutenticado()

    let corpo: { itens?: unknown; meio?: unknown; parcelas?: unknown }
    try {
      corpo = await req.json()
    } catch {
      return corpoInvalido('Corpo da requisição não é JSON válido.')
    }

    if (!Array.isArray(corpo.itens)) {
      return corpoInvalido('Mande "itens" como uma lista.')
    }

    /* A forma dos itens é conferida AQUI porque é assunto do transporte:
       o site manda objetos tipados pelo TypeScript, o aplicativo manda
       JSON cru. O que cada item significa — se o produto existe, se tem
       estoque — continua sendo assunto da regra. */
    const itens: ItemDoCarrinho[] = []
    for (const bruto of corpo.itens) {
      const i = bruto as { produtoId?: unknown; quantidade?: unknown }
      if (typeof i?.produtoId !== 'string' || !i.produtoId) {
        return corpoInvalido('Cada item precisa de um "produtoId".')
      }
      const q = Number(i.quantidade)
      if (!Number.isFinite(q) || q < 1) {
        return corpoInvalido(`Quantidade inválida para o produto ${i.produtoId}.`)
      }
      itens.push({ produtoId: i.produtoId, quantidade: Math.floor(q) })
    }

    const meio = corpo.meio as MeioDePagamento
    if (!MEIOS.includes(meio)) {
      return corpoInvalido(`"meio" deve ser um destes: ${MEIOS.join(', ')}.`)
    }

    const parcelas = Number(corpo.parcelas)
    const r = await fecharPedidoDe(
      quem,
      itens,
      meio,
      Number.isFinite(parcelas) ? Math.floor(parcelas) : 1
    )

    return daRegra(r, 201)
  })
}
