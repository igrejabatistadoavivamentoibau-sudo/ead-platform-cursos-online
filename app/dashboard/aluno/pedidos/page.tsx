import { PartyPopper } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader, Selo, EstadoVazio, BotaoLink } from '@/components/ui'
import { reais } from '@/lib/precos'
import { apresentar, comoFoiPago, quando, numeroDoPedido } from '@/lib/pedidos'

export const dynamic = 'force-dynamic'

export default async function MeusPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>
}) {
  const { novo } = await searchParams
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select(
      'id, status, total_centavos, meio, parcelas, created_at, pago_em, retirado_em, provedor_url, pedido_itens(nome, quantidade, preco_unitario_centavos)'
    )
    .eq('comprador_id', sessao.id)
    .order('created_at', { ascending: false })

  const lista = pedidos ?? []

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Meus pedidos"
        descricao="O que você comprou na loja da IBAU e em que pé está cada pedido."
        voltar={{ href: '/dashboard/aluno/loja', label: 'Loja IBAU' }}
      />

      {/* Quem acabou de comprar precisa ver, na hora, que deu certo — e o
          que acontece a seguir. Sem isso, "finalizei e caí numa lista"
          parece que não funcionou. */}
      {novo === '1' && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-brand-50 p-4 text-brand-900 ring-1 ring-brand-200">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
          <div>
            <p className="text-[14px] font-bold">Pedido registrado.</p>
            <p className="mt-0.5 text-[13px] leading-relaxed">
              A secretaria já consegue ver. Assim que o pagamento for acertado, seu material fica
              separado para retirada na igreja.
            </p>
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <EstadoVazio
          icone="Receipt"
          titulo="Você ainda não fez nenhum pedido"
          descricao="Os livros e apostilas da escola ficam na Loja IBAU."
          acao={<BotaoLink href="/dashboard/aluno/loja" icone="ShoppingBag">Ir para a loja</BotaoLink>}
        />
      ) : (
        <div className="space-y-3">
          {lista.map((p) => {
            const estado = apresentar(p.status as string)
            const itens = (p.pedido_itens ?? []) as unknown as {
              nome: string
              quantidade: number
              preco_unitario_centavos: number
            }[]

            return (
              <div key={p.id as string} className="card-alive p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-gray-500">
                        #{numeroDoPedido(p.id as string)}
                      </span>
                      <Selo tom={estado.tom}>{estado.rotulo}</Selo>
                      {p.retirado_em && <Selo tom="verde" icone="Check">Retirado</Selo>}
                    </div>
                    <p className="mt-1.5 text-[12.5px] text-gray-500">
                      Feito em {quando(p.created_at as string)}
                    </p>
                  </div>

                  <p className="text-[18px] font-extrabold tabular-nums text-gray-900">
                    {reais(Number(p.total_centavos))}
                  </p>
                </div>

                <ul className="mt-3 space-y-1">
                  {itens.map((i, n) => (
                    <li key={n} className="flex justify-between gap-3 text-[13px] text-gray-700">
                      <span>
                        <span className="font-semibold tabular-nums">{i.quantidade}×</span> {i.nome}
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-500">
                        {reais(i.preco_unitario_centavos * i.quantidade)}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-3 text-[12.5px] text-gray-500">
                  {comoFoiPago(p.meio as string, Number(p.parcelas), Number(p.total_centavos))}
                </p>

                <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-[12.5px] leading-relaxed text-gray-600">
                  {estado.paraOAluno}
                </p>

                {p.status === 'aguardando_pagamento' && p.provedor_url && (
                  <div className="mt-3">
                    <BotaoLink href={p.provedor_url as string} icone="CreditCard">
                      Pagar agora
                    </BotaoLink>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
