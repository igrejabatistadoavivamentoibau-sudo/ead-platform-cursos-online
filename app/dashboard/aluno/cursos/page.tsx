import { BookOpenText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import CursoCard from '@/components/Cursos/CursoCard'
import type { Curso } from '@/lib/cursos'

export default async function MeusCursosPage() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  // Cursos aos quais o aluno tem acesso: os das turmas em que está matriculado
  const { data: matriculas } = await supabase
    .from('turma_alunos')
    .select('turma_id, turmas(id, nome, curso_id, cursos(*))')
    .eq('aluno_id', sessao.id)

  const cursos = new Map<string, Curso>()
  for (const m of matriculas ?? []) {
    const t = m.turmas as unknown as { cursos?: Curso | null } | null
    if (t?.cursos) cursos.set(t.cursos.id, t.cursos)
  }

  const lista = [...cursos.values()].sort((a, b) => a.ordem - b.ordem)
  const idsCursos = lista.map((c) => c.id)

  const [{ data: aulas }, { data: progresso }] = await Promise.all([
    idsCursos.length
      ? supabase
          .from('aulas')
          .select('id, curso_id')
          .in('curso_id', idsCursos)
          .eq('publicada', true)
      : Promise.resolve({ data: [] as { id: string; curso_id: string }[] }),
    supabase
      .from('aula_progresso')
      .select('aula_id, concluida')
      .eq('aluno_id', sessao.id)
      .eq('concluida', true),
  ])

  const aulasPorCurso = new Map<string, string[]>()
  for (const a of aulas ?? []) {
    aulasPorCurso.set(a.curso_id, [...(aulasPorCurso.get(a.curso_id) ?? []), a.id])
  }

  const concluidas = new Set((progresso ?? []).map((p) => p.aula_id))

  return (
    <div className="p-5 sm:p-8">
      <div className="mb-7 animate-float-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Meus cursos</h1>
        <p className="text-gray-500 mt-1.5">
          Continue de onde parou. Seu avanço é salvo automaticamente.
        </p>
      </div>

      {lista.length > 0 ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {lista.map((curso, i) => {
            const ids = aulasPorCurso.get(curso.id) ?? []
            const feitas = ids.filter((id) => concluidas.has(id)).length
            const pct = ids.length > 0 ? (feitas / ids.length) * 100 : 0
            return (
              <div key={curso.id} className="animate-float-in" style={{ animationDelay: `${i * 60}ms` }}>
                <CursoCard
                  curso={curso}
                  href={`/dashboard/aluno/cursos/${curso.id}`}
                  totalAulas={ids.length}
                  aulasConcluidas={feitas}
                  progresso={pct}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card-alive p-14 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <BookOpenText className="h-8 w-8" strokeWidth={1.6} />
          </div>
          <p className="text-gray-800 font-semibold">Nenhum curso disponível ainda.</p>
          <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto">
            Assim que sua turma for ligada a um curso, ele aparece aqui com todas as vídeo aulas.
          </p>
        </div>
      )}
    </div>
  )
}
