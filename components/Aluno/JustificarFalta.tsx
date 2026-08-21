'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquareWarning, Check, X, Clock } from 'lucide-react'
import { justificarFalta } from '@/app/dashboard/aluno/actions'
import { Botao, Alerta, CAMPO } from '@/components/ui'

/* ============================================================
   JUSTIFICAR UMA FALTA

   Hoje a falta é um número e ponto final: o aluno vê "AUSENTE" e não tem
   onde dizer que estava no hospital. Quem quer justificar liga para
   alguém, e a justificativa morre numa conversa de WhatsApp que ninguém
   acha depois — inclusive na hora de decidir aprovação.

   Aceitar a justificativa NÃO vira presença, e isso está escrito na tela.
   A falta continua registrada, só passa a ter motivo reconhecido.
   Transformar em presença seria falsificar a chamada, e o documento tem
   que continuar dizendo o que aconteceu.
   ============================================================ */

export type StatusDaJustificativa = 'pendente' | 'aceita' | 'recusada' | null

export default function JustificarFalta({
  presencaId,
  justificativa,
  status,
  resposta,
}: {
  presencaId: string
  justificativa: string | null
  status: StatusDaJustificativa
  resposta: string | null
}) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState(justificativa ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await justificarFalta(presencaId, texto)
        setAberto(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não consegui enviar.')
      }
    })
  }

  if (status === 'aceita' || status === 'recusada') {
    const aceita = status === 'aceita'
    return (
      <div
        className={`mt-2 rounded-lg px-3 py-2 text-[12.5px] ring-1 ${
          aceita
            ? 'bg-brand-50/70 text-brand-900 ring-brand-200'
            : 'bg-gray-50 text-gray-600 ring-gray-200'
        }`}
      >
        <p className="flex items-center gap-1.5 font-semibold">
          {aceita ? (
            <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
          )}
          {aceita ? 'Justificativa aceita pelo professor' : 'Justificativa não aceita'}
        </p>
        {justificativa && <p className="mt-1 italic opacity-80">“{justificativa}”</p>}
        {resposta && <p className="mt-1 font-medium">Professor: {resposta}</p>}
        {aceita && (
          <p className="mt-1 text-[11.5px] opacity-70">
            A falta continua registrada — o que muda é que o motivo está reconhecido.
          </p>
        )}
      </div>
    )
  }

  if (status === 'pendente') {
    return (
      <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900 ring-1 ring-amber-200">
        <p className="flex items-center gap-1.5 font-semibold">
          <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
          Justificativa enviada — aguardando o professor
        </p>
        {justificativa && <p className="mt-1 italic opacity-80">“{justificativa}”</p>}
      </div>
    )
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
      >
        <MessageSquareWarning className="h-3.5 w-3.5" strokeWidth={2.2} />
        Justificar esta falta
      </button>
    )
  }

  return (
    <form onSubmit={enviar} className="mt-2 space-y-2">
      <textarea
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ex: Estive internado neste dia. Posso levar o atestado no próximo encontro."
        className={`${CAMPO} resize-y text-[13px] leading-relaxed`}
      />
      {error && <Alerta>{error}</Alerta>}
      <div className="flex gap-2">
        <Botao type="submit" tamanho="sm" icone="Send" disabled={isPending}>
          {isPending ? 'Enviando...' : 'Enviar'}
        </Botao>
        <Botao type="button" tamanho="sm" variante="fantasma" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
    </form>
  )
}
