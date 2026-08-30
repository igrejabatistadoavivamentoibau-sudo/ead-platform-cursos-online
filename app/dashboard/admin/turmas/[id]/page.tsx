import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Video } from 'lucide-react'
import Voltar from '@/components/ui/Voltar'
import { createClient } from '@/lib/supabase/server'
import { exigirDados } from '@/lib/consulta'
import TurmaStatusActions from '@/components/Dashboard/TurmaStatusActions'
import MatriculaManager, { type TurmaParaMover } from '@/components/Dashboard/MatriculaManager'
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

  /* ESTAS TRÊS PASSAM POR `exigirDados` DE PROPÓSITO.

     Era aqui que a plataforma mentia. A consulta das matrículas voltava
     ERRO — `turma_alunos` tem dois caminhos para a tabela de pessoas
     (`aluno_id` e `concluida_por`, este último da migração 022), e o
     servidor recusa o vínculo ambíguo —, o `error` era jogado fora, e a
     tela dizia "Alunos matriculados (0)" com dois alunos matriculados no
     banco. No clique, a ação (que não usa vínculo nenhum) respondia
     "esse aluno já está matriculado". A mesma tela afirmando as duas
     coisas.

     Lista vazia por defeito agora aparece COMO defeito, com o nome da
     consulta na mensagem. Vale a pena a tela quebrar: quebrada, ela é
     consertada em minutos; mentindo, ficou dias enganando a escola. */
  const [matriculasR, alunosR, encontrosR] = await Promise.all([
    supabase
      .from('turma_alunos')
      .select('id, aluno_id, status, users:users!turma_alunos_aluno_id_fkey(id, name, email)')
      .eq('turma_id', id),
    /* Só quem está ativo aparece para ser matriculado. Quem foi desativado
       saiu da escola; oferecê-lo numa lista de matrícula seria convidar ao
       engano. Quem JÁ ESTÁ matriculado continua aparecendo na turma. */
    supabase
      .from('users')
      .select('id, name')
      .eq('role', 'aluno')
      .eq('ativo', true)
      .order('name'),
    supabase.from('encontros').select('id, titulo, data').eq('turma_id', id).order('data', { ascending: false }),
  ])

  const matriculas = exigirDados<
    { id: string; aluno_id: string; status: string; users: unknown }[]
  >(matriculasR, 'as matrículas desta turma')
  const alunos = exigirDados<{ id: string; name: string }[]>(alunosR, 'a lista de alunos')
  const encontros = exigirDados<{ id: string; titulo: string | null; data: string }[]>(
    encontrosR,
    'os encontros da turma'
  )

  const { data: cursos } = await supabase
    .from('cursos')
    .select('id, titulo')
    .order('ordem', { ascending: true })

  /* Todos os módulos de todos os cursos, para o seletor. São poucos por
     natureza (um curso tem 2 a 5 etapas), então uma consulta só resolve —
     e a separação curso → módulo acontece na tela.

     A contagem de aulas vem junto porque ela muda a decisão: ligar a turma
     num módulo vazio não dá erro nenhum, só faz a sala inteira entrar e
     não encontrar conteúdo. O número aparece no cartão ANTES do clique. */
  const [{ data: modulosBanco }, { data: aulasDosModulos }] = await Promise.all([
    supabase
      .from('modulos')
      .select('id, nome, ordem, curso_id, cursos!modulos_curso_id_fkey(titulo)')
      .order('ordem', { ascending: true }),
    supabase.from('aulas').select('modulo_id').not('modulo_id', 'is', null),
  ])

  const aulasPorModulo = new Map<string, number>()
  for (const a of aulasDosModulos ?? []) {
    const k = a.modulo_id as string
    aulasPorModulo.set(k, (aulasPorModulo.get(k) ?? 0) + 1)
  }

  const modulosEscolhiveis: ModuloEscolhivel[] = (modulosBanco ?? []).map((m) => ({
    id: m.id as string,
    nome: m.nome as string,
    ordem: Number(m.ordem),
    cursoId: (m.curso_id as string) ?? '',
    cursoTitulo: (m.cursos as unknown as { titulo?: string } | null)?.titulo ?? 'Sem curso',
    aulas: aulasPorModulo.get(m.id as string) ?? 0,
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

  /* PARA ONDE ESTE ALUNO PODE IR.

     Outras turmas do MESMO CURSO que ainda não encerraram. As do mesmo
     módulo são troca de sala; as de outro módulo são avanço de etapa — e
     a ação decide qual é qual pelo destino, para não haver como escolher
     errado na tela.

     Só do mesmo curso: mover para uma turma de outro curso não é mudar
     de sala nem avançar, é uma matrícula nova em outra escola de fato. */
  const { data: turmasDoCurso } = turma.curso_id
    ? await supabase
        .from('turmas')
        .select('id, nome, status, modulo_id, modulos!turmas_modulo_id_fkey(nome, ordem)')
        .eq('curso_id', turma.curso_id)
        .neq('id', turma.id)
        .neq('status', 'encerrada')
    : { data: [] as unknown[] }

  const turmasParaMover: TurmaParaMover[] = ((turmasDoCurso ?? []) as Record<string, unknown>[])
    .map((t) => {
      const m = t.modulos as unknown as { nome?: string; ordem?: number } | null
      return {
        id: t.id as string,
        nome: t.nome as string,
        moduloId: (t.modulo_id as string) ?? null,
        moduloNome: m?.nome ?? 'Sem módulo',
        mesmoModulo: Boolean(turma.modulo_id) && t.modulo_id === turma.modulo_id,
        status: (t.status as string) ?? 'planejada',
        ordem: Number(m?.ordem ?? 0),
      }
    })
    .sort((a, b) => (a.ordem - b.ordem) || a.nome.localeCompare(b.nome, 'pt-BR'))

  // Nome do professor por consulta direta, sem join embutido (ver lib/consulta.ts)
  const { data: professor } = turma.professor_id
    ? await supabase.from('users').select('name').eq('id', turma.professor_id).maybeSingle()
    : { data: null }
  const professorNome = professor?.name

  return (
    <div className="p-5 sm:p-8">
      <Voltar
        href="/dashboard/admin/turmas"
        label="Todas as turmas"
        titulo={turma.nome}
        margem="mb-4"
      />

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
        <MatriculaManager
          turmaId={turma.id}
          matriculados={matriculados}
          disponiveis={alunos ?? []}
          turmasParaMover={turmasParaMover}
        />
        <EncontroManager turmaId={turma.id} encontros={encontros ?? []} />
      </div>
    </div>
  )
}
