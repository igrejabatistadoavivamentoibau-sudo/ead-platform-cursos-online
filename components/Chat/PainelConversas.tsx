import Link from 'next/link'
import { MessagesSquare, GraduationCap } from 'lucide-react'
import ChatDaTurma from '@/components/Chat/ChatDaTurma'
import { EstadoVazio } from '@/components/ui'

export interface TurmaDoChat {
  id: string
  nome: string
  curso: string | null
}

/**
 * Lista de turmas à esquerda, conversa aberta à direita — o esqueleto do
 * Discord. A turma escolhida vai na própria URL (?turma=), então dá para
 * mandar o link de uma conversa específica e o botão voltar funciona.
 */
export default function PainelConversas({
  turmas,
  turmaAberta,
  basePath,
  userId,
  userName,
  userPapel,
  podeAvisar,
}: {
  turmas: TurmaDoChat[]
  turmaAberta: string | undefined
  basePath: string
  userId: string
  userName: string
  userPapel: string
  podeAvisar: boolean
}) {
  const atual = turmas.find((t) => t.id === turmaAberta) ?? turmas[0]

  if (turmas.length === 0) {
    return (
      <EstadoVazio
        icone="MessagesSquare"
        titulo="Nenhuma conversa disponível"
        descricao="Quando você fizer parte de uma turma, a conversa dela aparece aqui."
      />
    )
  }

  return (
    <div className="grid h-[calc(100vh-180px)] min-h-[420px] overflow-hidden rounded-xl bg-white ring-1 ring-brand-950/[0.07] md:grid-cols-[250px_1fr]">
      {/* ---------- Turmas ---------- */}
      <aside className="hidden overflow-y-auto border-r border-gray-100 p-2.5 md:block">
        <p className="px-2 pb-2 pt-1 text-[10.5px] font-bold uppercase tracking-[0.13em] text-gray-400">
          Suas turmas
        </p>
        <div className="space-y-0.5">
          {turmas.map((t) => {
            const ativa = t.id === atual?.id
            return (
              <Link
                key={t.id}
                href={`${basePath}?turma=${t.id}`}
                className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                  ativa ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-gray-50'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    ativa ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <GraduationCap className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[13px] ${ativa ? 'font-bold text-brand-900' : 'font-medium text-gray-800'}`}
                  >
                    {t.nome}
                  </span>
                  {t.curso && (
                    <span className="block truncate text-[11px] text-gray-400">{t.curso}</span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      </aside>

      {/* ---------- Conversa ---------- */}
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
          <MessagesSquare className="h-4 w-4 text-brand-600" strokeWidth={2} />
          <div className="min-w-0">
            <p className="truncate font-display text-[14px] font-bold text-gray-900">
              {atual.nome}
            </p>
            {atual.curso && <p className="truncate text-[11.5px] text-gray-400">{atual.curso}</p>}
          </div>

          {/* No celular a lista vira seletor simples por links */}
          {turmas.length > 1 && (
            <div className="ml-auto flex gap-1 md:hidden">
              {turmas.slice(0, 4).map((t) => (
                <Link
                  key={t.id}
                  href={`${basePath}?turma=${t.id}`}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                    t.id === atual.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t.nome.slice(0, 10)}
                </Link>
              ))}
            </div>
          )}
        </div>

        <ChatDaTurma
          key={atual.id}
          turmaId={atual.id}
          userId={userId}
          userName={userName}
          userPapel={userPapel}
          podeAvisar={podeAvisar}
        />
      </div>
    </div>
  )
}
