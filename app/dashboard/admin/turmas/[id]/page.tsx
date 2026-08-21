import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import TurmaStatusActions from '@/components/Dashboard/TurmaStatusActions'
import MatriculaManager from '@/components/Dashboard/MatriculaManager'
import EncontroManager from '@/components/Dashboard/EncontroManager'
import CursoDaTurma from '@/components/Dashboard/CursoDaTurma'
import ModuloDaTurma, { type ModuloEscolhivel } from '@/components/Dashboard/ModuloDaTurma'
import { BotaoLink } from '@/components/ui'
import ExcluirTurma from '@/components/Dashboard/ExcluirTurma'

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

export default async function TurmaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('turmas')
    .select('id, nome, descricao, status, data_inicio, professor_id, curso_id, modulo_id, modalidade')
    .eq('id', id)
    .single()

  if (!turma) notFound()

  const [{ data: matriculas }, { data: alunos }, { data: encontros }] = await Promise.all([
    supabase
      .from('turma_alunos')
      .select('id, aluno_id, users(id, name, email)')
      .eq('turma_id', id),
    supabase.from('users').select('id, name').eq('role', 'aluno').order('name'),
    supabase.from('encontros').select('id, titulo, data').eq('turma_id', id).order('data', { ascending: false }),
  ])

  const { data: cursos } = await supabase
    .from('cursos')
    .select('id, titulo')
    .order('ordem', { ascending: true })

  /* Todos os módulos de todos os cursos, para o seletor. São poucos por
     natureza (um curso tem 2 a 5 etapas), então uma consulta só resolve —
     e o agrupamento por curso acontece na tela. */
  const { data: modulosBanco } = await supabase
    .from('modulos')
    .select('id, nome, ordem, cursos(titulo)')
    .order('ordem', { ascending: true })

  const modulosEscolhiveis: ModuloEscolhivel[] = (modulosBanco ?? []).map((m) => ({
    id: m.id as string,
    nome: m.nome as string,
    ordem: Number(m.ordem),
    cursoTitulo: (m.cursos as unknown as { titulo?: string } | null)?.titulo ?? 'Sem curso',
  }))

  const matriculados = (matriculas ?? []).map((m) => {
    const aluno = m.users as unknown as { id?: string; name?: string; email?: string } | null
    return {
      matriculaId: m.id as string,
      id: aluno?.id as string,
      name: aluno?.name as string,
      email: aluno?.email as string,
    }
  })

  // Nome do professor por consulta direta, sem join embutido (ver lib/consulta.ts)
  const { data: professor } = turma.professor_id
    ? await supabase.from('users').select('name').eq('id', turma.professor_id).maybeSingle()
    : { data: null }
  const professorNome = professor?.name

  return (
    <div className="p-5 sm:p-8">
      <Link
        href="/dashboard/admin/turmas"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
        Todas as turmas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{turma.nome}</h1>
            <span
              className={`text-[11px] font-semibold px-2 py-1 rounded-full ring-1 ${STATUS_STYLE[turma.status]}`}
            >
              {STATUS_LABEL[turma.status]}
            </span>
          </div>
          {turma.descricao && <p className="text-gray-500">{turma.descricao}</p>}
          <p className="text-sm text-gray-400 mt-1">
            Professor: {professorNome ?? 'não definido'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {turma.curso_id && (
            <Link
              href={`/dashboard/admin/cursos/${turma.curso_id}`}
              className="group inline-flex items-center gap-2 bg-white ring-1 ring-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:ring-brand-300 hover:text-brand-800 hover:shadow-card active:scale-[0.98]"
            >
              <Video className="h-4 w-4 text-brand-600" strokeWidth={2.25} />
              Vídeo aulas
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                strokeWidth={2.25}
              />
            </Link>
          )}
          <TurmaStatusActions turmaId={turma.id} status={turma.status} />
        </div>
      </div>

      <div className="mb-6 flex justify-end">
        <ExcluirTurma turmaId={turma.id} nomeDaTurma={turma.nome} />
      </div>

      {/* As telas pedagógicas da turma são as mesmas do professor — o admin
          entra por elas em vez de existir uma segunda versão que divergiria. */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        {[
          { slug: 'avanco', label: 'Avanço da turma', icone: 'TrendingUp' },
          { slug: 'chamada', label: 'Chamada / frequência', icone: 'ClipboardCheck' },
          { slug: 'notas', label: 'Notas', icone: 'GraduationCap' },
          { slug: 'atividades', label: 'Atividades', icone: 'FileText' },
        ].map((t) => (
          <BotaoLink
            key={t.slug}
            href={`/dashboard/professor/turmas/${turma.id}/${t.slug}`}
            variante="secundario"
            icone={t.icone}
          >
            {t.label}
          </BotaoLink>
        ))}
      </div>

      <div className="mb-6">
        {/* O módulo substitui a escolha de curso: ele traz o curso junto.
            A escolha de curso continua logo abaixo, para as turmas antigas
            que ainda não foram encaixadas num módulo. */}
        <ModuloDaTurma
          turmaId={turma.id}
          moduloAtual={(turma.modulo_id as string) ?? null}
          modalidadeAtual={turma.modalidade === 'presencial' ? 'presencial' : 'ead'}
          modulos={modulosEscolhiveis}
        />

        {!turma.modulo_id && (
          <div className="mt-4">
            <CursoDaTurma
              turmaId={turma.id}
              cursoAtual={turma.curso_id}
              cursos={cursos ?? []}
            />
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <MatriculaManager turmaId={turma.id} matriculados={matriculados} disponiveis={alunos ?? []} />
        <EncontroManager turmaId={turma.id} encontros={encontros ?? []} />
      </div>
    </div>
  )
}
