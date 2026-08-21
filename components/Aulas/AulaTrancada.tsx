'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Clock, Send, CheckCircle2, XCircle } from 'lucide-react'
import { pedirLiberacaoDeAula } from '@/app/dashboard/aluno/actions'
import { momentoPorExtenso } from '@/lib/janelaDaAtividade'
import { Botao, Alerta, CAMPO } from '@/components/ui'

/* ============================================================
   A AULA FECHADA

   POR QUE ISTO NÃO É SÓ UM CADEADO
   Fechar a aula sem dar caminho nenhum transforma um atraso em perda
   definitiva. E a maioria dos atrasos numa escola de igreja tem motivo:
   plantão, doença, viagem a trabalho, um filho no hospital. Então a porta
   fechada vem com uma campainha: o aluno escreve o motivo, o professor lê
   e decide.

   O texto diz exatamente por que está fechada e até quando estava aberta.
   Um cadeado mudo faria a pessoa achar que a plataforma quebrou — e a
   primeira coisa que ela faria seria ligar para alguém perguntando.
   ============================================================ */

export type SituacaoDoPedido = 'nenhum' | 'pendente' | 'liberada' | 'recusada'

export default function AulaTrancada({
  turmaId,
  aulaId,
  tituloAula,
  motivo,
  abreEm,
  venceEm,
  pedido,
  respostaDoProfessor,
}: {
  turmaId: string | null
  aulaId: string
  tituloAula: string
  motivo: 'ainda_nao_abriu' | 'encerrada'
  abreEm: string | null
  venceEm: string | null
  pedido: SituacaoDoPedido
  respostaDoProfessor: string | null
}) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!turmaId) {
      setError('Não consegui identificar sua turma nesta aula. Fale com o professor.')
      return
    }
    startTransition(async () => {
      try {
        await pedirLiberacaoDeAula(turmaId, aulaId, texto)
        setEnviado(true)
        setAberto(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não consegui enviar o pedido.')
      }
    })
  }

  const aindaNaoAbriu = motivo === 'ainda_nao_abriu'

  return (
    <div className="overflow-hidden rounded-2xl bg-gray-900 ring-1 ring-black/10">
      {/* O lugar do vídeo continua sendo o lugar do vídeo. Trocar por um
          card branco no meio da página faria a tela parecer quebrada; a
          moldura escura no mesmo formato diz "é aqui, só não agora". */}
      <div className="flex aspect-video flex-col items-center justify-center px-6 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white/80">
          {aindaNaoAbriu ? (
            <Clock className="h-6 w-6" strokeWidth={1.8} />
          ) : (
            <Lock className="h-6 w-6" strokeWidth={1.8} />
          )}
        </span>
        <p className="font-display text-[17px] font-bold text-white">
          {aindaNaoAbriu ? 'Esta aula ainda não abriu' : 'O prazo desta aula encerrou'}
        </p>
        <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-white/60">
          {aindaNaoAbriu
            ? abreEm
              ? `Ela libera em ${momentoPorExtenso(abreEm)}.`
              : 'O professor ainda não liberou esta aula para a sua turma.'
            : venceEm
              ? `Ficou disponível até ${momentoPorExtenso(venceEm)}.`
              : 'O professor fechou esta aula para a sua turma.'}
        </p>
      </div>

      {/* A campainha só existe se a porta já esteve aberta. Pedir liberação
          de uma aula que ainda vai abrir não faz sentido — é só esperar. */}
      {!aindaNaoAbriu && (
        <div className="border-t border-white/10 bg-gray-900/60 p-4">
          {pedido === 'pendente' || enviado ? (
            <div className="flex items-start gap-2.5 text-[13px] text-white/70">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" strokeWidth={2.2} />
              <p>
                <span className="font-semibold text-white">Seu pedido foi enviado.</span> O professor
                vai responder — você recebe um aviso aqui na plataforma.
              </p>
            </div>
          ) : pedido === 'liberada' ? (
            <div className="flex items-start gap-2.5 text-[13px] text-white/70">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" strokeWidth={2.2} />
              <p>
                <span className="font-semibold text-white">O professor liberou esta aula</span>, mas
                a liberação já venceu. Fale com ele.
              </p>
            </div>
          ) : pedido === 'recusada' ? (
            <div className="flex items-start gap-2.5 text-[13px] text-white/70">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" strokeWidth={2.2} />
              <div>
                <p className="font-semibold text-white">O professor não liberou esta aula.</p>
                {respostaDoProfessor && (
                  <p className="mt-1 italic text-white/60">“{respostaDoProfessor}”</p>
                )}
              </div>
            </div>
          ) : aberto ? (
            <form onSubmit={enviar} className="space-y-2.5">
              <label className="block text-[12.5px] font-semibold text-white/80">
                Conte ao professor por que você não conseguiu assistir no prazo
              </label>
              <textarea
                rows={3}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Ex: Estive internado de 10 a 15 e não consegui acompanhar as aulas da semana."
                className={`${CAMPO} resize-y bg-white/95 leading-relaxed`}
              />
              {error && <Alerta>{error}</Alerta>}
              <div className="flex gap-2">
                <Botao type="submit" icone="Send" disabled={isPending}>
                  {isPending ? 'Enviando...' : 'Enviar pedido'}
                </Botao>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="rounded-xl px-3 text-[13px] font-semibold text-white/60 hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-white/60">
                Perdeu o prazo por um motivo? Peça liberação ao professor.
              </p>
              <button
                type="button"
                onClick={() => setAberto(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-[13px] font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={2.2} />
                Pedir liberação
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
