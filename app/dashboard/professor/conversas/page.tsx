import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader } from '@/components/ui'
import PainelConversas, { type TurmaDoChat } from '@/components/Chat/PainelConversas'

export const dynamic = 'force-dynamic'

export default async function ConversasProfessorPage({
  searchParams,
}: {
  searchParams: Promise<{ turma?: string }>
}) {
  const { turma } = await searchParams
  const sessao = await exigirSessao()
  const supabase = await createClient()

  // Admin conversa em qualquer turma; professor, nas dele.
  const consulta = supabase
    .from('turmas')
    .select('id, nome, cursos(titulo)')
    .neq('status', 'encerrada')
    .order('nome')

  const { data } =
    sessao.role === 'admin' ? await consulta : await consulta.eq('professor_id', sessao.id)

  const turmas: TurmaDoChat[] = (data ?? []).map((t) => ({
    id: t.id,
    nome: t.nome,
    curso: (t.cursos as unknown as { titulo?: string } | null)?.titulo ?? null,
  }))

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Conversas"
        descricao="Converse com cada turma. O megafone envia a mensagem como aviso: destacada para todos e notificada a cada aluno."
      />
      <PainelConversas
        turmas={turmas}
        turmaAberta={turma}
        basePath="/dashboard/professor/conversas"
        userId={sessao.id}
        userName={sessao.name}
        userPapel={sessao.role === 'admin' ? 'admin' : 'professor'}
        podeAvisar
      />
    </div>
  )
}
