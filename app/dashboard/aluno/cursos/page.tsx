import { BookOpenText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import CursoCard from '@/components/Cursos/CursoCard'
import { modulosDoAluno, type MatriculaNoModulo, type SituacaoNaTurma } from '@/lib/modulosDoAluno'
import type { Curso } from '@/lib/cursos'

export default async function MeusCursosPage() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  // Cursos aos quais o aluno tem acesso: os das turmas em que está matriculado
  const { data: matriculas } = await supabase
    .from('turma_alunos')
    .select('turma_id, situacao, turmas(id, nome, curso_id, modulo_id, cursos(*))')
    .eq('aluno_id', sessao.id)

  const cursos = new Map<string, Curso>()
  const inscricoes: { cursoId: string; moduloId: string | null; situacao: SituacaoNaTurma }[] = []

  for (const m of matriculas ?? []) {
    const t = m.turmas as unknown as {
      curso_id?: string | null
      modulo_id?: string | null
      cursos?: Curso | null
    } | null
    if (!t?.cursos) continue
    cursos.set(t.cursos.id, t.cursos)
    inscricoes.push({
      cursoId: t.cursos.id,
      moduloId: t.modulo_id ?? null,
      situacao: (m.situacao as SituacaoNaTurma) ?? 'cursando',
    })
  }

  const lista = [...cursos.values()].sort((a, b) => a.ordem - b.ordem)
  const idsCursos = lista.map((c) => c.id)

  const [{ data: modulos }, { data: aulas }, { data: progresso }] = await Promise.all([
    idsCursos.length
      ? supabase
          .from('modulos')
          .select('id, curso_id, nome, ordem')
          .in('curso_id', idsCursos)
          .order('ordem', { ascending: true })
      : Promise.resolve({
          data: [] as { id: string; curso_id: string; nome: string; ordem: number }[],
        }),
    idsCursos.length
      ? supabase
          .from('aulas')
          .select('id, curso_id, modulo_id')
          .in('curso_id', idsCursos)
          .eq('publicada', true)
      : Promise.resolve({
          data: [] as { id: string; curso_id: string; modulo_id: string | null }[],
        }),
    supabase
      .from('aula_progresso')
      .select('aula_id, concluida')
      .eq('aluno_id', sessao.id)
      .eq('concluida', true),
  ])

  const concluidas = new Set((progresso ?? []).map((p) => p.aula_id))

  /* ---------- O avanço mede o MÓDULO, não o curso inteiro ----------

     Antes o cartão somava todas as aulas do curso. Com módulos isso vira
     um número falso e desanimador: quem está no Módulo 1 de três nunca
     passaria de 33%, mesmo tendo feito tudo o que podia — e as aulas que
     faltam para chegar a 100% ele nem tem permissão de abrir. */
  const avancoDoCurso = (curso: Curso) => {
    const doCurso = (modulos ?? [])
      .filter((m) => m.curso_id === curso.id)
      .map((m) => ({ id: m.id as string, nome: m.nome as string, ordem: Number(m.ordem) }))

    const minhas: MatriculaNoModulo[] = inscricoes
      .filter((i) => i.cursoId === curso.id && i.moduloId)
      .map((i) => ({ moduloId: i.moduloId as string, situacao: i.situacao }))

    const resolvidos = modulosDoAluno(doCurso, minhas)
    const atual = resolvidos.find((m) => m.atual) ?? resolvidos.find((m) => m.aberto) ?? null

    const ids = (aulas ?? [])
      .filter((a) => (atual ? a.modulo_id === atual.id : a.curso_id === curso.id))
      .map((a) => a.id as string)

    const feitas = ids.filter((id) => concluidas.has(id)).length

    return {
      total: ids.length,
      feitas,
      pct: ids.length > 0 ? (feitas / ids.length) * 100 : 0,
      /* O nome do módulo só entra quando o curso TEM mais de um. Escrever
         "Módulo 1" num curso de um módulo só é ruído. */
      etapa: doCurso.length > 1 ? (atual?.nome ?? null) : null,
    }
  }

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
            const a = avancoDoCurso(curso)
            return (
              <div
                key={curso.id}
                className="animate-float-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <CursoCard
                  curso={curso}
                  href={`/dashboard/aluno/cursos/${curso.id}`}
                  totalAulas={a.total}
                  aulasConcluidas={a.feitas}
                  progresso={a.pct}
                  etapa={a.etapa}
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
