import { redirect } from 'next/navigation'
import Image from 'next/image'
import { GraduationCap, Users2, CalendarDays, ClipboardCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/Dashboard/LogoutButton'

const STATUS_LABEL: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  encerrada: 'Encerrada',
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
    .select('turma_id, turmas(id, nome, status, users(name))')
    .eq('aluno_id', user.id)

  const turmas = (matriculas ?? []).map((m) => {
    const turma = m.turmas as unknown as {
      id?: string
      nome?: string
      status?: string
      users?: { name?: string } | null
    } | null
    return {
      id: turma?.id as string,
      nome: turma?.nome as string,
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

  const presencasDaTurma = (presencas ?? []).filter((p) => {
    const encontro = p.encontros as unknown as { turma_id?: string } | null
    return encontro?.turma_id === turmaAtiva?.id
  })
  const totalEncontros = presencasDaTurma.length
  const totalPresencas = presencasDaTurma.filter((p) => p.presente).length

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
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 ring-1 ring-blue-200 px-2.5 py-1 rounded-full uppercase tracking-wide">
            <GraduationCap className="h-3.5 w-3.5" strokeWidth={2.5} />
            Aluno
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Bem-vindo, {profile?.name?.split(' ')[0] ?? 'aluno'}
        </h1>
        <p className="text-gray-500 mt-1.5">
          Acompanhe sua turma, seus encontros e sua frequência na Escola de Líderes.
        </p>

        {turmaAtiva ? (
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700 mb-4">
                <Users2 className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="text-lg font-bold text-gray-900">{turmaAtiva.nome}</div>
              <div className="text-sm text-gray-500 mt-0.5">
                {STATUS_LABEL[turmaAtiva.status] ?? turmaAtiva.status}
              </div>
            </div>

            <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700 mb-4">
                <CalendarDays className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="text-lg font-bold text-gray-900">
                {turmaAtiva.professorNome ?? 'A definir'}
              </div>
              <div className="text-sm text-gray-500 mt-0.5">Professor responsável</div>
            </div>

            <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700 mb-4">
                <ClipboardCheck className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="text-lg font-bold text-gray-900">
                {totalPresencas}/{totalEncontros}
              </div>
              <div className="text-sm text-gray-500 mt-0.5">Presenças registradas</div>
            </div>
          </div>
        ) : (
          <div className="mt-8 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-700">
              <GraduationCap className="h-6 w-6" strokeWidth={2} />
            </div>
            <p className="text-gray-500">
              Você ainda não está matriculado em nenhuma turma. Fale com a liderança da sua célula.
            </p>
          </div>
        )}

        <div className="mt-8 bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-8">
          <p className="text-gray-500 text-sm leading-relaxed">
            Em breve: aqui você vai poder assistir às vídeo aulas de cada módulo, acompanhar seu
            progresso e emitir seu certificado ao concluir a formação.
          </p>
        </div>
      </div>
    </div>
  )
}
