import { CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import { PageHeader } from '@/components/ui'
import ProdutosManager, { type ProdutoNaTela } from '@/components/Loja/ProdutosManager'
import PainelDePagamento, { type PoliticaNaTela } from '@/components/Loja/PainelDePagamento'
import { pagamentoLigado } from '@/lib/pagamentos/asaas'

export const dynamic = 'force-dynamic'

export default async function LojaAdminPage() {
  await exigirPermissao('gerenciar_usuarios')
  const supabase = await createClient()

  const [{ data: produtos }, { data: politica }, { data: vendidos }] = await Promise.all([
    supabase
      .from('produtos')
      .select('id, nome, descricao, categoria, preco_centavos, estoque, ativo')
      .order('ordem', { ascending: true }),
    supabase
      .from('politicas_de_pagamento')
      .select(
        'parcelas_sem_juros, parcelas_max, juros_ao_mes_pct, desconto_avista_pct, parcela_minima_centavos, aceita_pix, aceita_boleto, aceita_cartao'
      )
      .eq('geral', true)
      .maybeSingle(),
    supabase.from('pedido_itens').select('produto_id, quantidade'),
  ])

  const vendasPorProduto = new Map<string, number>()
  for (const v of vendidos ?? []) {
    const k = v.produto_id as string | null
    if (k) vendasPorProduto.set(k, (vendasPorProduto.get(k) ?? 0) + Number(v.quantidade))
  }

  const lista: ProdutoNaTela[] = (produtos ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    descricao: (p.descricao as string) ?? null,
    categoria: p.categoria as ProdutoNaTela['categoria'],
    preco_centavos: Number(p.preco_centavos),
    estoque: p.estoque === null ? null : Number(p.estoque),
    ativo: p.ativo as boolean,
    vendidos: vendasPorProduto.get(p.id as string) ?? 0,
  }))

  const regra: PoliticaNaTela = politica
    ? {
        parcelas_sem_juros: Number(politica.parcelas_sem_juros),
        parcelas_max: Number(politica.parcelas_max),
        juros_ao_mes_pct: Number(politica.juros_ao_mes_pct),
        desconto_avista_pct: Number(politica.desconto_avista_pct),
        parcela_minima_centavos: Number(politica.parcela_minima_centavos),
        aceita_pix: politica.aceita_pix as boolean,
        aceita_boleto: politica.aceita_boleto as boolean,
        aceita_cartao: politica.aceita_cartao as boolean,
      }
    : {
        parcelas_sem_juros: 1,
        parcelas_max: 1,
        juros_ao_mes_pct: 0,
        desconto_avista_pct: 0,
        parcela_minima_centavos: 2000,
        aceita_pix: true,
        aceita_boleto: true,
        aceita_cartao: true,
      }

  const ligado = pagamentoLigado()

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Loja e pagamentos"
        descricao="Cadastre os produtos da IBAU e defina como a escola recebe."
      />

      {/* ============================================================
          O ESTADO DA COBRANÇA ON-LINE

          Isto fica no alto, e não escondido num canto, porque é a única
          coisa desta tela que a coordenação não resolve sozinha. Sem esse
          aviso, ela cadastraria a loja inteira e só descobriria no fim que
          o pagamento não estava ligado — na hora em que um aluno tentasse
          comprar.
          ============================================================ */}
      <div
        className={`mb-6 flex items-start gap-3 rounded-2xl p-4 ring-1 ${
          ligado
            ? 'bg-brand-50/60 text-brand-900 ring-brand-200'
            : 'bg-amber-50 text-amber-900 ring-amber-200'
        }`}
      >
        <CreditCard className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
        <div className="min-w-0">
          {ligado ? (
            <>
              <p className="text-[14px] font-bold">Cobrança on-line ligada (Asaas).</p>
              <p className="mt-0.5 text-[13px] leading-relaxed">
                Quem comprar recebe o link de pagamento na hora, e o pedido vira &ldquo;pago&rdquo;
                sozinho assim que o dinheiro cair.
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-bold">
                A loja funciona, mas a cobrança on-line ainda não está ligada.
              </p>
              <p className="mt-1 text-[13px] leading-relaxed">
                Você já pode cadastrar produtos, preços e as regras de parcelamento — e o aluno já
                pode fazer o pedido. O que falta é o link de pagamento automático: por enquanto, o
                pedido fica como <strong>aguardando pagamento</strong> e a secretaria confirma na
                tela de Pedidos quando receber.
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed">
                Para ligar, é só me mandar a chave do Asaas — eu configuro e nada aqui muda de
                lugar.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <PainelDePagamento politica={regra} />
        <ProdutosManager produtos={lista} />
      </div>
    </div>
  )
}
