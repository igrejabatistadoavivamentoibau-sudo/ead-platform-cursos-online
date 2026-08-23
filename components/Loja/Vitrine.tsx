'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingBag,
  Plus,
  Minus,
  BookOpen,
  FileText,
  Shirt,
  Package,
  AlertCircle,
  Check,
  ArrowRight,
} from 'lucide-react'
import { fecharPedido } from '@/app/dashboard/aluno/loja/actions'
import {
  opcoesDePagamento,
  reais,
  NOME_DO_MEIO,
  type MeioDePagamento,
  type Politica,
} from '@/lib/precos'
import { Card, EstadoVazio } from '@/components/ui'

export interface ProdutoDaVitrine {
  id: string
  nome: string
  descricao: string | null
  categoria: 'livro' | 'apostila' | 'vestuario' | 'outro'
  preco_centavos: number
  estoque: number | null
}

const ICONE = {
  livro: BookOpen,
  apostila: FileText,
  vestuario: Shirt,
  outro: Package,
} as const

/* ============================================================
   A LOJA, DO LADO DE QUEM COMPRA

   O CARRINHO MORA NA TELA, e não no banco. Enquanto a pessoa está
   escolhendo, nada disso é assunto do servidor: um carrinho salvo no banco
   a cada clique geraria uma ida à rede por unidade somada, e deixaria
   pedidos pela metade espalhados para sempre. O servidor entra uma vez, no
   fim, quando existe uma decisão.

   E O QUE VAI PARA O SERVIDOR SÃO OS IDs, NUNCA OS PREÇOS. Os valores
   abaixo servem para a pessoa ver a conta antes de decidir; o valor
   cobrado é recalculado no servidor, a partir do banco. As duas contas
   usam a mesma função (lib/precos.ts), então elas não divergem — mas a que
   vale é sempre a de lá.
   ============================================================ */

