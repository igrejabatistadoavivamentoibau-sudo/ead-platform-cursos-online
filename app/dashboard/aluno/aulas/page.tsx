import { redirect } from 'next/navigation'

/** Tela desativada: o aluno acessa as aulas por dentro de cada curso. */
export default async function AulasDoAlunoPage() {
  redirect('/dashboard/aluno/cursos')
}
