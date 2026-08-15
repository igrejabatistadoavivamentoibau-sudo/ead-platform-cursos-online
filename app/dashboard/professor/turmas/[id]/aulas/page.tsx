import { redirect } from 'next/navigation'

/** Tela desativada: as aulas agora pertencem ao curso, não à turma. */
export default async function AulasProfessorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dashboard/professor/turmas/${id}/avanco`)
}
