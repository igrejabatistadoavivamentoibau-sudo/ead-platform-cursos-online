import { redirect } from 'next/navigation'

/**
 * Tela desativada.
 *
 * As aulas deixaram de pertencer à turma e passaram a pertencer ao curso,
 * então esta página não existe mais. Ela permanece no projeto apenas como
 * redirecionamento, para que qualquer link antigo salvo por alguém continue
 * levando a um lugar válido em vez de dar erro.
 */
export default async function AulasDaTurmaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dashboard/admin/turmas/${id}`)
}
