'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Megaphone, Send, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Alerta } from '@/components/ui'

export interface Mensagem {
  id: string
  turma_id: string
  autor_id: string
  autor_nome: string
  autor_papel: string
  texto: string
  aviso: boolean
  created_at: string
}

const PAPEL_COR: Record<string, string> = {
  professor: 'text-violet-700',
  admin: 'text-brand-700',
  aluno: 'text-gray-900',
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function dia(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const ontem = new Date(hoje)
  ontem.setDate(hoje.getDate() - 1)
  const mesmoDia = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  if (mesmoDia(d, hoje)) return 'Hoje'
  if (mesmoDia(d, ontem)) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * A conversa de uma turma.
 *
 * COMO O TEMPO REAL FUNCIONA
 * A tela assina o canal da turma no banco: toda mensagem nova chega
 * empurrada pelo servidor, sem recarregar nada — o mesmo modelo do
 * Discord. A entrega respeita as permissões: quem não é da turma não
 * recebe nem vê.
 *
 * A própria mensagem enviada também chega por esse canal. Para a tela não
 * parecer lenta, ela aparece na hora do envio ("otimista") e é reconciliada
 * pelo id quando o servidor confirma — sem duplicar.
 *
 * O AVISO
 * O professor pode enviar como "aviso para a turma": a mensagem ganha
 * destaque visual e o banco gera uma notificação para cada aluno. Essa
 * regra mora num gatilho do banco, não aqui — vale por qualquer caminho.
 */
export default function ChatDaTurma({
  turmaId,
  userId,
  userName,
  userPapel,
  podeAvisar,
}: {
  turmaId: string
  userId: string
  userName: string
  userPapel: string
  podeAvisar: boolean
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [texto, setTexto] = useState('')
  const [comoAviso, setComoAviso] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())

  const rolarParaOFim = useCallback((suave = true) => {
    fimRef.current?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'end' })
  }, [])

  // Carrega o histórico e assina as novidades
  useEffect(() => {
    const supabase = supabaseRef.current
    let ativo = true

    supabase
      .from('mensagens')
      .select('*')
      .eq('turma_id', turmaId)
      .order('created_at', { ascending: false })
      .limit(80)
      .then(({ data, error: e }) => {
        if (!ativo) return
        if (e) setError(`Não consegui carregar a conversa: ${e.message}`)
        setMensagens((data ?? []).reverse() as Mensagem[])
        setCarregando(false)
        setTimeout(() => rolarParaOFim(false), 60)
      })

    const canal = supabase
      .channel(`turma-${turmaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `turma_id=eq.${turmaId}` },
        (payload) => {
          const nova = payload.new as Mensagem
          setMensagens((atual) =>
            // Reconciliação: se a otimista já está na tela, o eco do servidor
            // a substitui em vez de duplicar.
            atual.some((m) => m.id === nova.id) ? atual : [...atual, nova]
          )
          setTimeout(() => rolarParaOFim(), 60)
        }
      )
      .subscribe()

    return () => {
      ativo = false
      supabase.removeChannel(canal)
    }
  }, [turmaId, rolarParaOFim])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const corpo = texto.trim()
    if (!corpo || enviando) return
    setError(null)
    setEnviando(true)

    const otimista: Mensagem = {
      id: crypto.randomUUID(),
      turma_id: turmaId,
      autor_id: userId,
      autor_nome: userName,
      autor_papel: userPapel,
      texto: corpo,
      aviso: comoAviso,
      created_at: new Date().toISOString(),
    }

    setMensagens((m) => [...m, otimista])
    setTexto('')
    setComoAviso(false)
    setTimeout(() => rolarParaOFim(), 30)

    const { error: e2 } = await supabaseRef.current.from('mensagens').insert({
      id: otimista.id,
      turma_id: turmaId,
      autor_id: userId,
      autor_nome: userName,
      autor_papel: userPapel,
      texto: corpo,
      aviso: otimista.aviso,
    })

    if (e2) {
      // Reverte a otimista e devolve o texto para a caixa — nada se perde.
      setMensagens((m) => m.filter((x) => x.id !== otimista.id))
      setTexto(corpo)
      setError(`A mensagem não foi enviada: ${e2.message}`)
    }
    setEnviando(false)
  }

  let ultimoDia = ''

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---------- Mensagens ---------- */}
      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {carregando && (
          <div className="flex justify-center py-10 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
          </div>
        )}

        {!carregando && mensagens.length === 0 && (
          <p className="py-10 text-center text-[13px] text-gray-400">
            Nenhuma mensagem ainda. Comece a conversa!
          </p>
        )}

        {mensagens.map((m) => {
          const d = dia(m.created_at)
          const mostraDia = d !== ultimoDia
          ultimoDia = d
          const minha = m.autor_id === userId

          return (
            <div key={m.id}>
              {mostraDia && (
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-gray-200" />
                  <span className="text-[11px] font-semibold text-gray-400">{d}</span>
                  <span className="h-px flex-1 bg-gray-200" />
                </div>
              )}

              {m.aviso ? (
                <div className="my-2 rounded-xl bg-amber-50 p-3.5 ring-1 ring-amber-200">
                  <p className="mb-1 flex items-center gap-2 text-[12px] font-bold text-amber-800">
                    <Megaphone className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Aviso de {m.autor_nome} · {hora(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-amber-950">
                    {m.texto}
                  </p>
                </div>
              ) : (
                <div className={`flex ${minha ? 'justify-end' : 'justify-start'} py-0.5`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                      minha
                        ? 'rounded-br-md bg-brand-700 text-white'
                        : 'rounded-bl-md bg-gray-100 text-gray-900'
                    }`}
                  >
                    {!minha && (
                      <p className={`text-[11.5px] font-bold ${PAPEL_COR[m.autor_papel] ?? 'text-gray-900'}`}>
                        {m.autor_nome}
                        {m.autor_papel === 'professor' && ' · Professor'}
                        {m.autor_papel === 'admin' && ' · Administração'}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.texto}</p>
                    <p
                      className={`mt-0.5 text-right text-[10.5px] ${minha ? 'text-white/60' : 'text-gray-400'}`}
                    >
                      {hora(m.created_at)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div ref={fimRef} />
      </div>

      {/* ---------- Caixa de envio ---------- */}
      <div className="border-t border-gray-100 p-3">
        {error && (
          <div className="mb-2">
            <Alerta>{error}</Alerta>
          </div>
        )}

        {comoAviso && (
          <p className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200">
            <Megaphone className="h-3.5 w-3.5" strokeWidth={2.2} />
            Esta mensagem sai como AVISO: destacada na conversa e notificada a cada aluno.
          </p>
        )}

        <form onSubmit={enviar} className="flex items-end gap-2">
          {podeAvisar && (
            <button
              type="button"
              onClick={() => setComoAviso((v) => !v)}
              aria-pressed={comoAviso}
              title="Enviar como aviso para a turma"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                comoAviso
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-600'
              }`}
            >
              <Megaphone className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          )}

          <textarea
            rows={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar(e)
              }
            }}
            placeholder={comoAviso ? 'Escreva o aviso para a turma...' : 'Escreva uma mensagem...'}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-2.5 text-[14px] leading-snug transition-all placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
          />

          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            aria-label="Enviar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:opacity-40"
          >
            <Send className="h-[17px] w-[17px]" strokeWidth={2.1} />
          </button>
        </form>
      </div>
    </div>
  )
}
