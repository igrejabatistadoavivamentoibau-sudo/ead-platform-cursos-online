import { BookOpenText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import CursoForm from '@/components/Cursos/CursoForm'
import CursoCard from '@/components/Cursos/CursoCard'
import type { Curso } from '@/lib/cursos'

export default async function CursosPage() {
  await exigirSessao()
  const supabase = await createClient()

  const { data: cursos } = await supabase
    .from('cursos')
    .select('*')
    .order('ordem', { ascending: true })

  const ids = (cursos ?? []).map((c) => c.id)

  const [{ data: aulas }, { data: turmas }, { data: matriculas }] = await Promise.all([
    ids.length
      ? supabase.from('aulas').select('curso_id').in('curso_id', ids)
      : Promise.resolve({ data: [] as { curso_id: string }[] }),
    ids.length
      ? supabase.from('turmas').select('id, curso_id').in('curso_id', ids)
      : Promise.resolve({ data: [] as { id: string; curso_id: string }[] }),
    supabase.from('turma_alunos').select('turma_id'),
  ])

  const aulasPorCurso = new Map<string, number>()
  for (const a of aulas ?? []) {
    aulasPorCurso.set(a.curso_id, (aulasPorCurso.get(a.curso_id) ?? 0) + 1)
  }

  const alunosPorTurma = new Map<string, number>()
  for (const m of matriculas ?? []) {
    alunosPorTurma.set(m.turma_id, (alunosPorTurma.get(m.turma_id) ?? 0) + 1)
  }

  const alunosPorCurso = new Map<string, number>()
  for (const t of turmas ?? []) {
    if (!t.curso_id) continue
    alunosPorCurso.set(
      t.curso_id,
      (alunosPorCurso.get(t.curso_id) ?? 0) + (alunosPorTurma.get(t.id) ?? 0)
    )
  }

  return (
    <div className="p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7 animate-float-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cursos</h1>
          <p className="text-gray-500 mt-1.5">
            Cada curso guarda suas vídeo aulas e pode ser usado em quantas turmas você quiser.
          </p>
        </div>
        <CursoForm />
      </div>

      {cursos && cursos.length > 0 ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {cursos.map((curso, i) => (
            <div key={curso.id} className="animate-float-in" style={{ animationDelay: `${i * 60}ms` }}>
              <CursoCard
                curso={curso as Curso}
                href={`/dashboard/admin/cursos/${curso.id}`}
                totalAulas={aulasPorCurso.get(curso.id) ?? 0}
                totalAlunos={alunosPorCurso.get(curso.id) ?? 0}
                mostrarStatus
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="card-alive p-14 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <BookOpenText className="h-8 w-8" strokeWidth={1.6} />
          </div>
          <p className="text-gray-800 font-semibold">Nenhum curso criado ainda.</p>
          <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto">
            Comece criando o primeiro curso. Depois você adiciona as vídeo aulas dentro dele e liga
            as turmas ao curso.
          </p>
        </div>
      )}
    </div>
  )
}
