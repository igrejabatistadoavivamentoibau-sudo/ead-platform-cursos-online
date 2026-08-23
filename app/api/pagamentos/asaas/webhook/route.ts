import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { statusDoAviso } from '@/lib/pagamentos/asaas'

export const dynamic = 'force-dynamic'

/* ============================================================
   O AVISO DE QUE O PAGAMENTO CAIU

   Quem paga um boleto não volta para a plataforma dizer que pagou: o
   provedor é que avisa, por uma requisição para este endereço. Este
   arquivo é o que transforma esse aviso em "pedido pago".

   Ele já está pronto e ainda não recebe nada — falta a chave do Asaas e o
   cadastro deste endereço lá. Quando chegar a hora:

     endereço:  https://<o-site>/api/pagamentos/asaas/webhook
     variável:  ASAAS_WEBHOOK_TOKEN  (a mesma senha cadastrada no Asaas)

   TRÊS CUIDADOS QUE PARECEM EXAGERO E NÃO SÃO
   ------------------------------------------------------------
   1. CONFERIR QUEM ESTÁ FALANDO. Este endereço é público — qualquer um na
      internet pode chamá-lo. Sem a senha combinada, alguém marcaria os
      próprios pedidos como pagos mandando uma mensagem daqui de fora.

   2. AGUENTAR O MESMO AVISO DUAS VEZES. Provedor de pagamento reenvia o
      aviso quando não recebe resposta a tempo, e isso é normal. Marcar
      "pago" de novo é inofensivo; o que não pode é o segundo aviso
      desfazer o que o primeiro fez, ou gerar dois registros de pagamento.

   3. NÃO OBEDECER A ESTADO DESCONHECIDO. Um evento que a plataforma não
      conhece não vira "pago" por descuido: fica só registrado, e alguém
      olha. Aqui, o silêncio é mais seguro que o palpite.
   ============================================================ */

export async function POST(request: NextRequest) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN ?? ''

  // Sem senha configurada, o endereço não aceita nada. Fechado é melhor
  // que aberto "só até configurarem".
  if (!esperado) {
    return NextResponse.json({ erro: 'Webhook ainda não configurado.' }, { status: 503 })
  }

  const recebido = request.headers.get('asaas-access-token') ?? ''
  if (recebido !== esperado) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  let corpo: {
    event?: string
    payment?: { id?: string; externalReference?: string; value?: number }
  }
  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const cobrancaId = corpo.payment?.id ?? null
  const pedidoId = corpo.payment?.externalReference ?? null

  /* O evento é registrado ANTES de qualquer decisão, e sempre — inclusive
     quando não muda nada. É esse registro que permite descobrir, meses
     depois, por que um pedido está como está. */
  await admin.from('pagamento_eventos').insert({
    pedido_id: pedidoId,
    provedor: 'asaas',
    evento: corpo.event ?? null,
    cobranca_id: cobrancaId,
    corpo: corpo as unknown as Record<string, unknown>,
  })

  const novo = statusDoAviso(corpo.event ?? '')
  if (!novo || !pedidoId) {
    // Recebido e guardado. Responder 200 evita o provedor reenviar para sempre.
    return NextResponse.json({ ok: true, aplicado: false })
  }

  const { data: pedido } = await admin
    .from('pedidos')
    .select('id, status')
    .eq('id', pedidoId)
    .maybeSingle()

  if (!pedido) return NextResponse.json({ ok: true, aplicado: false })

  // O mesmo aviso de novo não refaz nada.
  if (pedido.status === novo) return NextResponse.json({ ok: true, aplicado: false })

  await admin
    .from('pedidos')
    .update({
      status: novo,
      ...(novo === 'pago' ? { pago_em: new Date().toISOString() } : {}),
      ...(cobrancaId ? { provedor_cobranca_id: cobrancaId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedidoId)

  return NextResponse.json({ ok: true, aplicado: true })
}
