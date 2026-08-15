import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import AulasManager, { type AulaItem } from '@/components/Aulas/AulasManager'

export default async function AulasProfessorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sessao = await exigirPermissao('gerenciar_aulas')

  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('turmas')
    .select('id, nome, professor_id')
    .eq('id', id)
    .single()

  if (!turma) notFound()

  // Professor só abre a própria turma. Admin abre qualquer uma.
  if (sessao.role !== 'admin' && turma.professor_id !== sessao.id) {
    redirect('/dashboard/professor')
  }

  const [{ data: aulas }, { count: totalAlunos }] = await Promise.all([
    supabase
      .from('aulas')
      .select('id, numero, titulo, descricao, video_url, duracao_minutos, publicada')
      .eq('turma_id', id)
      .order('numero', { ascending: true }),
    supabase
      .from('turma_alunos')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', id)
      .eq('status', 'ativo'),
  ])

  const ids = (aulas ?? []).map((a) => a.id)
  const { data: progresso } = ids.length
    ? await supabase
        .from('aula_progresso')
        .select('aula_id, concluida')
        .in('aula_id', ids)
        .eq('concluida', true)
    : { data: [] }

  const concluidasPorAula = new Map<string, number>()
  for (const p of progresso ?? []) {
    concluidasPorAula.set(p.aula_id, (concluidasPorAula.get(p.aula_id) ?? 0) + 1)
  }

  const lista: AulaItem[] = (aulas ?? []).map((a) => ({
    ...a,
    concluidas: concluidasPorAula.get(a.id) ?? 0,
  }))

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
        Minhas turmas
      </Link>

      <div className="mb-7 animate-float-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Vídeo aulas</h1>
        <p className="text-gray-500 mt-1.5">
          {turma.nome} — o aluno vê apenas as aulas publicadas, e ganha o selo de concluída ao
          assistir o vídeo até o fim.
        </p>
      </div>

      <AulasManager turmaId={id} aulas={lista} totalAlunos={totalAlunos ?? 0} />
    </div>
  )
}
