import Link from 'next/link'
import {
  GraduationCap,
  UserRound,
  ClipboardCheck,
  CalendarDays,
  PlayCircle,
  ArrowRight,
  Video,
  Trophy,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'

const STATUS_LABEL: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  encerrada: 'Encerrada',
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export default async function AlunoHome() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: matriculas } = await supabase
    .from('turma_alunos')
    .select('turma_id, turmas(id, nome, descricao, status, curso_id, users(name))')
    .eq('aluno_id', sessao.id)

  const turmas = (matriculas ?? []).map((m) => {
    const turma = m.turmas as unknown as {
      id?: string
      nome?: string
      descricao?: string
      status?: string
      curso_id?: string | null
      users?: { name?: string } | null
    } | null
    return {
      id: turma?.id as string,
      nome: turma?.nome as string,
      descricao: turma?.descricao as string | undefined,
      status: turma?.status as string,
      cursoId: turma?.curso_id ?? null,
      professorNome: turma?.users?.name as string | undefined,
    }
  })

  const turmaAtiva = turmas.find((t) => t.status === 'em_andamento') ?? turmas[0]

  const [{ data: presencas }, { data: aulas }, { data: progressos }] = await Promise.all([
    turmaAtiva
      ? supabase
          .from('presencas')
          .select('presente, encontros(data, titulo, turma_id)')
          .eq('aluno_id', sessao.id)
      : Promise.resolve({ data: null }),
    turmaAtiva?.cursoId
      ? supabase
          .from('aulas')
          .select('id')
          .eq('curso_id', turmaAtiva.cursoId)
          .eq('publicada', true)
      : Promise.resolve({ data: null }),
    supabase
      .from('aula_progresso')
      .select('aula_id, concluida')
      .eq('aluno_id', sessao.id)
      .eq('concluida', true),
  ])

  const presencasDaTurma = (presencas ?? [])
    .map((p) => ({
      presente: p.presente as boolean,
      encontro: p.encontros as unknown as {
        data?: string
        titulo?: string
        turma_id?: string
      } | null,
    }))
    .filter((p) => p.encontro?.turma_id === turmaAtiva?.id)

  const totalEncontros = presencasDaTurma.length
  const totalPresencas = presencasDaTurma.filter((p) => p.presente).length
  const frequencia = totalEncontros > 0 ? Math.round((totalPresencas / totalEncontros) * 100) : 0

  const idsAulas = new Set((aulas ?? []).map((a) => a.id))
  const totalAulas = idsAulas.size
  const aulasConcluidas = (progressos ?? []).filter((p) => idsAulas.has(p.aula_id)).length
  const progressoAulas = totalAulas > 0 ? Math.round((aulasConcluidas / totalAulas) * 100) : 0

  const ultimosEncontros = [...presencasDaTurma]
    .sort((a, b) => (b.encontro?.data ?? '').localeCompare(a.encontro?.data ?? ''))
    .slice(0, 5)

  return (
    <div className="p-5 sm:p-8">
      <div className="animate-float-in">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-700 bg-sky-50 ring-1 ring-sky-200 px-3 py-1.5 rounded-full uppercase tracking-wider mb-3">
          <GraduationCap className="h-3.5 w-3.5" strokeWidth={2.5} />
          Portal do Aluno
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Bem-vindo, {sessao.name.split(' ')[0]}
        </h1>
        <p className="text-gray-500 mt-1.5">
          Acompanhe suas aulas, sua turma e sua frequência na Escola de Líderes.
        </p>
      </div>

      {turmaAtiva ? (
        <>
          {/* Cartão da turma */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 p-6 sm:p-8 mt-8 shadow-glow animate-float-in">
            <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_85%,rgba(0,0,0,0.18),transparent_50%)]" />

            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-brand-100/80 text-sm font-medium mb-1">Sua turma</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">{turmaAtiva.nome}</h2>
                {turmaAtiva.descricao && (
                  <p className="text-brand-50/85 mt-2 text-[15px]">{turmaAtiva.descricao}</p>
                )}
              </div>
              <span className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25">
                {turmaAtiva.status === 'em_andamento' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-300 animate-soft-pulse" />
                )}
                {STATUS_LABEL[turmaAtiva.status] ?? turmaAtiva.status}
              </span>
            </div>

            <div className="relative grid sm:grid-cols-2 gap-6 mt-7">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-brand-100/90 font-medium">Aulas concluídas</span>
                  <span className="text-white font-bold tabular-nums">{progressoAulas}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-300 to-white animate-grow-bar"
                    style={{ width: `${progressoAulas}%` }}
                  />
                </div>
                <p className="text-brand-100/70 text-xs mt-2 tabular-nums">
                  {aulasConcluidas} de {totalAulas} aulas
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-brand-100/90 font-medium">Sua frequência</span>
                  <span className="text-white font-bold tabular-nums">{frequencia}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-200 to-white animate-grow-bar"
                    style={{ width: `${frequencia}%` }}
                  />
                </div>
                <p className="text-brand-100/70 text-xs mt-2 tabular-nums">
                  {totalPresencas} de {totalEncontros} encontros
                </p>
              </div>
            </div>
          </div>

          {/* Atalho para as aulas */}
          <Link
            href="/dashboard/aluno/cursos"
            className="group relative mt-6 flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-float hover:ring-brand-300"
          >
            <div className="flex items-center gap-4 min-w-0">
              <span className="icon-pop flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 group-hover:from-brand-600 group-hover:to-brand-500 group-hover:text-white group-hover:shadow-glow">
                <Video className="h-6 w-6" strokeWidth={1.85} />
              </span>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 group-hover:text-brand-800 transition-colors">
                  Meus cursos
                </h3>
                <p className="text-sm text-gray-500">
                  {totalAulas > 0
                    ? `${totalAulas} aula${totalAulas === 1 ? '' : 's'} disponível${totalAulas === 1 ? '' : 'eis'} na sua turma.`
                    : 'Ainda não há aulas publicadas na sua turma.'}
                </p>
              </div>
            </div>
            <ArrowRight
              className="h-5 w-5 shrink-0 text-brand-600 transition-transform duration-300 group-hover:translate-x-1"
              strokeWidth={2.25}
            />
          </Link>

          {/* Indicadores */}
          <div className="grid sm:grid-cols-3 gap-4 mt-6">
            {[
              { icon: UserRound, valor: turmaAtiva.professorNome ?? 'A definir', label: 'Professor responsável', pequeno: true },
              { icon: Trophy, valor: `${aulasConcluidas}/${totalAulas}`, label: 'Aulas concluídas' },
              { icon: ClipboardCheck, valor: `${totalPresencas}/${totalEncontros}`, label: 'Presenças registradas' },
            ].map((item, i) => (
              <div
                key={item.label}
                className="card-alive card-sheen group p-5 overflow-hidden animate-float-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="icon-pop flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 mb-4 group-hover:from-brand-600 group-hover:to-brand-500 group-hover:text-white group-hover:shadow-glow">
                  <item.icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div
                  className={`font-bold text-gray-900 ${item.pequeno ? 'text-lg leading-snug' : 'text-2xl tabular-nums'}`}
                >
                  {item.valor}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Histórico de encontros */}
          {ultimosEncontros.length > 0 && (
            <div className="mt-8">
              <h2 className="font-bold text-gray-900 mb-4">Últimos encontros</h2>
              <div className="card-alive divide-y divide-gray-100 overflow-hidden">
                {ultimosEncontros.map((p, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        p.presente ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-red-500'
                      }`}
                    >
                      <ClipboardCheck className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {p.encontro?.titulo || 'Encontro'}
                      </p>
                      <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3 w-3" strokeWidth={2} />
                        {p.encontro?.data ? formatarData(p.encontro.data) : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${
                        p.presente
                          ? 'bg-brand-50 text-brand-700 ring-brand-200'
                          : 'bg-red-50 text-red-600 ring-red-200'
                      }`}
                    >
                      {p.presente ? 'Presente' : 'Ausente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card-alive p-12 text-center mt-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <PlayCircle className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="text-gray-700 font-medium">
            Você ainda não está matriculado em nenhuma turma.
          </p>
          <p className="text-sm text-gray-500 mt-1">Fale com a liderança da sua célula.</p>
        </div>
      )}
    </div>
  )
}
