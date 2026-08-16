import { createAdminClient } from '@/lib/supabase/admin'
import { criarAdaptadorAsaas } from './asaas'
import type { AdaptadorPagamento, ProvedorPagamento } from './tipos'

export * from './tipos'

/**
 * Adaptador "manual": a igreja recebe por fora (Pix na chave dela) e alguém
 * marca como pago no painel. É o padrão até a empresa ser ligada, e continua
 * útil depois — para dinheiro em espécie e isenções, que existem sempre.
 */
const MANUAL: AdaptadorPagamento = {
  nome: 'manual',
  rotulo: 'Controle manual',
  async criarCobranca() {
    return { provedorId: '', linkPagamento: null, status: 'pendente' as const }
  },
  async consultarCobranca(provedorId) {
    return { provedorId, status: 'pendente' as const }
  },
  async cancelarCobranca() {},
  interpretarAviso() {
    return null
  },
}

/**
 * Descobre qual empresa está ligada e devolve o adaptador dela.
 *
 * A escolha vem do banco, não de variável de ambiente, para a liderança
 * trocar sem depender de novo deploy. Só a CHAVE fica em variável de
 * ambiente — segredo não se guarda em tabela.
 */
export async function obterAdaptadorDePagamento(): Promise<AdaptadorPagamento> {
  const admin = createAdminClient()
  const { data: cfg } = await admin
    .from('config_pagamento')
    .select('provedor, ativo, ambiente')
    .eq('id', true)
    .maybeSingle()

  if (!cfg?.ativo) return MANUAL

  const provedor = cfg.provedor as ProvedorPagamento
  const ambiente = (cfg.ambiente ?? 'sandbox') as 'sandbox' | 'producao'

  switch (provedor) {
    case 'asaas': {
      const chave = process.env.ASAAS_API_KEY
      // Sem chave configurada, cair para o manual é melhor do que quebrar a
      // inscrição de quem está tentando entrar na escola.
      if (!chave) return MANUAL
      return criarAdaptadorAsaas(chave, ambiente)
    }
    // Mercado Pago e Stripe entram aqui quando/se a instituição trocar.
    // Basta escrever o adaptador — nada mais no sistema muda.
    default:
      return MANUAL
  }
}
