import { notFound, redirect } from 'next/navigation'
import { Check, Minus, TrendingUp, Users2, Trophy, BookOpenText } from 'lucide-react'
import Voltar from '@/components/ui/Voltar'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'

export default async function AvancoDaTurmaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sessao = await exigirPermissao('ver_alunos')
  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('turmas')
    .select('id, nome, professor_id, curso_id, modulo_id, cursos(titulo), modulos!turmas_modulo_id_fkey(nome, ordem)')
    .eq('id', id)
    .single()

  if (!turma) notFound()
  if (sessao.role !== 'admin' && turma.professor_id !== sessao.id) {
    redirect('/dashboard/professor')
  }

  const curso = turma.cursos as unknown as { titulo?: string } | null
  const modulo = turma.modulos as unknown as { nome?: string; ordem?: number } | null

  const [{ data: matriculas }, { data: aulas }] = await Promise.all([
    supabase
      .from('turma_alunos')
      .select('aluno_id, users(id, name, email)')
      .eq('turma_id', id)
      .eq('status', 'ativo'),
    /* AS AULAS DO MÓDULO DESTA TURMA. O avanço é uma grade aluno × aula:
       trazer o curso inteiro colocaria nela as aulas dos outros módulos, e
       toda a turma apareceria com um rastro de colunas vazias em conteúdo
       que não é dela — parecendo atraso onde não há atraso nenhum. */
    turma.modulo_id
      ? supabase
          .from('aulas')
          .select('id, numero, titulo')
          .eq('modulo_id', turma.modulo_id)
          .eq('publicada', true)
          .order('numero', { ascending: true })
      : turma.curso_id
        ? supabase
            .from('aulas')
            .select('id, numero, titulo')
            .eq('curso_id', turma.curso_id)
            .eq('publicada', true)
            .order('numero', { ascending: true })
        : Promise.resolve({ data: [] as { id: string; numero: number; titulo: string }[] }),
  ])

  const alunos = (matriculas ?? [])
    .map((m) => {
      const u = m.users as unknown as { id?: string; name?: string; email?: string } | null
      return { id: u?.id as string, name: (u?.name as string) ?? '', email: (u?.email as string) ?? '' }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const listaAulas = aulas ?? []
  const idsAulas = listaAulas.map((a) => a.id)

  const { data: progresso } = idsAulas.length
    ? await supabase
        .from('aula_progresso')
        .select('aula_id, aluno_id, concluida, percentual')
        .in('aula_id', idsAulas)
    : { data: [] }

  // Mapa "alunoId|aulaId" -> progresso, para consulta direta na tabela
  const mapa = new Map<string, { concluida: boolean; percentual: number }>()
  for (const p of progresso ?? []) {
    mapa.set(`${p.aluno_id}|${p.aula_id}`, {
      concluida: p.concluida as boolean,
      percentual: Number(p.percentual),
    })
  }

  const concluidasDoAluno = (alunoId: string) =>
    listaAulas.filter((a) => mapa.get(`${alunoId}|${a.id}`)?.concluida).length

  const concluidasDaAula = (aulaId: string) =>
    alunos.filter((al) => mapa.get(`${al.id}|${aulaId}`)?.concluida).length

  const totalPossivel = alunos.length * listaAulas.length
  const totalConcluido = alunos.reduce((s, a) => s + concluidasDoAluno(a.id), 0)
  const mediaTurma = totalPossivel > 0 ? Math.round((totalConcluido / totalPossivel) * 100) : 0

  const indicadores = [
    { icon: Users2, valor: alunos.length, label: 'Alunos ativos' },
    { icon: BookOpenText, valor: listaAulas.length, label: 'Aulas publicadas' },
    { icon: TrendingUp, valor: `${mediaTurma}%`, label: 'Avanço médio da turma' },
    {
      icon: Trophy,
      valor: alunos.filter((a) => listaAulas.length > 0 && concluidasDoAluno(a.id) === listaAulas.length).length,
      label: 'Concluíram tudo',
    },
  ]

  return (
    <div className="p-5 sm:p-8">
      <Voltar
        href="/dashboard/professor"
        label="Minhas turmas"
        titulo="Avanço da turma"
        margem="mb-4"
      />

      <div className="mb-7 animate-float-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Avanço da turma</h1>
        <p className="text-gray-500 mt-1.5">
          {turma.nome}
          {curso?.titulo ? ` — ${curso.titulo}` : ''}
          {modulo?.nome ? ` · ${modulo.ordem}. ${modulo.nome}` : ''}
        </p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {indicadores.map((ind, i) => (
          <div
            key={ind.label}
            className="card-alive p-5 animate-float-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 mb-3.5">
              <ind.icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="text-2xl font-extrabold text-gray-900 tabular-nums">{ind.valor}</div>
            <div className="text-sm text-gray-500 mt-0.5 leading-snug">{ind.label}</div>
          </div>
        ))}
      </div>

      {!turma.curso_id && !turma.modulo_id ? (
        <div className="card-alive p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <BookOpenText className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="text-gray-800 font-medium">
            Esta turma ainda não está ligada a um curso-módulo.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            As aulas vêm do módulo. A coordenação precisa escolher o módulo da turma para o avanço
            aparecer aqui.
          </p>
        </div>
      ) : alunos.length === 0 || listaAulas.length === 0 ? (
        <div className="card-alive p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <Users2 className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="text-gray-800 font-medium">
            {alunos.length === 0
              ? 'Nenhum aluno matriculado nesta turma.'
              : 'Nenhuma aula publicada no módulo desta turma ainda.'}
          </p>
        </div>
      ) : (
        <div className="card-alive overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="sticky left-0 z-10 bg-gray-50/95 backdrop-blur-sm px-5 py-3.5 text-left font-semibold text-gray-700 min-w-[200px]">
                    Aluno
                  </th>
                  {listaAulas.map((a) => (
                    <th
                      key={a.id}
                      title={a.titulo}
                      className="px-2 py-3.5 text-center font-semibold text-gray-500 text-xs whitespace-nowrap"
                    >
                      A{a.numero}
                    </th>
                  ))}
                  <th className="px-5 py-3.5 text-right font-semibold text-gray-700 whitespace-nowrap">
                    Avanço
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alunos.map((aluno) => {
                  const feitas = concluidasDoAluno(aluno.id)
                  const pct = Math.round((feitas / listaAulas.length) * 100)
                  return (
                    <tr key={aluno.id} className="hover:bg-brand-50/30 transition-colors">
                      <td className="sticky left-0 z-10 bg-white px-5 py-3">
                        <p className="font-medium text-gray-800 truncate">{aluno.name}</p>
                        <p className="text-xs text-gray-500 truncate">{aluno.email}</p>
                      </td>

                      {listaAulas.map((a) => {
                        const p = mapa.get(`${aluno.id}|${a.id}`)
                        return (
                          <td key={a.id} className="px-2 py-3 text-center">
                            {p?.concluida ? (
                              <span
                                title="Concluída"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white"
                              >
                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                              </span>
                            ) : p && p.percentual > 0 ? (
                              <span
                                title={`${Math.round(p.percentual)}% assistido`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-[10px] font-bold text-amber-700"
                              >
                                {Math.round(p.percentual)}
                              </span>
                            ) : (
                              <span
                                title="Não iniciada"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-300"
                              >
                                <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                              </span>
                            )}
                          </td>
                        )
                      })}

                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-bold text-gray-700 tabular-nums w-10 text-right">
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-100 bg-gray-50/60">
                  <td className="sticky left-0 z-10 bg-gray-50/95 backdrop-blur-sm px-5 py-3 font-semibold text-gray-600 text-xs">
                    Concluíram por aula
                  </td>
                  {listaAulas.map((a) => (
                    <td
                      key={a.id}
                      className="px-2 py-3 text-center text-xs font-bold text-gray-600 tabular-nums"
                    >
                      {concluidasDaAula(a.id)}
                    </td>
                  ))}
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-brand-600 text-white">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              Concluída
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-[9px] font-bold text-amber-700">
                50
              </span>
              Em andamento (% assistido)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-gray-300">
                <Minus className="h-3 w-3" strokeWidth={2.5} />
              </span>
              Não iniciada
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
