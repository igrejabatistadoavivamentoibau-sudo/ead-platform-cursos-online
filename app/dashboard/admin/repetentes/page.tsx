import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import { PageHeader, Card, EstadoVazio, Selo, Indicador } from '@/components/ui'
import ColocarEmTurma, { type Repetente, type TurmaDisponivel } from '@/components/Dashboard/ColocarEmTurma'

/**
 * Quem repete o módulo.
 *
 * "Abaixo de 7 ele é reprovado e vira candidato para repetir o curso, e o
 * administrador decide se ele fica em uma outra turma ou não."
 *
 * A palavra que orienta esta tela é CANDIDATO. Reprovar não coloca
 * ninguém em lugar nenhum automaticamente — seria a plataforma decidindo
 * a vida de uma pessoa. Ela junta quem está nessa situação, mostra a
 * média e o módulo, e oferece as turmas onde caberia. Quem decide é a
 * coordenação, e a decisão fica registrada com o nome de quem tomou.
 */
export default async function RepetentesPage() {
  await exigirPermissao('gerenciar_turmas')
  const supabase = await createClient()

  const { data: reprovados } = await supabase
    .from('turma_alunos')
    .select(
      'id, aluno_id, media_final, observacao_conclusao, concluida_em, users:users!turma_alunos_aluno_id_fkey(name, email), turmas(id, nome, modulo_id, modulos(id, nome, ordem, curso_id, cursos(titulo)))'
    )
    .eq('situacao', 'reprovado')
    .order('concluida_em', { ascending: false })

  const lista: Repetente[] = (reprovados ?? []).map((r) => {
    const u = r.users as unknown as { name?: string; email?: string } | null
    const t = r.turmas as unknown as {
      id?: string
      nome?: string
      modulo_id?: string
      modulos?: {
        id?: string
        nome?: string
        ordem?: number
        curso_id?: string
        cursos?: { titulo?: string } | null
      } | null
    } | null
    return {
      matriculaId: r.id as string,
      alunoId: r.aluno_id as string,
      nome: u?.name ?? '',
      email: u?.email ?? '',
      media: r.media_final === null ? null : Number(r.media_final),
      observacao: (r.observacao_conclusao as string) ?? null,
      concluidaEm: (r.concluida_em as string) ?? null,
      turmaAnterior: t?.nome ?? '',
      moduloId: t?.modulos?.id ?? null,
      moduloNome: t?.modulos?.nome ?? null,
      cursoTitulo: t?.modulos?.cursos?.titulo ?? null,
    }
  })

  /* As turmas onde esses alunos CABEM: mesmas do módulo em que ele
     reprovou, e que ainda não encerraram. Oferecer turma de outro módulo
     aqui seria oferecer justamente o que a regra do pré-requisito
     impede. */
  const idsModulos = [...new Set(lista.map((r) => r.moduloId).filter(Boolean))] as string[]

  const { data: turmas } = idsModulos.length
    ? await supabase
        .from('turmas')
        .select('id, nome, status, modalidade, modulo_id, data_inicio')
        .in('modulo_id', idsModulos)
        .neq('status', 'encerrada')
        .order('data_inicio', { ascending: false })
    : { data: [] }

  const disponiveis: TurmaDisponivel[] = (turmas ?? []).map((t) => ({
    id: t.id as string,
    nome: t.nome as string,
    status: t.status as string,
    modalidade: (t.modalidade as string) ?? 'ead',
    moduloId: (t.modulo_id as string) ?? '',
  }))

  const cursos = new Set(lista.map((r) => r.cursoTitulo).filter(Boolean)).size

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Quem repete o módulo"
        descricao="Alunos reprovados esperando uma decisão da coordenação. Reprovar não matricula ninguém automaticamente."
      />

      {lista.length === 0 ? (
        <EstadoVazio
          icone="GraduationCap"
          titulo="Ninguém esperando decisão"
          descricao="Quando um módulo for fechado com aluno reprovado, ele aparece aqui para você decidir em qual turma ele refaz."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador icone="Users2" valor={lista.length} label="Aguardando decisão" />
            <Indicador icone="BookOpenText" valor={cursos} label="Cursos envolvidos" />
            <Indicador icone="GraduationCap" valor={disponiveis.length} label="Turmas abertas" />
          </div>

          <div className="space-y-3">
            {lista.map((r) => (
              <Card key={r.matriculaId} padding={false}>
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-[15px] font-bold text-gray-900">{r.nome}</h3>
                      {r.media !== null && (
                        <Selo tom="vermelho">
                          média {r.media.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
                        </Selo>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-gray-500">
                      {r.cursoTitulo && <>{r.cursoTitulo} · </>}
                      {r.moduloNome && <>{r.moduloNome} · </>}
                      turma {r.turmaAnterior}
                    </p>
                    {r.observacao && (
                      <p className="mt-1 text-[12px] italic text-gray-500">“{r.observacao}”</p>
                    )}
                  </div>

                  <ColocarEmTurma
                    repetente={r}
                    turmas={disponiveis.filter((t) => t.moduloId === r.moduloId)}
                  />
                </div>
              </Card>
            ))}
          </div>

          <p className="mt-6 text-[12px] text-gray-500">
            Precisa fechar um módulo?{' '}
            <Link href="/dashboard/admin/turmas" className="font-semibold text-brand-700 underline underline-offset-2">
              Abra a turma
            </Link>{' '}
            e vá em Conclusão.
          </p>
        </>
      )}
    </div>
  )
}
