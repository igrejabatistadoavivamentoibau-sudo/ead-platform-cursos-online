import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  GraduationCap,
  Users2,
  UserRound,
  ClipboardCheck,
  CalendarDays,
  PlayCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/Dashboard/LogoutButton'

const STATUS_LABEL: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  encerrada: 'Encerrada',
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export default async function StudentDashboard() {
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

  const { data: matriculas } = await supabase
    .from('turma_alunos')
    .select('turma_id, turmas(id, nome, descricao, status, users(name))')
    .eq('aluno_id', user.id)

  const turmas = (matriculas ?? []).map((m) => {
    const turma = m.turmas as unknown as {
      id?: string
      nome?: string
      descricao?: string
      status?: string
      users?: { name?: string } | null
    } | null
    return {
      id: turma?.id as string,
      nome: turma?.nome as string,
      descricao: turma?.descricao as string | undefined,
      status: turma?.status as string,
      professorNome: turma?.users?.name as string | undefined,
    }
  })

  const turmaAtiva = turmas.find((t) => t.status === 'em_andamento') ?? turmas[0]

  const { data: presencas } = turmaAtiva
    ? await supabase
        .from('presencas')
        .select('presente, encontros(data, titulo, turma_id)')
        .eq('aluno_id', user.id)
    : { data: null }

  const presencasDaTurma = (presencas ?? [])
    .map((p) => ({
      presente: p.presente as boolean,
      encontro: p.encontros as unknown as {
        data?: string
        titulo?: string
        turma_id?: string
      } | null,
    }))
    .filter((p) => p.encontro?.turma_id === turmaAtiva?.id)

  const totalEncontros = presencasDaTurma.length
  const totalPresencas = presencasDaTurma.filter((p) => p.presente).length
  const frequencia = totalEncontros > 0 ? Math.round((totalPresencas / totalEncontros) * 100) : 0

  const ultimosEncontros = [...presencasDaTurma]
    .sort((a, b) => (b.encontro?.data ?? '').localeCompare(a.encontro?.data ?? ''))
    .slice(0, 5)

  const primeiroNome = profile?.name?.split(' ')[0] ?? 'aluno'

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
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-700 bg-brand-50 ring-1 ring-brand-200 px-3 py-1.5 rounded-full uppercase tracking-wider mb-3">
            <GraduationCap className="h-3.5 w-3.5" strokeWidth={2.5} />
            Aluno
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Bem-vindo, {primeiroNome}
          </h1>
          <p className="text-gray-500 mt-1.5">
            Acompanhe sua turma, seus encontros e sua frequência na Escola de Líderes.
          </p>
        </div>

        {turmaAtiva ? (
          <>
            {/* Cartão principal da turma */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 p-6 sm:p-8 mt-8 shadow-glow animate-float-in">
              <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_85%,rgba(0,0,0,0.18),transparent_50%)]" />

              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-brand-100/80 text-sm font-medium mb-1">Sua turma</p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">{turmaAtiva.nome}</h2>
                  {turmaAtiva.descricao && (
                    <p className="text-brand-50/85 mt-2 text-[15px]">{turmaAtiva.descricao}</p>
                  )}
                </div>
                <span className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25">
                  {turmaAtiva.status === 'em_andamento' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-300 animate-soft-pulse" />
                  )}
                  {STATUS_LABEL[turmaAtiva.status] ?? turmaAtiva.status}
                </span>
              </div>

              {/* Barra de frequência */}
              <div className="relative mt-7">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-brand-100/90 font-medium">Sua frequência</span>
                  <span className="text-white font-bold tabular-nums">{frequencia}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-200 to-white animate-grow-bar"
                    style={{ width: `${frequencia}%` }}
                  />
                </div>
                <p className="text-brand-100/70 text-xs mt-2">
                  {totalPresencas} presença{totalPresencas === 1 ? '' : 's'} em {totalEncontros}{' '}
                  encontro{totalEncontros === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* Indicadores */}
            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              {[
                {
                  icon: UserRound,
                  valor: turmaAtiva.professorNome ?? 'A definir',
                  label: 'Professor responsável',
                  pequeno: true,
                },
                { icon: ClipboardCheck, valor: `${totalPresencas}/${totalEncontros}`, label: 'Presenças registradas' },
                { icon: CalendarDays, valor: String(totalEncontros), label: 'Encontros até agora' },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className="card-alive card-sheen group p-5 overflow-hidden animate-float-in"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="icon-pop flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 mb-4 group-hover:from-brand-600 group-hover:to-brand-500 group-hover:text-white group-hover:shadow-glow">
                    <item.icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div
                    className={`font-bold text-gray-900 ${item.pequeno ? 'text-lg leading-snug' : 'text-2xl tabular-nums'}`}
                  >
                    {item.valor}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>

            {/* Histórico de encontros */}
            {ultimosEncontros.length > 0 && (
              <div className="mt-8">
                <h2 className="font-bold text-gray-900 mb-4">Últimos encontros</h2>
                <div className="card-alive divide-y divide-gray-100 overflow-hidden">
                  {ultimosEncontros.map((p, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          p.presente
                            ? 'bg-brand-50 text-brand-600'
                            : 'bg-red-50 text-red-500'
                        }`}
                      >
                        <ClipboardCheck className="h-4 w-4" strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {p.encontro?.titulo || 'Encontro'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {p.encontro?.data ? formatarData(p.encontro.data) : ''}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${
                          p.presente
                            ? 'bg-brand-50 text-brand-700 ring-brand-200'
                            : 'bg-red-50 text-red-600 ring-red-200'
                        }`}
                      >
                        {p.presente ? 'Presente' : 'Ausente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card-alive p-12 text-center mt-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
              <GraduationCap className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <p className="text-gray-700 font-medium">
              Você ainda não está matriculado em nenhuma turma.
            </p>
            <p className="text-sm text-gray-500 mt-1">Fale com a liderança da sua célula.</p>
          </div>
        )}

        {/* Vídeo aulas — em preparação */}
        <div className="card-alive group mt-8 p-8 overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
          <div className="flex items-start gap-4">
            <span className="icon-pop flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 group-hover:from-brand-600 group-hover:to-brand-500 group-hover:text-white">
              <PlayCircle className="h-6 w-6" strokeWidth={1.85} />
            </span>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Vídeo aulas</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Em breve você vai assistir às aulas de cada módulo por aqui, acompanhar seu progresso
                e emitir seu certificado ao concluir a formação.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
