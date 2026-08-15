'use client'

import { useState, useTransition } from 'react'
import { PenLine, Check, MessageSquare } from 'lucide-react'
import { salvarResumo } from '@/app/dashboard/aluno/actions'
import { Botao, Alerta, Selo, CAMPO } from '@/components/ui'

/**
 * Campo em que o aluno escreve com as próprias palavras o que entendeu da
 * aula. Fica logo abaixo do vídeo, no momento em que o conteúdo está fresco.
 */
export default function ResumoAula({
  aulaId,
  textoInicial,
  feedback,
  somenteLeitura = false,
}: {
  aulaId: string
  textoInicial: string
  feedback: string | null
  somenteLeitura?: boolean
}) {
  const [texto, setTexto] = useState(textoInicial)
  const [salvo, setSalvo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const jaEnviado = textoInicial.trim().length > 0
  const mudou = texto.trim() !== textoInicial.trim()

  const salvar = () => {
    setError(null)
    setSalvo(false)
    startTransition(async () => {
      try {
        await salvarResumo(aulaId, texto)
        setSalvo(true)
        setTimeout(() => setSalvo(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar o resumo.')
      }
    })
  }

  return (
    <div className="mt-6 rounded-xl bg-white p-5 ring-1 ring-brand-950/[0.07]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-[15px] font-bold text-gray-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          Resumo da aula
        </h3>
        {jaEnviado && <Selo tom="verde" icone="Check">enviado</Selo>}
      </div>

      <p className="mb-3 text-[13px] leading-relaxed text-gray-500">
        Escreva com suas palavras o que você entendeu. Escrever depois de assistir é uma das
        formas mais eficazes de fixar o conteúdo — e seu professor consegue ler.
      </p>

      {somenteLeitura ? (
        <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800 ring-1 ring-amber-200">
          Em pré-visualização o resumo não é salvo.
        </p>
      ) : (
        <>
          <textarea
            rows={5}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={isPending}
            placeholder="O que mais marcou você nesta aula? Que ponto você quer levar para a prática?"
            className={`${CAMPO} resize-y leading-relaxed`}
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11.5px] text-gray-400 tabular-nums">
              {texto.trim().length} caracteres
            </span>

            <div className="flex items-center gap-3">
              {salvo && (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Resumo salvo
                </span>
              )}
              <Botao
                icone="Send"
                onClick={salvar}
                disabled={isPending || !mudou || texto.trim().length < 10}
              >
                {isPending ? 'Salvando...' : jaEnviado ? 'Atualizar resumo' : 'Enviar resumo'}
              </Botao>
            </div>
          </div>

          {error && (
            <div className="mt-3">
              <Alerta>{error}</Alerta>
            </div>
          )}
        </>
      )}

      {feedback && (
        <div className="mt-4 rounded-lg bg-brand-50/70 p-3.5 ring-1 ring-brand-200">
          <p className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-brand-800">
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.2} />
            Comentário do professor
          </p>
          <p className="text-[13px] leading-relaxed text-brand-900/90">{feedback}</p>
        </div>
      )}
    </div>
  )
}
