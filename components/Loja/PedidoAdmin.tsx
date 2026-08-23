'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, PackageCheck, Undo2, XCircle, AlertCircle, HandCoins } from 'lucide-react'
import {
  marcarRetirado,
  confirmarPagamentoNaMao,
  cancelarPedido,
} from '@/app/dashboard/admin/loja/actions'
import { reais } from '@/lib/precos'
import { apresentar, comoFoiPago, quando, numeroDoPedido } from '@/lib/pedidos'
import { Selo, CAMPO } from '@/components/ui'

export interface PedidoNaTela {
  id: string
  status: string
  total_centavos: number
  meio: string
  parcelas: number
  created_at: string
  pago_em: string | null
  retirado_em: string | null
  observacao: string | null
  comprador: { nome: string; email: string }
  itens: { nome: string; quantidade: number; preco_unitario_centavos: number }[]
}

/* ============================================================
   O PEDIDO, PARA QUEM ENTREGA

   Duas ações e uma trava:

   CONFIRMAR PAGAMENTO existe porque, enquanto a cobrança on-line não está
   ligada, é assim que um pedido vira pago — alguém recebeu o dinheiro na
   secretaria e registra. E vai continuar existindo depois, porque sempre
   haverá quem pague em espécie ali mesmo.

   MARCAR RETIRADO é a entrega do produto.

   A trava: o botão de retirada só aparece depois de pago. Entregar antes
   de receber é o erro que uma tela de pedidos tem obrigação de dificultar.
   ============================================================ */

export default function PedidoAdmin({ pedido }: { pedido: PedidoNaTela }) {
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const estado = apresentar(pedido.status)

  const acao = (fn: () => Promise<{ ok: boolean; erro?: string }>) => {
    setErro(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) return setErro(r.erro ?? 'Não consegui fazer isso.')
      setConfirmando(false)
      setObservacao('')
      router.refresh()
    })
  }

  const pago = pedido.status === 'pago'

  return (
    <div className="card-alive p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] font-bold text-gray-500">
              #{numeroDoPedido(pedido.id)}
            </span>
            <Selo tom={estado.tom}>{estado.rotulo}</Selo>
            {pedido.retirado_em && (
              <Selo tom="verde" icone="Check">
                Retirado
              </Selo>
            )}
          </div>
          <p className="mt-1.5 text-[14px] font-semibold text-gray-800">{pedido.comprador.nome}</p>
          <p className="text-[12px] text-gray-500">{pedido.comprador.email}</p>
          <p className="mt-1 text-[12px] text-gray-500">Feito em {quando(pedido.created_at)}</p>
        </div>

        <p className="text-[18px] font-extrabold tabular-nums text-gray-900">
          {reais(pedido.total_centavos)}
        </p>
      </div>

      <ul className="mt-3 space-y-1">
        {pedido.itens.map((i, n) => (
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
        {comoFoiPago(pedido.meio, pedido.parcelas, pedido.total_centavos)}
      </p>

      <p
        className={`mt-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold ${
          pago ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-900'
        }`}
      >
        {estado.paraASecretaria}
      </p>

      {pedido.observacao && (
        <p className="mt-2 whitespace-pre-line rounded-xl bg-gray-50 px-3 py-2 text-[12px] leading-relaxed text-gray-600">
          {pedido.observacao}
        </p>
      )}

      {erro && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[12.5px] text-red-800 ring-1 ring-red-200">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </div>
      )}

      {/* ---------------- Ações ---------------- */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pedido.status === 'aguardando_pagamento' && !confirmando && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmando(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-40"
            >
              <HandCoins className="h-4 w-4" strokeWidth={2.25} />
              Confirmar pagamento
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => acao(() => cancelarPedido(pedido.id))}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
            >
              <XCircle className="h-4 w-4" strokeWidth={2.25} />
              Cancelar pedido
            </button>
          </>
        )}

        {confirmando && (
          <div className="w-full rounded-xl bg-brand-50/70 p-3 ring-1 ring-brand-200">
            <p className="text-[13px] font-semibold text-brand-900">
              Confirmar que o pagamento de {reais(pedido.total_centavos)} foi recebido?
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-brand-800">
              Fica registrado que a confirmação foi feita na secretaria, com a data e quem
              confirmou.
            </p>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Como recebeu? (dinheiro, Pix na conta da igreja...)"
              className={`${CAMPO} mt-2`}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => acao(() => confirmarPagamentoNaMao(pedido.id, observacao))}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-40"
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
                {isPending ? 'Confirmando...' : 'Sim, recebemos'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="rounded-xl px-3 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Entregar antes de receber é o erro que esta tela tem obrigação
            de dificultar: o botão simplesmente não existe antes do pago. */}
        {pago && !pedido.retirado_em && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => acao(() => marcarRetirado(pedido.id, true))}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-40"
          >
            <PackageCheck className="h-4 w-4" strokeWidth={2.25} />
            Marcar como retirado
          </button>
        )}

        {pedido.retirado_em && (
          <>
            <span className="text-[12.5px] text-gray-500">
              Retirado em {quando(pedido.retirado_em)}
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => acao(() => marcarRetirado(pedido.id, false))}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              Desfazer
            </button>
          </>
        )}
      </div>
    </div>
  )
}
