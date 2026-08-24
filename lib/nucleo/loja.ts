import { createAdminClient } from '@/lib/supabase/admin'
import { escolherOpcao, type MeioDePagamento, type Politica } from '@/lib/precos'
import { criarCobranca, pagamentoLigado } from '@/lib/pagamentos/asaas'
import type { QuemChama } from '@/lib/nucleo/identidade'
import type { Resultado } from '@/lib/nucleo/resposta'

export interface ItemDoCarrinho {
  produtoId: string
  quantidade: number
}

/* ============================================================
   FECHAR O PEDIDO — A REGRA, SEM SABER POR ONDE ENTROU

   Este arquivo NÃO é uma Server Action e não importa nada do Next. É só a
   regra. Quem chama passa `quem` — a pessoa, já conferida — e recebe o
   resultado. Dá na mesma se a chamada veio de um clique no site ou de um
   POST de um aplicativo no celular.

   Era exatamente esse o acoplamento: enquanto a regra ia buscar a sessão
   por conta própria (nos cookies), ela só funcionava dentro do navegador.
   Um aplicativo nativo teria de reimplementar tudo isto do zero — e a
   segunda implementação divergiria da primeira na primeira correção que
   alguém fizesse só de um lado.

   A REGRA QUE SUSTENTA TUDO continua valendo, e agora vale para os dois:
   o cliente manda O QUE quer comprar e COMO quer pagar. Nunca QUANTO
   custa. Preço, desconto, juros e parcela são recalculados aqui, do zero,
   a partir do banco. Se o valor viesse do cliente, bastaria o console (ou
   um `curl`) para transformar um pedido de mil reais num de um real.
   ============================================================ */

const LIMITE_DE_ITENS = 20
const LIMITE_POR_ITEM = 50

