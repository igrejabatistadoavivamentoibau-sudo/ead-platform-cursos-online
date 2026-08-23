'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { obterSessao } from '@/lib/auth'
import { escolherOpcao, type MeioDePagamento, type Politica } from '@/lib/precos'
import { criarCobranca, pagamentoLigado } from '@/lib/pagamentos/asaas'

export type Resultado<T = unknown> =
  | ({ ok: true } & (T extends object ? T : object))
  | { ok: false; erro: string }

export interface ItemDoCarrinho {
  produtoId: string
  quantidade: number
}

/* ============================================================
   FECHAR O PEDIDO

   A REGRA QUE SUSTENTA TUDO: o navegador manda O QUE a pessoa quer
   comprar e COMO quer pagar. Nunca QUANTO custa.

   Preço, desconto, juros e o valor de cada parcela são recalculados aqui,
   do zero, a partir do que está no banco. Se o valor viesse do navegador,
   bastaria o console para transformar um pedido de mil reais num pedido de
   um real — e a plataforma cobraria um real, obedientemente, sem nenhum
   erro aparecer em lugar nenhum.
   ============================================================ */

const LIMITE_DE_ITENS = 20
const LIMITE_POR_ITEM = 50

export async function fecharPedido(
  itens: ItemDoCarrinho[],
  meio: MeioDePagamento,
  parcelas: number
): Promise<Resultado<{ pedidoId: string; url: string | null; aguardandoChave: boolean }>> {
  const sessao = await obterSessao()
  if (!sessao) return { ok: false, erro: 'Entre de novo para finalizar a compra.' }

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
      comprador_id: sessao.id,
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

  revalidatePath('/dashboard/aluno/pedidos')
  revalidatePath('/dashboard/admin/pedidos')
  revalidatePath('/dashboard/aluno/loja')

  if (!pagamentoLigado()) {
    return { ok: true, pedidoId, url: null, aguardandoChave: true }
  }

  const cobranca = await criarCobranca({
    pedidoId,
    totalCentavos: opcao.totalCentavos,
    parcelas: opcao.parcelas,
    meio: opcao.meio,
    descricao: `Loja IBAU — pedido ${pedidoId.slice(0, 8)}`,
    comprador: { id: sessao.id, nome: sessao.name, email: sessao.email },
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
