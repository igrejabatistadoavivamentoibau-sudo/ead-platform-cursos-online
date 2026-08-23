import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import { PageHeader } from '@/components/ui'
import ProdutosManager, { type ProdutoNaTela } from '@/components/Loja/ProdutosManager'
import PainelDePagamento, { type PoliticaNaTela } from '@/components/Loja/PainelDePagamento'
import ConexaoAsaas from '@/components/Loja/ConexaoAsaas'
import { estadoDoPagamento } from '@/lib/pagamentos/asaas'

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

  const pagamento = await estadoDoPagamento()

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Loja e pagamentos"
        descricao="Cadastre os produtos da IBAU, defina como a escola recebe e ligue a cobrança on-line."
      />

      {/* ============================================================
          A COBRANÇA ON-LINE FICA NO ALTO

          É a única coisa desta tela que muda o que o aluno consegue fazer.
          Escondida num canto, a coordenação cadastraria a loja inteira e só
          descobriria que o pagamento não está ligado na hora em que alguém
          tentasse comprar.
          ============================================================ */}
      <div className="mb-6">
        <ConexaoAsaas
          estado={{
            ligado: pagamento.ligado,
            ambiente: pagamento.ambiente,
            contaNome: pagamento.contaNome,
            chaveFinal: pagamento.chaveFinal,
            avisoRegistrado: pagamento.webhookRegistrado,
            ligadoEm: pagamento.ligadoEm,
            ligadoPor: pagamento.ligadoPor,
            porVariavelDeAmbiente: pagamento.porVariavelDeAmbiente,
          }}
        />
      </div>

      <div className="space-y-6">
        <PainelDePagamento politica={regra} />
        <ProdutosManager produtos={lista} />
      </div>
    </div>
  )
}
