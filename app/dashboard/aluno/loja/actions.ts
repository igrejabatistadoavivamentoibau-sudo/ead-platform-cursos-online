'use server'

import { revalidatePath } from 'next/cache'
import { obterSessao } from '@/lib/auth'
import { fecharPedidoDe } from '@/lib/nucleo/loja'
import type { ItemDoCarrinho } from '@/lib/nucleo/loja'
import type { MeioDePagamento } from '@/lib/precos'
import type { Resultado } from '@/lib/nucleo/resposta'

export type { ItemDoCarrinho, Resultado }

/* ============================================================
   A PORTA DO NAVEGADOR

   A regra de fechar pedido NÃO mora mais aqui. Ela está em
   `lib/nucleo/loja.ts`, sem saber o que é cookie, Server Action ou Next.

   O que sobrou neste arquivo são as duas coisas que só existem no site:

     1. pegar a sessão do COOKIE — num aplicativo nativo ela vem no
        cabeçalho `Authorization` (ver `lib/nucleo/identidade.ts`);
     2. mandar o Next redesenhar as telas afetadas.

   A porta do aplicativo é `app/api/v1/pedidos/route.ts`, e ela chama
   exatamente a MESMA função. Duas portas, uma regra — que é a única forma
   de as duas nunca discordarem sobre quanto custa um livro.
   ============================================================ */

export async function fecharPedido(
  itens: ItemDoCarrinho[],
  meio: MeioDePagamento,
  parcelas: number
): Promise<Resultado<{ pedidoId: string; url: string | null; aguardandoChave: boolean }>> {
  const sessao = await obterSessao()
  if (!sessao) return { ok: false, erro: 'Entre de novo para finalizar a compra.' }

  const r = await fecharPedidoDe(sessao, itens, meio, parcelas)

  /* Só redesenha se algo mudou de verdade. Revalidar depois de uma recusa
     jogaria fora o cache de três telas à toa. */
  if (r.ok) {
    revalidatePath('/dashboard/aluno/pedidos')
    revalidatePath('/dashboard/admin/pedidos')
    revalidatePath('/dashboard/aluno/loja')
  }

  return r
}
