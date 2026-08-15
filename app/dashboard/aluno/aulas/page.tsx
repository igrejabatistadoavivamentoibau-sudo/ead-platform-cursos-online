import Link from 'next/link'
import { ArrowLeft, Video, CheckCircle2, Clock, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import VideoPlayer from '@/components/Aulas/VideoPlayer'

export default async function AulasDoAlunoPage({
  searchParams,
}: {
  searchParams: Promise<{ aula?: string }>
}) {
  const { aula: aulaSelecionada } = await searchParams
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: matriculas } = await supabase
    .from('turma_alunos')
    .select('turma_id, turmas(id, nome, status)')
    .eq('aluno_id', sessao.id)

  const turmas = (matriculas ?? []).map((m) => {
    const t = m.turmas as unknown as { id?: string; nome?: string; status?: string } | null
    return { id: t?.id as string, nome: t?.nome as string, status: t?.status as string }
  })

  const turmaAtiva = turmas.find((t) => t.status === 'em_andamento') ?? turmas[0]

  if (!turmaAtiva) {
    return (
      <div className="p-5 sm:p-8">
        <div className="card-alive p-12 text-center max-w-lg mx-auto">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <Video className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="text-gray-700 font-medium">
            Você ainda não está matriculado em nenhuma turma.
          </p>
          <p className="text-sm text-gray-500 mt-1">Fale com a liderança da sua célula.</p>
        </div>
      </div>
    )
  }

  const { data: aulas } = await supabase
    .from('aulas')
    .select('id, numero, titulo, descricao, video_url, duracao_minutos')
    .eq('turma_id', turmaAtiva.id)
    .eq('publicada', true)
    .order('numero', { ascending: true })

  const { data: progressos } = await supabase
    .from('aula_progresso')
    .select('aula_id, concluida, percentual')
    .eq('aluno_id', sessao.id)

  const progressoPorAula = new Map(
    (progressos ?? []).map((p) => [
      p.aula_id,
      { concluida: p.concluida as boolean, percentual: Number(p.percentual) },
    ])
  )

  const lista = aulas ?? []
  const atual = lista.find((a) => a.id === aulaSelecionada) ?? lista[0]
  const totalConcluidas = lista.filter((a) => progressoPorAula.get(a.id)?.concluida).length
  const progressoGeral = lista.length > 0 ? Math.round((totalConcluidas / lista.length) * 100) : 0

  if (lista.length === 0) {
    return (
      <div className="p-5 sm:p-8">
        <Link
          href="/dashboard/aluno"
          className="group inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={2.25} />
          Voltar
        </Link>
        <div className="card-alive p-12 text-center max-w-lg mx-auto">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <Video className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="text-gray-700 font-medium">Nenhuma aula publicada ainda.</p>
          <p className="text-sm text-gray-500 mt-1">
            Assim que o professor publicar a primeira aula, ela aparece aqui.
          </p>
        </div>
      </div>
    )
  }

  const progressoAtual = progressoPorAula.get(atual.id)

  return (
    <div className="p-5 sm:p-8">
      <Link
        href="/dashboard/aluno"
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700 transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={2.25} />
        Voltar ao início
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 mb-7 animate-float-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Vídeo aulas</h1>
          <p className="text-gray-500 mt-1.5">{turmaAtiva.nome}</p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/60 ring-1 ring-brand-200 px-4 py-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-600 shadow-soft">
            <Trophy className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-bold text-brand-800 tabular-nums">
              {totalConcluidas} de {lista.length} aulas
            </p>
            <p className="text-xs text-brand-700/80">{progressoGeral}% do curso concluído</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* ===== Player ===== */}
        <div>
          <VideoPlayer
            key={atual.id}
            aulaId={atual.id}
            videoUrl={atual.video_url}
            concluidaInicial={progressoAtual?.concluida ?? false}
            percentualInicial={progressoAtual?.percentual ?? 0}
          />

          <div className="mt-5">
            <span className="text-xs font-bold text-brand-600 uppercase tracking-widest">
              Aula {atual.numero}
            </span>
            <h2 className="text-xl font-bold text-gray-900 mt-1.5">{atual.titulo}</h2>
            {atual.descricao && (
              <p className="text-gray-500 mt-2 leading-relaxed">{atual.descricao}</p>
            )}
          </div>
        </div>

        {/* ===== Lista de aulas ===== */}
        <div>
          <h2 className="font-bold text-gray-900 mb-3">Conteúdo do curso</h2>
          <div className="card-alive divide-y divide-gray-100 overflow-hidden">
            {lista.map((a) => {
              const p = progressoPorAula.get(a.id)
              const ativa = a.id === atual.id
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/aluno/aulas?aula=${a.id}`}
                  scroll={false}
                  className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                    ativa ? 'bg-brand-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                      p?.concluida
                        ? 'bg-brand-600 text-white'
                        : ativa
                          ? 'bg-white text-brand-700 ring-1 ring-brand-200'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {p?.concluida ? (
                      <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2.25} />
                    ) : (
                      a.numero
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium truncate ${
                        ativa ? 'text-brand-800' : 'text-gray-800'
                      }`}
                    >
                      {a.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {a.duracao_minutos && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                          <Clock className="h-3 w-3" strokeWidth={2} />
                          {a.duracao_minutos} min
                        </span>
                      )}
                      {p?.concluida ? (
                        <span className="text-[11px] font-semibold text-brand-700">Concluída</span>
                      ) : p && p.percentual > 0 ? (
                        <span className="text-[11px] text-gray-500 tabular-nums">
                          {Math.round(p.percentual)}% assistido
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
