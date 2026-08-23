import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader } from '@/components/ui'
import Vitrine, { type ProdutoDaVitrine } from '@/components/Loja/Vitrine'
import { pagamentoLigado } from '@/lib/pagamentos/asaas'
import type { Politica } from '@/lib/precos'

export const dynamic = 'force-dynamic'

export default async function LojaDoAlunoPage() {
  await exigirSessao()
  const supabase = await createClient()

  const [{ data: produtos }, { data: politica }] = await Promise.all([
    supabase
      .from('produtos')
      .select('id, nome, descricao, categoria, preco_centavos, estoque')
      .eq('ativo', true)
      .order('ordem', { ascending: true }),
    supabase
      .from('politicas_de_pagamento')
      .select(
        'parcelas_sem_juros, parcelas_max, juros_ao_mes_pct, desconto_avista_pct, parcela_minima_centavos, aceita_pix, aceita_boleto, aceita_cartao'
      )
      .eq('geral', true)
      .maybeSingle(),
  ])

  const lista: ProdutoDaVitrine[] = (produtos ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    descricao: (p.descricao as string) ?? null,
    categoria: p.categoria as ProdutoDaVitrine['categoria'],
    preco_centavos: Number(p.preco_centavos),
    estoque: p.estoque === null ? null : Number(p.estoque),
  }))

  const regra: Politica = politica
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
        parcela_minima_centavos: 0,
        aceita_pix: true,
        aceita_boleto: true,
        aceita_cartao: true,
      }

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Loja IBAU"
        descricao="Livros, apostilas e materiais da escola. A retirada é na secretaria da igreja."
      />
      <Vitrine produtos={lista} politica={regra} pagamentoLigado={await pagamentoLigado()} />
    </div>
  )
}