export default function Vitrine({
  produtos,
  politica,
  pagamentoLigado,
}: {
  produtos: ProdutoDaVitrine[]
  politica: Politica
  pagamentoLigado: boolean
}) {
  const [carrinho, setCarrinho] = useState<Record<string, number>>({})
  const [meio, setMeio] = useState<MeioDePagamento | null>(null)
  const [parcelas, setParcelas] = useState(1)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos])

  const itens = Object.entries(carrinho).filter(([, q]) => q > 0)
  const subtotal = itens.reduce(
    (soma, [id, q]) => soma + (porId.get(id)?.preco_centavos ?? 0) * q,
    0
  )

  const opcoes = useMemo(
    () => (subtotal > 0 ? opcoesDePagamento(subtotal, politica) : []),
    [subtotal, politica]
  )

  const escolhida = opcoes.find((o) => o.meio === meio && o.parcelas === parcelas) ?? null

  const mudar = (id: string, delta: number) => {
    setErro(null)
    setCarrinho((c) => {
      const p = porId.get(id)
      const atual = c[id] ?? 0
      const teto = p?.estoque === null || p?.estoque === undefined ? 99 : p.estoque
      const novo = Math.max(0, Math.min(teto, atual + delta))
      return { ...c, [id]: novo }
    })
  }

  const finalizar = () => {
    if (!escolhida) return
    setErro(null)
    startTransition(async () => {
      const r = await fecharPedido(
        itens.map(([produtoId, quantidade]) => ({ produtoId, quantidade })),
        escolhida.meio,
        escolhida.parcelas
      )
      if (!r.ok) return setErro(r.erro)

      /* Com o pagamento ligado, o provedor devolve o endereço para pagar e
         a pessoa vai direto para lá. Sem ele, ela vai para "Meus pedidos",
         onde está escrito o que acontece agora. */
      if (r.url) window.location.href = r.url
      else router.push('/dashboard/aluno/pedidos?novo=1')
    })
  }

  if (produtos.length === 0) {
    return (
      <EstadoVazio
        icone="ShoppingBag"
        titulo="A loja ainda não tem produtos"
        descricao="Assim que a secretaria cadastrar os livros e apostilas, eles aparecem aqui."
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* ---------------- Vitrine ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        {produtos.map((p) => {
          const Icone = ICONE[p.categoria] ?? Package
          const quantidade = carrinho[p.id] ?? 0
          const esgotado = p.estoque === 0

          return (
            <div
              key={p.id}
              className={`flex flex-col rounded-2xl bg-white p-4 ring-1 transition-all ${
                quantidade > 0
                  ? 'ring-brand-400 shadow-card'
                  : 'ring-brand-950/[0.07] hover:ring-brand-950/[0.12]'
              } ${esgotado ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
                  <Icone className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-bold leading-snug text-gray-900">
                    {p.nome}
                  </p>
                  {p.descricao && (
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-gray-500">
                      {p.descricao}
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-3 text-[19px] font-extrabold tracking-tight text-brand-800">
                {reais(p.preco_centavos)}
              </p>

              {p.estoque !== null && (
                <p className="mt-0.5 text-[11.5px] font-semibold text-gray-500">
                  {esgotado ? 'Esgotado' : `${p.estoque} disponível(is)`}
                </p>
              )}

              <div className="mt-auto pt-3">
                {esgotado ? (
                  <span className="block rounded-xl bg-gray-100 py-2 text-center text-[13px] font-semibold text-gray-500">
                    Esgotado
                  </span>
                ) : quantidade === 0 ? (
                  <button
                    type="button"
                    onClick={() => mudar(p.id, 1)}
                    className="w-full rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 py-2.5 text-[13.5px] font-semibold text-white transition-all hover:shadow-glow active:scale-[0.98]"
                  >
                    Adicionar
                  </button>
                ) : (
                  <div className="flex items-center justify-between rounded-xl bg-brand-50 p-1 ring-1 ring-brand-200">
                    <button
                      type="button"
                      onClick={() => mudar(p.id, -1)}
                      aria-label="Tirar um"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-800 transition-colors hover:bg-white"
                    >
                      <Minus className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                    <span className="text-[15px] font-bold tabular-nums text-brand-900">
                      {quantidade}
                    </span>
                    <button
                      type="button"
                      onClick={() => mudar(p.id, 1)}
                      aria-label="Somar um"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-800 transition-colors hover:bg-white"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ---------------- Carrinho e pagamento ---------------- */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card>
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-gray-900">
            <ShoppingBag className="h-4 w-4 text-brand-600" strokeWidth={2.25} />
            Seu pedido
          </h2>

          {itens.length === 0 ? (
            <p className="mt-3 text-[13px] leading-relaxed text-gray-500">
              Escolha os produtos ao lado. A forma de pagamento aparece aqui.
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-1.5">
                {itens.map(([id, q]) => {
                  const p = porId.get(id)!
                  return (
                    <li key={id} className="flex items-start justify-between gap-2 text-[13px]">
                      <span className="min-w-0 text-gray-700">
                        <span className="font-semibold tabular-nums">{q}×</span> {p.nome}
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-600">
                        {reais(p.preco_centavos * q)}
                      </span>
                    </li>
                  )
                })}
              </ul>

              <div className="mt-3 flex items-baseline justify-between border-t border-gray-100 pt-3">
                <span className="text-[13px] text-gray-500">Subtotal</span>
                <span className="text-[17px] font-extrabold tabular-nums text-gray-900">
                  {reais(subtotal)}
                </span>
              </div>

              {/* ---------- Formas de pagamento ---------- */}
              <p className="mt-4 text-[12px] font-bold uppercase tracking-wider text-gray-500">
                Como você quer pagar
              </p>

              <div className="mt-2 space-y-1.5">
                {opcoes.map((o) => {
                  const ativa = o.meio === meio && o.parcelas === parcelas
                  return (
                    <button
                      key={`${o.meio}-${o.parcelas}`}
                      type="button"
                      onClick={() => {
                        setMeio(o.meio)
                        setParcelas(o.parcelas)
                        setErro(null)
                      }}
                      className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left ring-1 transition-all ${
                        ativa
                          ? 'bg-brand-50 ring-brand-400'
                          : 'bg-white ring-brand-950/[0.07] hover:ring-brand-300'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ${
                          ativa ? 'bg-brand-600 ring-brand-600' : 'bg-white ring-gray-300'
                        }`}
                      >
                        {ativa && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-gray-800">
                          {o.rotulo}
                        </span>
                        {o.detalhe && (
                          <span className="block text-[11.5px] leading-relaxed text-gray-500">
                            {o.detalhe}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>

              {escolhida && (
                <div className="mt-4 flex items-baseline justify-between rounded-xl bg-brand-950 px-3.5 py-3 text-white">
                  <span className="text-[12.5px] text-brand-100">
                    Total em {NOME_DO_MEIO[escolhida.meio].toLowerCase()}
                    {escolhida.parcelas > 1 ? ` (${escolhida.parcelas}x)` : ''}
                  </span>
                  <span className="text-[17px] font-extrabold tabular-nums">
                    {reais(escolhida.totalCentavos)}
                  </span>
                </div>
              )}

              {erro && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[12.5px] text-red-800 ring-1 ring-red-200">
                  <AlertCircle className="mt-px h-4 w-4 shrink-0" strokeWidth={2.25} />
                  {erro}
                </div>
              )}

              <button
                type="button"
                onClick={finalizar}
                disabled={!escolhida || isPending}
                className="group mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 py-3 text-[14px] font-semibold text-white transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-40 disabled:hover:shadow-none"
              >
                {isPending ? 'Fechando pedido...' : 'Finalizar pedido'}
                {!isPending && (
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2.25}
                  />
                )}
              </button>

              <p className="mt-3 text-[11.5px] leading-relaxed text-gray-500">
                {pagamentoLigado
                  ? 'Ao finalizar, você vai para a tela de pagamento. A retirada é na secretaria da igreja.'
                  : 'O pagamento on-line ainda está sendo ligado. Seu pedido fica registrado e a secretaria combina o acerto e a retirada com você.'}
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