export async function fecharPedidoDe(
  quem: QuemChama,
  itens: ItemDoCarrinho[],
  meio: MeioDePagamento,
  parcelas: number
): Promise<Resultado<{ pedidoId: string; url: string | null; aguardandoChave: boolean }>> {
  const pedidos = (itens ?? []).filter((i) => i?.produtoId && i.quantidade > 0)
  if (pedidos.length === 0) return { ok: false, erro: 'Seu carrinho está vazio.' }
  if (pedidos.length > LIMITE_DE_ITENS) {
    return { ok: false, erro: `Compre no máximo ${LIMITE_DE_ITENS} produtos diferentes por vez.` }
  }
  if (pedidos.some((i) => i.quantidade > LIMITE_POR_ITEM)) {
    return { ok: false, erro: `São no máximo ${LIMITE_POR_ITEM} unidades de cada produto.` }
  }

  const admin = createAdminClient()

  /* Os produtos vêm do banco, com o preço do banco. */
  const { data: produtos, error: erroProdutos } = await admin
    .from('produtos')
    .select('id, nome, preco_centavos, estoque, ativo, politica_id')
    .in(
      'id',
      pedidos.map((i) => i.produtoId)
    )

  if (erroProdutos) return { ok: false, erro: erroProdutos.message }

  const porId = new Map((produtos ?? []).map((p) => [p.id as string, p]))

  for (const item of pedidos) {
    const p = porId.get(item.produtoId)
    if (!p) return { ok: false, erro: 'Um dos produtos saiu da loja. Atualize a página.' }
    if (!p.ativo) return { ok: false, erro: `"${p.nome}" não está mais à venda.` }
    if (p.estoque !== null && Number(p.estoque) < item.quantidade) {
      return {
        ok: false,
        erro:
          Number(p.estoque) === 0
            ? `"${p.nome}" está esgotado.`
            : `Restam apenas ${p.estoque} unidade(s) de "${p.nome}".`,
      }
    }
  }

  const subtotal = pedidos.reduce(
    (soma, i) => soma + Number(porId.get(i.produtoId)!.preco_centavos) * i.quantidade,
    0
  )

  /* A regra de pagamento: a exceção do produto vale quando o carrinho tem
     UM produto só. Com produtos de regras diferentes no mesmo carrinho, a
     regra geral é a única resposta honesta — misturar duas tabelas de
     parcelamento numa conta só não significa nada para quem vai pagar. */
  const politica = await carregarPolitica(
    admin,
    pedidos.length === 1 ? (porId.get(pedidos[0].produtoId)!.politica_id as string | null) : null
  )
  if (!politica) return { ok: false, erro: 'A loja ainda não tem regra de pagamento configurada.' }

  const opcao = escolherOpcao(subtotal, politica, meio, Math.floor(parcelas) || 1)
  if (!opcao) {
    return {
      ok: false,
      erro: 'Essa forma de pagamento não está disponível para este valor. Escolha outra.',
    }
  }

  const { data: pedido, error } = await admin
    .from('pedidos')
    .insert({
      comprador_id: quem.id,
      tipo: 'loja',
      status: 'aguardando_pagamento',
      subtotal_centavos: subtotal,
      desconto_centavos: opcao.descontoCentavos,
      juros_centavos: opcao.jurosCentavos,
      total_centavos: opcao.totalCentavos,
      meio: opcao.meio,
      parcelas: opcao.parcelas,
    })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }
  const pedidoId = pedido.id as string

  const { error: erroItens } = await admin.from('pedido_itens').insert(
    pedidos.map((i) => {
      const p = porId.get(i.produtoId)!
      return {
        pedido_id: pedidoId,
        produto_id: p.id,
        nome: p.nome,
        preco_unitario_centavos: p.preco_centavos,
        quantidade: i.quantidade,
      }
    })
  )

  if (erroItens) {
    // Sem os itens, o pedido é um valor sem explicação. Melhor não existir.
    await admin.from('pedidos').delete().eq('id', pedidoId)
    return { ok: false, erro: erroItens.message }
  }

  /* O gatilho do banco recalcula o subtotal a partir dos itens. Aqui
     devolvemos o desconto e os juros, que são da forma de pagamento e o
     gatilho não tem como saber. */
  await admin
    .from('pedidos')
    .update({
      desconto_centavos: opcao.descontoCentavos,
      juros_centavos: opcao.jurosCentavos,
      total_centavos: opcao.totalCentavos,
    })
    .eq('id', pedidoId)

  // Baixa no estoque de quem tem estoque controlado.
  for (const i of pedidos) {
    const p = porId.get(i.produtoId)!
    if (p.estoque !== null) {
      await admin
        .from('produtos')
        .update({ estoque: Math.max(0, Number(p.estoque) - i.quantidade) })
        .eq('id', p.id)
    }
  }

  if (!(await pagamentoLigado())) {
    return { ok: true, pedidoId, url: null, aguardandoChave: true }
  }

  const cobranca = await criarCobranca({
    pedidoId,
    totalCentavos: opcao.totalCentavos,
    parcelas: opcao.parcelas,
    meio: opcao.meio,
    descricao: `Loja IBAU — pedido ${pedidoId.slice(0, 8)}`,
    comprador: { id: quem.id, nome: quem.name, email: quem.email },
  })

  if (!cobranca.ok) {
    /* O pedido FICA. Ele é o registro de que a pessoa quis comprar; apagar
       porque o provedor falhou seria esconder da secretaria uma venda que
       existe. Ela aparece como "aguardando pagamento" e alguém resolve. */
    return {
      ok: true,
      pedidoId,
      url: null,
      aguardandoChave: !!cobranca.faltaConfigurar,
    }
  }

  await admin
    .from('pedidos')
    .update({
      provedor_cobranca_id: cobranca.cobranca.cobrancaId,
      provedor_url: cobranca.cobranca.url,
    })
    .eq('id', pedidoId)

  return { ok: true, pedidoId, url: cobranca.cobranca.url, aguardandoChave: false }
}

async function carregarPolitica(
  admin: ReturnType<typeof createAdminClient>,
  politicaDoProduto: string | null
): Promise<Politica | null> {
  const campos =
    'parcelas_sem_juros, parcelas_max, juros_ao_mes_pct, desconto_avista_pct, parcela_minima_centavos, aceita_pix, aceita_boleto, aceita_cartao'

  if (politicaDoProduto) {
    const { data } = await admin
      .from('politicas_de_pagamento')
      .select(campos)
      .eq('id', politicaDoProduto)
      .maybeSingle()
    if (data) return data as unknown as Politica
  }

  const { data } = await admin
    .from('politicas_de_pagamento')
    .select(campos)
    .eq('geral', true)
    .maybeSingle()

  return (data as unknown as Politica) ?? null
}
