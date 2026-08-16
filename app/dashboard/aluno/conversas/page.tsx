import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader } from '@/components/ui'
import PainelConversas, { type TurmaDoChat } from '@/components/Chat/PainelConversas'

export const dynamic = 'force-dynamic'

export default async function ConversasAlunoPage({
  searchParams,
}: {
  searchParams: Promise<{ turma?: string }>
}) {
  const { turma } = await searchParams
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: matriculas } = await supabase
    .from('turma_alunos')
    .select('turma_id, turmas(id, nome, cursos(titulo))')
    .eq('aluno_id', sessao.id)

  const turmas: TurmaDoChat[] = (matriculas ?? [])
    .map((m) => {
      const t = m.turmas as unknown as { id?: string; nome?: string; cursos?: { titulo?: string } | null } | null
      return t?.id ? { id: t.id, nome: t.nome ?? 'Turma', curso: t.cursos?.titulo ?? null } : null
    })
    .filter(Boolean) as TurmaDoChat[]

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Conversas"
        descricao="Fale com a sua turma e com o professor. Avisos importantes chegam destacados e também nas suas notificações."
      />
      <PainelConversas
        turmas={turmas}
        turmaAberta={turma}
        basePath="/dashboard/aluno/conversas"
        userId={sessao.id}
        userName={sessao.name}
        userPapel="aluno"
        podeAvisar={false}
      />
    </div>
  )
}
