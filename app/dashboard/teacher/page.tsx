import { redirect } from 'next/navigation'
import Image from 'next/image'
import { Presentation, Users2, PlayCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/Dashboard/LogoutButton'

const STATUS_LABEL: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  encerrada: 'Encerrada',
}

const STATUS_STYLE: Record<string, string> = {
  planejada: 'bg-amber-50 text-amber-700 ring-amber-200',
  em_andamento: 'bg-green-50 text-green-700 ring-green-200',
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
    .select('id, nome, status')
    .eq('professor_id', user.id)
    .order('created_at', { ascending: false })

  const { data: matriculas } = await supabase.from('turma_alunos').select('turma_id')
  const contagemPorTurma = new Map<string, number>()
  for (const m of matriculas ?? []) {
    contagemPorTurma.set(m.turma_id, (contagemPorTurma.get(m.turma_id) ?? 0) + 1)
  }

  const turmasEmAndamento = (turmas ?? []).filter((t) => t.status === 'em_andamento').length
  const totalAlunos = (turmas ?? []).reduce((soma, t) => soma + (contagemPorTurma.get(t.id) ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/ibau-logo-transparent.png" alt="Logo IBAU" width={28} height={28} />
            <span className="font-bold text-gray-900">Escola de Líderes IBAU</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-purple-700 bg-purple-50 ring-1 ring-purple-200 px-2.5 py-1 rounded-full uppercase tracking-wide">
            <Presentation className="h-3.5 w-3.5" strokeWidth={2.5} />
            Professor
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Bem-vindo, {profile?.name?.split(' ')[0] ?? 'professor'}
        </h1>
        <p className="text-gray-500 mt-1.5">Acompanhe as turmas sob sua responsabilidade.</p>

        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700 mb-4">
              <PlayCircle className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{turmasEmAndamento}</div>
            <div className="text-sm text-gray-500 mt-0.5">Turmas em andamento</div>
          </div>
          <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700 mb-4">
              <Presentation className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{turmas?.length ?? 0}</div>
            <div className="text-sm text-gray-500 mt-0.5">Turmas ao todo</div>
          </div>
          <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700 mb-4">
              <Users2 className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalAlunos}</div>
            <div className="text-sm text-gray-500 mt-0.5">Alunos ao todo</div>
          </div>
        </div>

        <h2 className="font-semibold text-gray-900 mt-10 mb-4">Suas turmas</h2>

        {turmas && turmas.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {turmas.map((turma) => (
              <div key={turma.id} className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-gray-900">{turma.nome}</h3>
                  <span
                    className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ring-1 ${STATUS_STYLE[turma.status]}`}
                  >
                    {STATUS_LABEL[turma.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5">
                  <Users2 className="h-4 w-4" strokeWidth={2} />
                  {contagemPorTurma.get(turma.id) ?? 0} alunos matriculados
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-700">
              <Presentation className="h-6 w-6" strokeWidth={2} />
            </div>
            <p className="text-gray-500">
              Nenhuma turma atribuída a você ainda. Fale com a administração.
            </p>
          </div>
        )}

        <div className="mt-8 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-8">
          <p className="text-gray-500 text-sm leading-relaxed">
            Em breve: gerenciar a lista de chamada e o conteúdo das vídeo aulas de cada turma
            diretamente por aqui.
          </p>
        </div>
      </div>
    </div>
  )
}
