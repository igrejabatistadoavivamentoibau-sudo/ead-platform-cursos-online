'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Check, AlertCircle, Percent } from 'lucide-react'
import { salvarPoliticaGeral } from '@/app/dashboard/admin/loja/actions'
import { opcoesDePagamento, reais, centavosDoTexto } from '@/lib/precos'
import { Card, CardTitulo, Campo, CAMPO, Botao } from '@/components/ui'

export interface PoliticaNaTela {
  parcelas_sem_juros: number
  parcelas_max: number
  juros_ao_mes_pct: number
  desconto_avista_pct: number
  parcela_minima_centavos: number
  aceita_pix: boolean
  aceita_boleto: boolean
  aceita_cartao: boolean
}

/* ============================================================
   O PAINEL DE PARCELAS E DESCONTOS

   Quatro números e três chaves decidem como a igreja recebe. O que
   transforma isso numa tela usável não são os campos — é a SIMULAÇÃO ao
   lado: enquanto a pessoa digita, ela vê exatamente o que o aluno vai ver.

   Sem isso, "3x sem juros com parcela mínima de R$ 20" é uma frase; com a
   simulação, é a constatação de que num livro de R$ 49,90 aparecem só duas
   opções. A diferença entre configurar e adivinhar.
   ============================================================ */

/** Um valor de exemplo que existe de verdade na loja de uma igreja. */
const EXEMPLO_CENTAVOS = 4990

