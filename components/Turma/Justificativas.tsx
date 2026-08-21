'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquareWarning, Check, X, CheckCheck } from 'lucide-react'
import { responderJustificativa } from '@/app/dashboard/professor/actions'
import { Botao, Card, Alerta, Selo, CAMPO } from '@/components/ui'

export interface JustificativaPendente {
  presencaId: string
  alunoNome: string
  encontroTitulo: string
  data: string
  texto: string
  status: 'pendente' | 'aceita' | 'recusada'
  resposta: string | null
}

function formatarData(d: string) {
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

/* ============================================================
   AS JUSTIFICATIVAS, NUM LUGAR SÓ

   Poderiam morar dentro de cada encontro, junto do nome do aluno na
   lista de chamada. Ficariam espalhadas por quinze encontros, e o
   professor só encontraria a justificativa se por acaso abrisse o
   encontro certo — ou seja, quase nunca.

   Aqui é o contrário: tudo o que está esperando resposta aparece junto,
   com a data do encontro ao lado do nome. O professor responde a fila e
   acabou.

   ACEITAR NÃO VIRA PRESENÇA, e o texto diz isso. A falta continua
   registrada; o que muda é que o motivo passa a estar reconhecido.
   Transformar em presença seria falsificar a chamada, e a lista assinada
   tem que continuar dizendo o que aconteceu naquele dia.
   ============================================================ */

export default function Justificativas({
  turmaId,
  justificativas,
}: {
  turmaId: string
  justificativas: JustificativaPendente[]
}) {
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [verRespondidas, setVerRespondidas] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const acao = (fn: () => Promise<unknown>) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar.')
      }
    })
  }

  const pendentes = justificativas.filter((j) => j.status === 'pendente')
  const respondidas = justificativas.filter((j) => j.status !== 'pendente')

  if (!justificativas.length) return null

  return (
    <div className="mb-5 space-y-3">
      {error && <Alerta>{error}</Alerta>}

      {pendentes.length > 0 && (
        <Card padding={false}>
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
              <MessageSquareWarning className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div>
              <h2 className="font-display text-[15px] font-bold text-gray-900">
                Justificativas de falta
              </h2>
              <p className="text-[12px] text-gray-500">
                <span className="font-semibold tabular-nums text-gray-700">{pendentes.length}</span>{' '}
                {pendentes.length === 1 ? 'aluno esperando' : 'alunos esperando'} sua resposta ·
                aceitar não vira presença
              </p>
            </div>
          </div>

          <ul className="divide-y divide-gray-100">
            {pendentes.map((j) => (
              <li key={j.presencaId} className="p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-gray-800">{j.alunoNome}</p>
                  <span className="text-[12.5px] text-gray-500">
                    · {j.encontroTitulo} · {formatarData(j.data)}
                  </span>
                </div>
                <p className="mb-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-[13px] leading-relaxed text-gray-700">
                  {j.texto}
                </p>

                <input
                  type="text"
                  value={respostas[j.presencaId] ?? ''}
                  onChange={(e) =>
                    setRespostas((r) => ({ ...r, [j.presencaId]: e.target.value }))
                  }
                  placeholder="Resposta para o aluno (opcional)"
                  className={CAMPO}
                />

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Botao
                    tamanho="sm"
                    icone="Check"
                    disabled={isPending}
                    onClick={() =>
                      acao(() =>
                        responderJustificativa(j.presencaId, turmaId, {
                          status: 'aceita',
                          resposta: respostas[j.presencaId],
                        })
                      )
                    }
                  >
                    Aceitar
                  </Botao>
                  <Botao
                    variante="fantasma"
                    tamanho="sm"
                    disabled={isPending}
                    onClick={() =>
                      acao(() =>
                        responderJustificativa(j.presencaId, turmaId, {
                          status: 'recusada',
                          resposta: respostas[j.presencaId],
                        })
                      )
                    }
                  >
                    Não aceitar
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {respondidas.length > 0 && (
        <Card padding={false}>
          <button
            type="button"
            onClick={() => setVerRespondidas(!verRespondidas)}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <CheckCheck className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <span className="text-[13.5px] font-semibold text-gray-700">
              {respondidas.length}{' '}
              {respondidas.length === 1
                ? 'justificativa já respondida'
                : 'justificativas já respondidas'}
            </span>
          </button>

          {verRespondidas && (
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {respondidas.map((j) => (
                <li key={j.presencaId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                  {j.status === 'aceita' ? (
                    <Selo tom="verde" icone="Check">
                      Aceita
                    </Selo>
                  ) : (
                    <Selo tom="neutro" icone="X">
                      Não aceita
                    </Selo>
                  )}
                  <span className="text-[13px] font-medium text-gray-800">{j.alunoNome}</span>
                  <span className="text-[12.5px] text-gray-500">{formatarData(j.data)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
