import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Presentation, Users2, PlayCircle, GraduationCap, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/Dashboard/LogoutButton'

const STATUS_LABEL: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  encerrada: 'Encerrada',
}

const STATUS_STYLE: Record<string, string> = {
  planejada: 'bg-amber-50 text-amber-700 ring-amber-200',
  em_andamento: 'bg-brand-50 text-brand-700 ring-brand-200',
  encerrada: 'bg-gray-100 text-gray-500 ring-gray-200',
}

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const { data: turmas } = await supabase
    .from('turmas')
    .select('id, nome, descricao, status')
    .eq('professor_id', user.id)
    .order('created_at', { ascending: false })

  const { data: matriculas } = await supabase.from('turma_alunos').select('turma_id')
  const contagemPorTurma = new Map<string, number>()
  for (const m of matriculas ?? []) {
    contagemPorTurma.set(m.turma_id, (contagemPorTurma.get(m.turma_id) ?? 0) + 1)
  }

  const { data: encontros } = await supabase.from('encontros').select('turma_id')
  const encontrosPorTurma = new Map<string, number>()
  for (const e of encontros ?? []) {
    encontrosPorTurma.set(e.turma_id, (encontrosPorTurma.get(e.turma_id) ?? 0) + 1)
  }

  const turmasEmAndamento = (turmas ?? []).filter((t) => t.status === 'em_andamento').length
  const totalAlunos = (turmas ?? []).reduce((soma, t) => soma + (contagemPorTurma.get(t.id) ?? 0), 0)

  const stats = [
    { icon: PlayCircle, value: turmasEmAndamento, label: 'Turmas em andamento', destaque: true },
    { icon: GraduationCap, value: turmas?.length ?? 0, label: 'Turmas ao todo' },
    { icon: Users2, value: totalAlunos, label: 'Alunos ao todo' },
  ]

  const primeiroNome = profile?.name?.split(' ')[0] ?? 'professor'

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 via-white to-white">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-brand-900/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5">
            <Image
              src="/ibau-logo-transparent.png"
              alt="Logo IBAU"
              width={28}
              height={28}
              className="transition-transform duration-500 group-hover:scale-110"
            />
            <span className="font-display font-bold text-gray-900">Escola de Líderes IBAU</span>
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="animate-float-in">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-800 bg-accent-300/25 ring-1 ring-accent-400/40 px-3 py-1.5 rounded-full uppercase tracking-wider mb-3">
            <Presentation className="h-3.5 w-3.5" strokeWidth={2.5} />
            Professor
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Bem-vindo, {primeiroNome}
          </h1>
          <p className="text-gray-500 mt-1.5">Acompanhe as turmas sob sua responsabilidade.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="card-alive card-sheen group p-5 overflow-hidden animate-float-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="icon-pop flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 mb-4 group-hover:from-brand-600 group-hover:to-brand-500 group-hover:text-white group-hover:shadow-glow">
                <stat.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 tabular-nums">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
              {stat.destaque && stat.value > 0 && (
                <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-soft-pulse" />
                  ativo agora
                </span>
              )}
            </div>
          ))}
        </div>

        <h2 className="font-bold text-gray-900 mt-10 mb-4">Suas turmas</h2>

        {turmas && turmas.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {turmas.map((turma, i) => (
              <div
                key={turma.id}
                className="card-alive card-sheen group p-6 overflow-hidden animate-float-in"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />

                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-gray-900 group-hover:text-brand-800 transition-colors">
                    {turma.nome}
                  </h3>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${STATUS_STYLE[turma.status]}`}
                  >
                    {turma.status === 'em_andamento' && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-soft-pulse" />
                    )}
                    {STATUS_LABEL[turma.status]}
                  </span>
                </div>

                {turma.descricao && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{turma.descricao}</p>
                )}

                <div className="flex items-center gap-5 pt-3 border-t border-gray-100 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Users2 className="h-4 w-4 text-brand-600" strokeWidth={2} />
                    <span className="font-semibold text-gray-700 tabular-nums">
                      {contagemPorTurma.get(turma.id) ?? 0}
                    </span>
                    alunos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4 text-brand-600" strokeWidth={2} />
                    <span className="font-semibold text-gray-700 tabular-nums">
                      {encontrosPorTurma.get(turma.id) ?? 0}
                    </span>
                    encontros
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-alive p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
              <Presentation className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <p className="text-gray-700 font-medium">Nenhuma turma atribuída a você ainda.</p>
            <p className="text-sm text-gray-500 mt-1">Fale com a administração.</p>
          </div>
        )}

        <div className="card-alive group mt-8 p-8 overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
          <div className="flex items-start gap-4">
            <span className="icon-pop flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 group-hover:from-brand-600 group-hover:to-brand-500 group-hover:text-white">
              <ClipboardList className="h-6 w-6" strokeWidth={1.85} />
            </span>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Chamada e vídeo aulas</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Em breve você vai fazer a lista de chamada e publicar o conteúdo das vídeo aulas de
                cada turma diretamente por aqui.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