export default function PainelDePagamento({ politica }: { politica: PoliticaNaTela }) {
  const [form, setForm] = useState({
    parcelas_sem_juros: String(politica.parcelas_sem_juros),
    parcelas_max: String(politica.parcelas_max),
    juros_ao_mes_pct: String(politica.juros_ao_mes_pct),
    desconto_avista_pct: String(politica.desconto_avista_pct),
    parcela_minima: (politica.parcela_minima_centavos / 100).toFixed(2).replace('.', ','),
    aceita_pix: politica.aceita_pix,
    aceita_boleto: politica.aceita_boleto,
    aceita_cartao: politica.aceita_cartao,
  })
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const num = (x: string) => Number(x.replace(',', '.')) || 0

  /* A simulação usa exatamente a mesma conta do checkout do aluno
     (lib/precos.ts). Se fosse uma cópia aproximada só para a prévia, uma
     das duas ficaria desatualizada e o painel passaria a mentir. */
  const previa = opcoesDePagamento(EXEMPLO_CENTAVOS, {
    parcelas_sem_juros: num(form.parcelas_sem_juros),
    parcelas_max: num(form.parcelas_max),
    juros_ao_mes_pct: num(form.juros_ao_mes_pct),
    desconto_avista_pct: num(form.desconto_avista_pct),
    parcela_minima_centavos: centavosDoTexto(form.parcela_minima) ?? 0,
    aceita_pix: form.aceita_pix,
    aceita_boleto: form.aceita_boleto,
    aceita_cartao: form.aceita_cartao,
  })

  const salvar = () => {
    setErro(null)
    setSalvo(false)
    startTransition(async () => {
      const r = await salvarPoliticaGeral({
        parcelas_sem_juros: num(form.parcelas_sem_juros),
        parcelas_max: num(form.parcelas_max),
        juros_ao_mes_pct: num(form.juros_ao_mes_pct),
        desconto_avista_pct: num(form.desconto_avista_pct),
        parcela_minima: form.parcela_minima,
        aceita_pix: form.aceita_pix,
        aceita_boleto: form.aceita_boleto,
        aceita_cartao: form.aceita_cartao,
      })
      if (!r.ok) return setErro(r.erro)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 4000)
      router.refresh()
    })
  }

  const Chave = ({
    campo,
    rotulo,
    descricao,
  }: {
    campo: 'aceita_pix' | 'aceita_boleto' | 'aceita_cartao'
    rotulo: string
    descricao: string
  }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-gray-50/70 p-3 ring-1 ring-brand-950/[0.05] transition-colors hover:bg-brand-50/40">
      <input
        type="checkbox"
        checked={form[campo]}
        onChange={(e) => setForm({ ...form, [campo]: e.target.checked })}
        className="mt-0.5 h-4 w-4 accent-brand-600"
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-gray-800">{rotulo}</span>
        <span className="block text-[12px] leading-relaxed text-gray-500">{descricao}</span>
      </span>
    </label>
  )

  return (
    <Card>
      <CardTitulo icone="CreditCard">Formas de pagamento, parcelas e descontos</CardTitulo>

      <p className="mb-5 text-[13px] leading-relaxed text-gray-500">
        Vale para a loja inteira. Um produto específico pode ter regra própria, se algum dia
        precisar.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Parcelas sem juros">
              <input
                type="number"
                min={1}
                max={24}
                value={form.parcelas_sem_juros}
                onChange={(e) => setForm({ ...form, parcelas_sem_juros: e.target.value })}
                className={CAMPO}
              />
              <p className="mt-1 text-[11.5px] text-gray-500">
                Até quantas vezes o aluno divide sem pagar nada a mais. 1 = só à vista.
              </p>
            </Campo>

            <Campo label="Máximo de parcelas">
              <input
                type="number"
                min={1}
                max={24}
                value={form.parcelas_max}
                onChange={(e) => setForm({ ...form, parcelas_max: e.target.value })}
                className={CAMPO}
              />
              <p className="mt-1 text-[11.5px] text-gray-500">
                Acima das sem juros, só aparece se você informar os juros ao lado.
              </p>
            </Campo>

            <Campo label="Juros ao mês (%)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.juros_ao_mes_pct}
                onChange={(e) => setForm({ ...form, juros_ao_mes_pct: e.target.value })}
                className={CAMPO}
              />
              <p className="mt-1 text-[11.5px] text-gray-500">
                Deixe 0 para não parcelar além das sem juros.
              </p>
            </Campo>

            <Campo label="Desconto à vista (%)">
              <input
                type="number"
                min={0}
                max={90}
                step="0.01"
                value={form.desconto_avista_pct}
                onChange={(e) => setForm({ ...form, desconto_avista_pct: e.target.value })}
                className={CAMPO}
              />
              <p className="mt-1 text-[11.5px] text-gray-500">
                Aplicado em qualquer pagamento em 1 vez — Pix, boleto ou cartão.
              </p>
            </Campo>

            <Campo label="Valor mínimo da parcela">
              <input
                type="text"
                inputMode="decimal"
                value={form.parcela_minima}
                onChange={(e) => setForm({ ...form, parcela_minima: e.target.value })}
                placeholder="20,00"
                className={CAMPO}
              />
              <p className="mt-1 text-[11.5px] text-gray-500">
                Evita &ldquo;12x de R$ 3,33&rdquo; num produto barato.
              </p>
            </Campo>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-700">O que a loja aceita</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Chave campo="aceita_pix" rotulo="Pix" descricao="Cai na hora. Sempre à vista." />
              <Chave
                campo="aceita_boleto"
                rotulo="Boleto"
                descricao="Compensa em 1 a 3 dias. À vista."
              />
              <Chave
                campo="aceita_cartao"
                rotulo="Cartão de crédito"
                descricao="É por ele que o parcelamento acontece."
              />
            </div>
          </div>

          {erro && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[13px] text-red-800 ring-1 ring-red-200">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" strokeWidth={2.25} />
              {erro}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Botao onClick={salvar} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar regras'}
            </Botao>
            {salvo && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700">
                <Check className="h-4 w-4" strokeWidth={2.5} />
                Salvo. O aluno já vê assim.
              </span>
            )}
          </div>
        </div>

        {/* ---------- A simulação ---------- */}
        <div className="rounded-2xl bg-brand-50/50 p-4 ring-1 ring-brand-200/60">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-brand-800">
            <Percent className="h-3.5 w-3.5" strokeWidth={2.5} />
            Como o aluno vai ver
          </p>
          <p className="mt-1 text-[12.5px] text-gray-600">
            Num produto de <strong>{reais(EXEMPLO_CENTAVOS)}</strong>:
          </p>

          <ul className="mt-3 space-y-1.5">
            {previa.map((o) => (
              <li
                key={`${o.meio}-${o.parcelas}`}
                className="rounded-lg bg-white px-3 py-2 ring-1 ring-brand-950/[0.06]"
              >
                <span className="block text-[13px] font-semibold text-gray-800">{o.rotulo}</span>
                {o.detalhe && (
                  <span className="block text-[11.5px] leading-relaxed text-gray-500">
                    {o.detalhe}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {previa.length === 0 && (
            <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-[12.5px] font-semibold text-amber-900">
              Do jeito que está, o aluno não teria nenhuma forma de pagar.
            </p>
          )}

          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-gray-500">
            <CreditCard className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Esta prévia usa exatamente a mesma conta do checkout — não é uma aproximação.
          </p>
        </div>
      </div>
    </Card>
  )
}
