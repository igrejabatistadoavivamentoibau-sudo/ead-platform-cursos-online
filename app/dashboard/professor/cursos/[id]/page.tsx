import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, BookOpenText, Users2, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import AulasManager, { type AulaItem } from '@/components/Aulas/AulasManager'
import AulaAvulsaForm from '@/components/Aulas/AulaAvulsaForm'
import { MODALIDADE, type ModalidadeCurso } from '@/lib/cursos'
import { Selo } from '@/components/ui'

export default async function CursoProfessorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sessao = await exigirPermissao('gerenciar_aulas')
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id, titulo, subtitulo, modalidade')
    .eq('id', id)
    .single()

  if (!curso) notFound()

  // Professor só abre curso que ele leciona em alguma turma.
  if (sessao.role !== 'admin') {
    const { count } = await supabase
      .from('turmas')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', id)
      .eq('professor_id', sessao.id)
    if (!count) redirect('/dashboard/professor')
  }

  const [{ data: aulas }, { data: turmas }] = await Promise.all([
    supabase
      .from('aulas')
      .select('id, numero, titulo, descricao, video_url, duracao_minutos, publicada')
      .eq('curso_id', id)
      .order('numero', { ascending: true }),
    supabase.from('turmas').select('id').eq('curso_id', id),
  ])

  const idsTurmas = (turmas ?? []).map((t) => t.id)
  const idsAulas = (aulas ?? []).map((a) => a.id)

  const [{ data: matriculas }, { data: progresso }] = await Promise.all([
    idsTurmas.length
      ? supabase.from('turma_alunos').select('turma_id').in('turma_id', idsTurmas)
      : Promise.resolve({ data: [] as { turma_id: string }[] }),
    idsAulas.length
      ? supabase
          .from('aula_progresso')
          .select('aula_id, concluida')
          .in('aula_id', idsAulas)
          .eq('concluida', true)
      : Promise.resolve({ data: [] as { aula_id: string }[] }),
  ])

  const concluidasPorAula = new Map<string, number>()
  for (const p of progresso ?? []) {
    concluidasPorAula.set(p.aula_id, (concluidasPorAula.get(p.aula_id) ?? 0) + 1)
  }

  const lista: AulaItem[] = (aulas ?? []).map((a) => ({
    ...a,
    concluidas: concluidasPorAula.get(a.id) ?? 0,
  }))

  const modalidade = MODALIDADE[(curso.modalidade as ModalidadeCurso) ?? 'ead']

  return (
    <div className="p-5 sm:p-8">
      <Link
        href="/dashboard/professor"
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700 transition-colors mb-4"
      >
        <ArrowLeft
          className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
          strokeWidth={2.25}
        />
        Voltar
      </Link>

      <div className="mb-7 flex flex-wrap items-start justify-between gap-4 animate-float-in">
        <div className="min-w-0">
        <div className="mb-2">
          <Selo tom={modalidade.tom} icone={modalidade.icone}>
            {modalidade.label}
          </Selo>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{curso.titulo}</h1>
        <p className="text-gray-500 mt-1.5">
          {curso.subtitulo || modalidade.descricao}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-sm text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <BookOpenText className="h-4 w-4 text-brand-600" strokeWidth={2} />
            <span className="font-semibold text-gray-700 tabular-nums">{lista.length}</span> aulas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users2 className="h-4 w-4 text-brand-600" strokeWidth={2} />
            <span className="font-semibold text-gray-700 tabular-nums">
              {matriculas?.length ?? 0}
            </span>{' '}
            alunos
          </span>
        </div>
        </div>

        <Link
          href={`/dashboard/professor/cursos/${id}/preview`}
          className="group inline-flex items-center gap-2 rounded-lg bg-white ring-1 ring-gray-200 px-3.5 py-2 text-[13px] font-semibold text-gray-700 transition-all hover:ring-brand-300 hover:text-brand-800 active:scale-[0.98]"
        >
          <Eye className="h-4 w-4 text-brand-600" strokeWidth={2.25} />
          Ver como aluno
        </Link>
      </div>

      {/* Aula gravada enviada direto para a plataforma — pensado para o
          presencial, mas disponível em qualquer curso: nem todo professor
          quer depender do YouTube. */}
      <div className="mb-5">
        <AulaAvulsaForm cursoId={id} />
      </div>

      <AulasManager cursoId={id} aulas={lista} totalAlunos={matriculas?.length ?? 0} />
    </div>
  )
}
