import Link from 'next/link'
import { Users2, ArrowRight, GraduationCap, Layers, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CriarTurmaForm from '@/components/Dashboard/CriarTurmaForm'
import type { ModuloEscolhivel } from '@/components/Dashboard/ModuloDaTurma'
import { exigirDados, indicePorId } from '@/lib/consulta'

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

export default async function TurmasPage() {
  const supabase = await createClient()

  // Sem join embutido: o nome do professor vem de uma consulta própria.
  // Ver o porquê em lib/consulta.ts — entre turmas e users existe mais de um
  // caminho possível, e o join embutido falhava silenciosamente.
  const [resTurmas, resProfessores, resModulos, resAulas] = await Promise.all([
    supabase
      .from('turmas')
      .select('id, nome, descricao, status, data_inicio, professor_id, modulo_id')
      .order('created_at', { ascending: false }),
    // Professor desativado não pode ser escolhido para uma turma nova.
    supabase
      .from('users')
      .select('id, name')
      .eq('role', 'professor')
      .eq('ativo', true)
      .order('name'),
    /* Os módulos existentes, para a turma já NASCER ligada a um deles.
       Antes a turma nascia solta e o vínculo era um segundo passo dentro
       da turma — quem não voltasse lá deixava a turma para sempre sem
       conteúdo, e isso não dá erro em lugar nenhum. */
    supabase
      .from('modulos')
      .select('id, nome, ordem, curso_id, cursos!modulos_curso_id_fkey(titulo)')
      .order('ordem', { ascending: true }),
    supabase.from('aulas').select('modulo_id').not('modulo_id', 'is', null),
  ])

  const turmas = exigirDados(resTurmas, 'as turmas')
  const professores = exigirDados(resProfessores, 'os professores')
  const nomePorId = indicePorId(professores)

  const aulasPorModulo = new Map<string, number>()
  for (const a of resAulas.data ?? []) {
    const k = a.modulo_id as string
    aulasPorModulo.set(k, (aulasPorModulo.get(k) ?? 0) + 1)
  }

  const modulosEscolhiveis: ModuloEscolhivel[] = (resModulos.data ?? []).map((m) => ({
    id: m.id as string,
    nome: m.nome as string,
    ordem: Number(m.ordem),
    cursoId: (m.curso_id as string) ?? '',
    cursoTitulo: (m.cursos as unknown as { titulo?: string } | null)?.titulo ?? 'Sem curso',
    aulas: aulasPorModulo.get(m.id as string) ?? 0,
  }))

  const moduloPorId = new Map(modulosEscolhiveis.map((m) => [m.id, m]))

  // Conta matrículas por turma
  const matriculas = exigirDados(
    await supabase.from('turma_alunos').select('turma_id'),
    'as matrículas'
  ) as { turma_id: string }[]
  const contagemPorTurma = new Map<string, number>()
  for (const m of matriculas) {
    contagemPorTurma.set(m.turma_id, (contagemPorTurma.get(m.turma_id) ?? 0) + 1)
  }

  return (
    <div className="p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Turmas</h1>
          <p className="text-gray-500 mt-1">Crie, inicie e acompanhe as turmas da escola.</p>
        </div>
      </div>

      <div className="mb-2">
        <CriarTurmaForm professores={professores ?? []} modulos={modulosEscolhiveis} />
      </div>

      {turmas && turmas.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {turmas.map((turma) => {
            const professorNome = turma.professor_id
              ? nomePorId.get(turma.professor_id)?.name
              : undefined
            /* A que curso-módulo esta turma pertence, no próprio cartão.
               Sem isso, "Turma 2026.2" e "Turma 2026.2 noite" na mesma
               lista são indistinguíveis — e a turma que ficou sem módulo
               parece igual às outras até alguém abrir. */
            const mod = turma.modulo_id ? moduloPorId.get(turma.modulo_id as string) : undefined
            return (
              <Link
                key={turma.id}
                href={`/dashboard/admin/turmas/${turma.id}`}
                className="group card-alive card-sheen p-5 flex flex-col overflow-hidden"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />

                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="font-semibold text-gray-900 leading-snug transition-colors duration-300 group-hover:text-brand-800">
                    {turma.nome}
                  </h2>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${STATUS_STYLE[turma.status]}`}
                  >
                    {turma.status === 'em_andamento' && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-soft-pulse" />
                    )}
                    {STATUS_LABEL[turma.status]}
                  </span>
                </div>
                {mod ? (
                  <p className="mb-3 flex items-start gap-1.5 text-[12.5px] leading-snug text-gray-500">
                    <Layers className="mt-px h-3.5 w-3.5 shrink-0 text-brand-600" strokeWidth={2.2} />
                    <span className="min-w-0">
                      <span className="font-semibold text-gray-700">{mod.cursoTitulo}</span>
                      {' · '}
                      {mod.ordem}. {mod.nome}
                    </span>
                  </p>
                ) : (
                  <p className="mb-3 flex items-center gap-1.5 text-[12.5px] font-medium text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                    Sem módulo — esta turma não tem aulas
                  </p>
                )}
                {turma.descricao && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{turma.descricao}</p>
                )}
                <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100 text-sm">
                  <span className="text-gray-500">{professorNome ?? 'Sem professor'}</span>
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Users2 className="h-4 w-4" strokeWidth={2} />
                    {contagemPorTurma.get(turma.id) ?? 0}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-brand-700 text-sm font-semibold">
                  Abrir turma
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    strokeWidth={2.25}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="mt-6 card-alive p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <GraduationCap className="h-6 w-6" strokeWidth={2} />
          </div>
          <p className="text-gray-500">Nenhuma turma criada ainda. Comece criando a primeira acima.</p>
        </div>
      )}
    </div>
  )
}
