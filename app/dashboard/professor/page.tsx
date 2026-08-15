import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'
import {
  Presentation,
  Users2,
  PlayCircle,
  GraduationCap,
  ClipboardList,
  ClipboardCheck,
  FileText,
  Video,
  TrendingUp,
  BookOpenText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { Selo } from '@/components/ui'
import { MODALIDADE, type ModalidadeCurso } from '@/lib/cursos'

/** O join do Supabase vem sem tipo forte; lemos a modalidade em um lugar só. */
function modalidadeDaTurma(turma: { cursos?: unknown }): ModalidadeCurso {
  const c = turma.cursos as { modalidade?: ModalidadeCurso } | null
  return c?.modalidade ?? 'ead'
}

/** Atalho compacto do cartão de turma — mesma forma para todos. */
function AtalhoTurma({
  href,
  icone: Icone,
  children,
  principal = false,
}: {
  href: string
  icone: ComponentType<{ className?: string; strokeWidth?: number }>
  children: ReactNode
  principal?: boolean
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-[0.98] ${
        principal
          ? 'bg-brand-700 text-white hover:bg-brand-800'
          : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-brand-800 hover:ring-brand-300'
      }`}
    >
      <Icone className="h-3.5 w-3.5" strokeWidth={2.1} />
      {children}
    </Link>
  )
}

const STATUS_LABEL: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  encerrada: 'Encerrada',
}

const STATUS_STYLE: Record<string, string> = {
  planejada: 'bg-amber-50 text-amber-700 ring-amber-200',
  em_andamento: 'bg-brand-50 text-brand-700 ring-brand-200',
  encerrada: 'bg-gray-100 text-gray-500 ring-gray-200',
}

export default async function ProfessorHome() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  // Admin enxerga todas as turmas; professor, apenas as suas.
  const consultaTurmas = supabase
    .from('turmas')
    .select('id, nome, descricao, status, curso_id, cursos(titulo, modalidade)')
    .order('created_at', { ascending: false })

  const { data: turmas } =
    sessao.role === 'admin'
      ? await consultaTurmas
      : await consultaTurmas.eq('professor_id', sessao.id)

  const ids = (turmas ?? []).map((t) => t.id)

  const [{ data: matriculas }, { data: encontros }, { data: aulas }] = await Promise.all([
    ids.length
      ? supabase.from('turma_alunos').select('turma_id').in('turma_id', ids)
      : Promise.resolve({ data: [] as { turma_id: string }[] }),
    ids.length
      ? supabase.from('encontros').select('turma_id').in('turma_id', ids)
      : Promise.resolve({ data: [] as { turma_id: string }[] }),
    (() => {
      // Aulas agora pertencem ao curso, então contamos por curso e depois
      // mapeamos de volta para cada turma.
      const cursoIds = [...new Set((turmas ?? []).map((t) => t.curso_id).filter(Boolean))]
      return cursoIds.length
        ? supabase.from('aulas').select('curso_id').in('curso_id', cursoIds as string[])
        : Promise.resolve({ data: [] as { curso_id: string }[] })
    })(),
  ])

  const contar = (lista: { turma_id: string }[] | null) => {
    const m = new Map<string, number>()
    for (const item of lista ?? []) m.set(item.turma_id, (m.get(item.turma_id) ?? 0) + 1)
    return m
  }

  const alunosPorTurma = contar(matriculas)
  const encontrosPorTurma = contar(encontros)

  const aulasPorCurso = new Map<string, number>()
  for (const a of (aulas ?? []) as { curso_id: string }[]) {
    aulasPorCurso.set(a.curso_id, (aulasPorCurso.get(a.curso_id) ?? 0) + 1)
  }
  const aulasDaTurma = (cursoId: string | null) =>
    cursoId ? (aulasPorCurso.get(cursoId) ?? 0) : 0

  const emAndamento = (turmas ?? []).filter((t) => t.status === 'em_andamento').length
  const totalAlunos = (turmas ?? []).reduce((s, t) => s + (alunosPorTurma.get(t.id) ?? 0), 0)

  const stats = [
    { icon: PlayCircle, value: emAndamento, label: 'Turmas em andamento', destaque: true },
    { icon: GraduationCap, value: turmas?.length ?? 0, label: 'Turmas ao todo' },
    { icon: Users2, value: totalAlunos, label: 'Alunos ao todo' },
  ]

  return (
    <div className="p-5 sm:p-8">
      <div className="animate-float-in">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-700 bg-purple-50 ring-1 ring-purple-200 px-3 py-1.5 rounded-full uppercase tracking-wider mb-3">
          <Presentation className="h-3.5 w-3.5" strokeWidth={2.5} />
          Portal do Professor
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Bem-vindo, {sessao.name.split(' ')[0]}
        </h1>
        <p className="text-gray-500 mt-1.5">
          {sessao.role === 'admin'
            ? 'Você está vendo todas as turmas da escola, como administrador.'
            : 'Acompanhe as turmas sob sua responsabilidade.'}
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="card-alive card-sheen group p-5 overflow-hidden animate-float-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="icon-pop flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 mb-4 group-hover:from-brand-600 group-hover:to-brand-500 group-hover:text-white group-hover:shadow-glow">
              <stat.icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="text-3xl font-extrabold text-gray-900 tabular-nums">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
            {stat.destaque && stat.value > 0 && (
              <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-soft-pulse" />
                ativo agora
              </span>
            )}
          </div>
        ))}
      </div>

      <h2 className="font-bold text-gray-900 mt-10 mb-4">Suas turmas</h2>

      {turmas && turmas.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {turmas.map((turma, i) => (
            <div
              key={turma.id}
              className="card-alive card-sheen group p-6 overflow-hidden animate-float-in"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />

              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-bold text-gray-900 group-hover:text-brand-800 transition-colors">
                  {turma.nome}
                </h3>
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${STATUS_STYLE[turma.status]}`}
                >
                  {turma.status === 'em_andamento' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-soft-pulse" />
                  )}
                  {STATUS_LABEL[turma.status]}
                </span>
              </div>

              {(() => {
                const c = turma.cursos as unknown as {
                  titulo?: string
                  modalidade?: ModalidadeCurso
                } | null
                if (!c?.titulo) {
                  return (
                    <p className="text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2.5 py-1 inline-block mb-3">
                      Sem curso definido
                    </p>
                  )
                }
                const m = MODALIDADE[c.modalidade ?? 'ead']
                return (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 ring-1 ring-brand-200 rounded-full px-2.5 py-1">
                      <BookOpenText className="h-3.5 w-3.5" strokeWidth={2} />
                      {c.titulo}
                    </span>
                    <Selo tom={m.tom} icone={m.icone}>
                      {m.label}
                    </Selo>
                  </div>
                )
              })()}
              {turma.descricao && (
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{turma.descricao}</p>
              )}

              <div className="flex items-center gap-4 pt-3 border-t border-gray-100 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1.5">
                  <Users2 className="h-4 w-4 text-brand-600" strokeWidth={2} />
                  <span className="font-semibold text-gray-700 tabular-nums">
                    {alunosPorTurma.get(turma.id) ?? 0}
                  </span>
                  alunos
                </span>
                <span className="flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4 text-brand-600" strokeWidth={2} />
                  <span className="font-semibold text-gray-700 tabular-nums">
                    {encontrosPorTurma.get(turma.id) ?? 0}
                  </span>
                  encontros
                </span>
                <span className="flex items-center gap-1.5">
                  <Video className="h-4 w-4 text-brand-600" strokeWidth={2} />
                  <span className="font-semibold text-gray-700 tabular-nums">
                    {aulasDaTurma(turma.curso_id)}
                  </span>
                  aulas
                </span>
              </div>

              {/* Atalhos para as áreas da turma. Cada um respeita a permissão
                  que o admin definiu no painel de controle. */}
              <div className="flex flex-wrap items-center gap-1.5">
                {sessao.permissoes.ver_alunos && (
                  <AtalhoTurma
                    href={`/dashboard/professor/turmas/${turma.id}/avanco`}
                    icone={TrendingUp}
                    principal
                  >
                    Avanço
                  </AtalhoTurma>
                )}
                {sessao.permissoes.fazer_chamada && (
                  <AtalhoTurma
                    href={`/dashboard/professor/turmas/${turma.id}/chamada`}
                    icone={ClipboardCheck}
                  >
                    {modalidadeDaTurma(turma) === 'presencial' ? 'Chamada' : 'Frequência'}
                  </AtalhoTurma>
                )}
                {sessao.permissoes.ver_alunos && (
                  <>
                    <AtalhoTurma
                      href={`/dashboard/professor/turmas/${turma.id}/notas`}
                      icone={GraduationCap}
                    >
                      Notas
                    </AtalhoTurma>
                    <AtalhoTurma
                      href={`/dashboard/professor/turmas/${turma.id}/atividades`}
                      icone={FileText}
                    >
                      Atividades
                    </AtalhoTurma>
                  </>
                )}
                {sessao.permissoes.gerenciar_aulas && turma.curso_id && (
                  <AtalhoTurma
                    href={`/dashboard/professor/cursos/${turma.curso_id}`}
                    icone={Video}
                  >
                    Vídeo aulas
                  </AtalhoTurma>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-alive p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <Presentation className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="text-gray-700 font-medium">Nenhuma turma atribuída a você ainda.</p>
          <p className="text-sm text-gray-500 mt-1">Fale com a administração.</p>
        </div>
      )}
    </div>
  )
}
