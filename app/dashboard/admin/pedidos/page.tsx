import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import { PageHeader, EstadoVazio, Indicador } from '@/components/ui'
import PedidoAdmin, { type PedidoNaTela } from '@/components/Loja/PedidoAdmin'
import { reais } from '@/lib/precos'

export const dynamic = 'force-dynamic'

export default async function PedidosAdminPage() {
  await exigirPermissao('gerenciar_usuarios')
  const supabase = await createClient()

  /* O join com `users` é explícito no vínculo: `pedidos` aponta para
     `users` por dois caminhos (quem comprou e quem entregou), e sem dizer
     qual o banco recusa a consulta inteira — devolvendo uma tela vazia sem
     erro nenhum. Já aconteceu neste projeto; não acontece de novo. */
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(
      'id, status, total_centavos, meio, parcelas, created_at, pago_em, retirado_em, observacao, ' +
        'comprador:users!pedidos_comprador_id_fkey(name, email), ' +
        'pedido_itens(nome, quantidade, preco_unitario_centavos)'
    )
    .eq('tipo', 'loja')
    .order('created_at', { ascending: false })
    .limit(200)

  const lista: PedidoNaTela[] = ((pedidos ?? []) as unknown as Record<string, unknown>[]).map((p) => {
    const u = p.comprador as { name?: string; email?: string } | null
    return {
      id: p.id as string,
      status: p.status as string,
      total_centavos: Number(p.total_centavos),
      meio: p.meio as string,
      parcelas: Number(p.parcelas),
      created_at: p.created_at as string,
      pago_em: (p.pago_em as string) ?? null,
      retirado_em: (p.retirado_em as string) ?? null,
      observacao: (p.observacao as string) ?? null,
      comprador: { nome: u?.name ?? 'Aluno', email: u?.email ?? '' },
      itens: (p.pedido_itens ?? []) as PedidoNaTela['itens'],
    }
  })

  const aguardando = lista.filter((p) => p.status === 'aguardando_pagamento')
  const paraEntregar = lista.filter((p) => p.status === 'pago' && !p.retirado_em)
  const recebido = lista
    .filter((p) => p.status === 'pago')
    .reduce((s, p) => s + p.total_centavos, 0)

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Pedidos"
        descricao="O que foi comprado na loja, o que falta receber e o que está pronto para entregar."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador icone="Clock" valor={aguardando.length} label="Aguardando pagamento" />
        <Indicador icone="PackageCheck" valor={paraEntregar.length} label="Prontos para retirar" destaque />
        <Indicador icone="Receipt" valor={lista.length} label="Pedidos ao todo" />
        <Indicador icone="Wallet" valor={reais(recebido)} label="Recebido" />
      </div>

      {lista.length === 0 ? (
        <EstadoVazio
          icone="Receipt"
          titulo="Nenhum pedido ainda"
          descricao="Quando alguém comprar na Loja IBAU, o pedido aparece aqui para a secretaria acompanhar."
        />
      ) : (
        <div className="space-y-3">
          {lista.map((p) => (
            <PedidoAdmin key={p.id} pedido={p} />
          ))}
        </div>
      )}
    </div>
  )
}
