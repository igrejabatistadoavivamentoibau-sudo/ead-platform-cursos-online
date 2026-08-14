import Link from 'next/link'
import {
  GraduationCap,
  Users2,
  PlayCircle,
  ArrowRight,
  UserCog,
  Images,
  ClipboardCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function AdminOverview() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: profile },
    { count: totalTurmas },
    { count: turmasAtivas },
    { count: totalAlunos },
    { count: totalProfessores },
    { data: turmasRecentes },
  ] = await Promise.all([
    supabase.from('users').select('name').eq('id', user!.id).single(),
    supabase.from('turmas').select('id', { count: 'exact', head: true }),
    supabase.from('turmas').select('id', { count: 'exact', head: true }).eq('status', 'em_andamento'),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'aluno'),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'professor'),
    supabase
      .from('turmas')
      .select('id, nome, status')
      .order('created_at', { ascending: false })
      .limit(4),
  ])

  const stats = [
    {
      label: 'Turmas em andamento',
      value: turmasAtivas ?? 0,
      icon: PlayCircle,
      tone: 'from-brand-600 to-brand-500',
      destaque: true,
    },
    { label: 'Turmas ao todo', value: totalTurmas ?? 0, icon: GraduationCap, tone: 'from-brand-700 to-brand-600' },
    { label: 'Alunos cadastrados', value: totalAlunos ?? 0, icon: Users2, tone: 'from-teal-600 to-brand-500' },
    { label: 'Professores', value: totalProfessores ?? 0, icon: UserCog, tone: 'from-brand-800 to-brand-600' },
  ]

  const atalhos = [
    {
      href: '/dashboard/admin/turmas',
      titulo: 'Gerenciar turmas',
      descricao: 'Criar turma, iniciar, matricular alunos e fazer a chamada.',
      icon: ClipboardCheck,
      principal: true,
    },
    {
      href: '/dashboard/admin/usuarios',
      titulo: 'Gerenciar usuários',
      descricao: 'Criar contas de aluno e professor, trocar senhas.',
      icon: Users2,
    },
    {
      href: '/dashboard/admin/carrossel',
      titulo: 'Fotos da capa',
      descricao: 'Trocar as fotos que passam na página inicial.',
      icon: Images,
    },
  ]

  const STATUS_STYLE: Record<string, string> = {
    planejada: 'bg-amber-50 text-amber-700 ring-amber-200',
    em_andamento: 'bg-brand-50 text-brand-700 ring-brand-200',
    encerrada: 'bg-gray-100 text-gray-500 ring-gray-200',
  }
  const STATUS_LABEL: Record<string, string> = {
    planejada: 'Planejada',
    em_andamento: 'Em andamento',
    encerrada: 'Encerrada',
  }

  return (
    <div className="p-5 sm:p-8">
      <div className="animate-float-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Bem-vindo, {profile?.name?.split(' ')[0] ?? 'Administrador'}
        </h1>
        <p className="text-gray-500 mt-1.5">
          Painel soberano da Escola de Líderes IBAU — crie turmas, faça chamada e gerencie contas.
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="card-alive card-sheen group overflow-hidden p-5 animate-float-in"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div
              className={`icon-pop flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${stat.tone} text-white mb-4 shadow-glow`}
            >
              <stat.icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="text-3xl font-extrabold text-gray-900 tabular-nums">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-0.5 leading-snug">{stat.label}</div>
            {stat.destaque && (stat.value as number) > 0 && (
              <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-soft-pulse" />
                ativo agora
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Atalhos */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {atalhos.map((atalho, i) => (
          <Link
            key={atalho.href}
            href={atalho.href}
            className={`group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 animate-float-in ${
              atalho.principal
                ? 'bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white shadow-glow hover:shadow-deep'
                : 'card-alive'
            }`}
            style={{ animationDelay: `${(i + 4) * 70}ms` }}
          >
            {atalho.principal && (
              <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-white/10 blur-2xl transition-transform duration-700 group-hover:scale-150" />
            )}

            <div
              className={`icon-pop relative flex h-11 w-11 items-center justify-center rounded-xl mb-4 ${
                atalho.principal
                  ? 'bg-white/20 text-white'
                  : 'bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 group-hover:from-brand-600 group-hover:to-brand-500 group-hover:text-white'
              }`}
            >
              <atalho.icon className="h-5 w-5" strokeWidth={2} />
            </div>

            <h2
              className={`relative font-bold text-lg mb-1 ${
                atalho.principal ? 'text-white' : 'text-gray-900 group-hover:text-brand-800'
              }`}
            >
              {atalho.titulo}
            </h2>
            <p
              className={`relative text-sm leading-relaxed ${
                atalho.principal ? 'text-brand-50/90' : 'text-gray-500'
              }`}
            >
              {atalho.descricao}
            </p>

            <span
              className={`relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold ${
                atalho.principal ? 'text-white' : 'text-brand-700'
              }`}
            >
              Abrir
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2.25}
              />
            </span>
          </Link>
        ))}
      </div>

      {/* Turmas recentes */}
      {turmasRecentes && turmasRecentes.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Turmas recentes</h2>
            <Link
              href="/dashboard/admin/turmas"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              Ver todas
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2.25}
              />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {turmasRecentes.map((turma) => (
              <Link
                key={turma.id}
                href={`/dashboard/admin/turmas/${turma.id}`}
                className="card-alive group p-5"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-brand-800 transition-colors">
                    {turma.nome}
                  </h3>
                </div>
                <span
                  className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${
                    STATUS_STYLE[turma.status]
                  }`}
                >
                  {STATUS_LABEL[turma.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
