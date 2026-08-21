import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import VisaoDoCurso, {
  type AulaDoCurso,
  type ProgressoAula,
  type JanelaDaAula,
} from '@/components/Cursos/VisaoDoCurso'
import type { Curso } from '@/lib/cursos'

export default async function CursoDoAlunoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aula?: string }>
}) {
  const { id } = await params
  const { aula: aulaSelecionada } = await searchParams
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: curso } = await supabase.from('cursos').select('*').eq('id', id).single()
  if (!curso) notFound()

  const { data: aulas } = await supabase
    .from('aulas')
    .select('id, numero, titulo, descricao, video_url, video_path, duracao_minutos')
    .eq('curso_id', id)
    .eq('publicada', true)
    .order('numero', { ascending: true })

  const { data: progressos } = await supabase
    .from('aula_progresso')
    .select('aula_id, concluida, percentual')
    .eq('aluno_id', sessao.id)

  /* ---------- A janela de cada aula NESTA turma ----------
     A aula é do curso, mas a data de abrir e fechar é da turma. Então
     primeiro descobrimos em qual turma deste curso o aluno está.

     Ele pode estar em mais de uma (repetindo o módulo, por exemplo). Nesse
     caso vale a MAIS PERMISSIVA: se ele tem direito de assistir por algum
     caminho, ele tem direito. A regra é a mesma do banco — as duas
     precisam concordar, senão a tela diz uma coisa e o servidor faz outra. */
  const { data: minhasTurmas } = await supabase
    .from('turma_alunos')
    .select('turma_id, turmas!inner(id, curso_id)')
    .eq('aluno_id', sessao.id)
    .eq('status', 'ativo')

  const turmasDoCurso = (minhasTurmas ?? [])
    .filter((m) => (m.turmas as unknown as { curso_id?: string } | null)?.curso_id === id)
    .map((m) => m.turma_id as string)

  const [{ data: janelasBanco }, { data: pedidos }] = await Promise.all([
    turmasDoCurso.length
      ? supabase
          .from('aula_turma')
          .select('turma_id, aula_id, abre_em, vence_em')
          .in('turma_id', turmasDoCurso)
      : Promise.resolve({ data: [] }),
    turmasDoCurso.length
      ? supabase
          .from('liberacoes_de_aula')
          .select('turma_id, aula_id, status, resposta, libera_ate')
          .in('turma_id', turmasDoCurso)
          .eq('aluno_id', sessao.id)
      : Promise.resolve({ data: [] }),
  ])

  const agora = Date.now()
  const janelas = new Map<string, JanelaDaAula>()
  for (const j of janelasBanco ?? []) {
    const aulaId = j.aula_id as string
    const p = (pedidos ?? []).find(
      (x) => x.aula_id === aulaId && x.turma_id === j.turma_id
    )
    const liberada =
      p?.status === 'liberada' &&
      (!p.libera_ate || agora <= new Date(p.libera_ate as string).getTime())

    const nova: JanelaDaAula = {
      turmaId: j.turma_id as string,
      abre_em: (j.abre_em as string) ?? null,
      vence_em: (j.vence_em as string) ?? null,
      pedido: (p?.status as JanelaDaAula['pedido']) ?? 'nenhum',
      respostaDoProfessor: (p?.resposta as string) ?? null,
      liberada: !!liberada,
    }

    // Mais de uma turma com a mesma aula: fica a que deixa assistir.
    const jaTem = janelas.get(aulaId)
    if (!jaTem || nova.liberada) janelas.set(aulaId, nova)
  }

  const progressoPorAula = new Map<string, ProgressoAula>(
    (progressos ?? []).map((p) => [
      p.aula_id,
      { concluida: p.concluida as boolean, percentual: Number(p.percentual) },
    ])
  )

  const lista = (aulas ?? []) as AulaDoCurso[]

  if (lista.length === 0) {
    return (
      <div className="p-5 sm:p-8">
        <Link
          href="/dashboard/aluno/cursos"
          className="group inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={2.25} />
          Meus cursos
        </Link>
        <div className="card-alive p-14 text-center max-w-lg mx-auto">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <Video className="h-8 w-8" strokeWidth={1.6} />
          </div>
          <p className="text-gray-800 font-semibold">Nenhuma aula publicada ainda.</p>
          <p className="text-sm text-gray-500 mt-1.5">
            Assim que o professor publicar a primeira aula deste curso, ela aparece aqui.
          </p>
        </div>
      </div>
    )
  }

  const atual = lista.find((a) => a.id === aulaSelecionada) ?? lista[0]

  const { data: resumo } = await supabase
    .from('resumos_aula')
    .select('texto, feedback')
    .eq('aula_id', atual.id)
    .eq('aluno_id', sessao.id)
    .maybeSingle()

  return (
    <div className="p-5 sm:p-8">
      <Link
        href="/dashboard/aluno/cursos"
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700 transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={2.25} />
        Meus cursos
      </Link>

      <VisaoDoCurso
        curso={curso as Curso}
        aulas={lista}
        aulaAtual={atual}
        progressoPorAula={progressoPorAula}
        janelas={janelas}
      hrefAula={(aulaId) => `/dashboard/aluno/cursos/${id}?aula=${aulaId}`}
        resumo={
          resumo ? { texto: resumo.texto as string, feedback: (resumo.feedback as string) ?? null } : undefined
        }
      />
    </div>
  )
}
