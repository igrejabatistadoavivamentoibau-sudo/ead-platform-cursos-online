import Link from 'next/link'
import { GraduationCap, Users2, PlayCircle, ArrowRight, UserCog } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function AdminOverview() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: profile }, { count: totalTurmas }, { count: turmasAtivas }, { count: totalAlunos }, { count: totalProfessores }] =
    await Promise.all([
      supabase.from('users').select('name').eq('id', user!.id).single(),
      supabase.from('turmas').select('id', { count: 'exact', head: true }),
      supabase.from('turmas').select('id', { count: 'exact', head: true }).eq('status', 'em_andamento'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'aluno'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'professor'),
    ])

  const stats = [
    { label: 'Turmas em andamento', value: turmasAtivas ?? 0, icon: PlayCircle },
    { label: 'Turmas ao todo', value: totalTurmas ?? 0, icon: GraduationCap },
    { label: 'Alunos cadastrados', value: totalAlunos ?? 0, icon: Users2 },
    { label: 'Professores cadastrados', value: totalProfessores ?? 0, icon: UserCog },
  ]

  return (
    <div className="p-5 sm:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
        Bem-vinda, {profile?.name?.split(' ')[0] ?? 'Administradora'}
      </h1>
      <p className="text-gray-500 mt-1.5">
        Painel soberano da Escola de Líderes IBAU — crie turmas, faça chamada e gerencie contas sem
        precisar de mais ninguém.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700 mb-4">
              <stat.icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        <Link
          href="/dashboard/admin/turmas"
          className="group flex items-center justify-between bg-green-700 text-white rounded-2xl p-6 hover:bg-green-800 transition-colors shadow-sm"
        >
          <div>
            <h2 className="font-semibold text-lg">Gerenciar turmas</h2>
            <p className="text-green-50/90 text-sm mt-1">
              Criar turma, iniciar, encerrar e fazer a lista de chamada.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <Link
          href="/dashboard/admin/usuarios"
          className="group flex items-center justify-between bg-white ring-1 ring-gray-200 rounded-2xl p-6 hover:ring-green-300 hover:shadow-sm transition-all"
        >
          <div>
            <h2 className="font-semibold text-lg text-gray-900">Gerenciar usuários</h2>
            <p className="text-gray-500 text-sm mt-1">
              Criar contas de aluno/professor e trocar senhas.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  )
}
