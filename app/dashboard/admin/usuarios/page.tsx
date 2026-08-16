import { Users2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CriarUsuarioForm from '@/components/Dashboard/CriarUsuarioForm'
import UsuarioRow from '@/components/Dashboard/UsuarioRow'

export default async function UsuariosPage() {
  const supabase = await createClient()

  const { data: usuarios } = await supabase
    .from('users')
    .select('id, name, email, role')
    .order('name')

  // Em que turmas cada pessoa está — como aluno (matrícula) ou como
  // professor responsável. Sem isso o painel só dizia nome e papel, e para
  // saber onde alguém estava era preciso abrir turma por turma.
  const [{ data: matriculas }, { data: turmasDoProfessor }] = await Promise.all([
    supabase.from('turma_alunos').select('aluno_id, turmas(nome)'),
    supabase.from('turmas').select('nome, professor_id'),
  ])

  const turmasPorPessoa = new Map<string, string[]>()
  const juntar = (pessoaId: string | null, nome?: string) => {
    if (!pessoaId || !nome) return
    turmasPorPessoa.set(pessoaId, [...(turmasPorPessoa.get(pessoaId) ?? []), nome])
  }
  for (const m of matriculas ?? []) {
    juntar(m.aluno_id, (m.turmas as unknown as { nome?: string } | null)?.nome)
  }
  for (const t of turmasDoProfessor ?? []) juntar(t.professor_id, t.nome)

  return (
    <div className="p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Usuários</h1>
          <p className="text-gray-500 mt-1">Crie contas, redefina senhas e veja em que turmas cada pessoa está.</p>
        </div>
      </div>

      <CriarUsuarioForm />

      <div className="card-alive px-5 sm:px-6">
        {usuarios && usuarios.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {usuarios.map((u) => (
              <UsuarioRow
                key={u.id}
                id={u.id}
                name={u.name}
                email={u.email}
                role={u.role}
                turmas={turmasPorPessoa.get(u.id) ?? []}
              />
            ))}
          </ul>
        ) : (
          <div className="py-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <Users2 className="h-6 w-6" strokeWidth={2} />
            </div>
            <p className="text-gray-500">Nenhum usuário cadastrado ainda.</p>
          </div>
        )}
      </div>
    </div>
  )
}
