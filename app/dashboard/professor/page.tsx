import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'
import {
  Presentation,
  Users2,
  PlayCircle,
  GraduationCap,
  ClipboardList,
  ClipboardCheck,
  FileText,
  Video,
  TrendingUp,
  BookOpenText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ParaCorrigir, { type EntregaPendente } from '@/components/Turma/ParaCorrigir'
import { exigirSessao } from '@/lib/auth'
import { Selo } from '@/components/ui'
import HeroPortal from '@/components/Dashboard/HeroPortal'
import { MODALIDADE, type ModalidadeCurso } from '@/lib/cursos'

/** O join do Supabase vem sem tipo forte; lemos a modalidade em um lugar só. */
function modalidadeDaTurma(turma: { cursos?: unknown }): ModalidadeCurso {
  const c = turma.cursos as { modalidade?: ModalidadeCurso } | null
  return c?.modalidade ?? 'ead'
}

/** Atalho compacto do cartão de turma — mesma forma para todos. */
function AtalhoTurma({
  href,
  icone: Icone,
  children,
  principal = false,
}: {
  href: string
  icone: ComponentType<{ className?: string; strokeWidth?: number }>
  children: ReactNode
  principal?: boolean
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-[0.98] ${
        principal
          ? 'bg-brand-700 text-white hover:bg-brand-800'
          : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-brand-800 hover:ring-brand-300'
      }`}
    >
      <Icone className="h-3.5 w-3.5" strokeWidth={2.1} />
      {children}
    </Link>
  )
}

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

export default async function ProfessorHome() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  // Admin enxerga todas as turmas; professor, apenas as suas.
  const consultaTurmas = supabase
    .from('turmas')
    .select('id, nome, descricao, status, curso_id, cursos(titulo, modalidade)')
    .order('created_at', { ascending: false })

  const { data: turmas } =
    sessao.role === 'admin'
      ? await consultaTurmas
      : await consultaTurmas.eq('professor_id', sessao.id)

  const ids = (turmas ?? []).map((t) => t.id)

  /* Tudo o que depende só das turmas vai JUNTO, numa leva só.
     As atividades estavam numa consulta separada, mais abaixo, esperando
     esta leva terminar para só então começar — e não precisavam: elas
     dependem dos mesmos `ids`. Era uma ida à rede em fila, de graça, em
     toda abertura da tela inicial do professor. */
  const [{ data: matriculas }, { data: encontros }, { data: aulas }, { data: atividadesDasTurmas }] =
    await Promise.all([
      ids.length
        ? supabase.from('turma_alunos').select('turma_id').in('turma_id', ids)
        : Promise.resolve({ data: [] as { turma_id: string }[] }),
      ids.length
        ? supabase.from('encontros').select('turma_id').in('turma_id', ids)
        : Promise.resolve({ data: [] as { turma_id: string }[] }),
      (() => {
        // Aulas agora pertencem ao curso, então contamos por curso e depois
        // mapeamos de volta para cada turma.
        const cursoIds = [...new Set((turmas ?? []).map((t) => t.curso_id).filter(Boolean))]
        return cursoIds.length
          ? supabase.from('aulas').select('curso_id').in('curso_id', cursoIds as string[])
          : Promise.resolve({ data: [] as { curso_id: string }[] })
      })(),
      ids.length
        ? supabase.from('atividades').select('id, titulo, turma_id').in('turma_id', ids)
        : Promise.resolve({ data: [] as { id: string; titulo: string; turma_id: string }[] }),
    ])

  const contar = (lista: { turma_id: string }[] | null) => {
    const m = new Map<string, number>()
    for (const item of lista ?? []) m.set(item.turma_id, (m.get(item.turma_id) ?? 0) + 1)
    return m
  }

  const alunosPorTurma = contar(matriculas)
  const encontrosPorTurma = contar(encontros)

  const aulasPorCurso = new Map<string, number>()
  for (const a of (aulas ?? []) as { curso_id: string }[]) {
    aulasPorCurso.set(a.curso_id, (aulasPorCurso.get(a.curso_id) ?? 0) + 1)
  }
  const aulasDaTurma = (cursoId: string | null) =>
    cursoId ? (aulasPorCurso.get(cursoId) ?? 0) : 0

  /* ---------- O que está esperando correção ----------
     As atividades já vieram na leva acima. Aqui sobram as entregas sem
     nota e os anexos delas, que dependem umas das outras e por isso
     continuam em fila. */
  const idsAtividades = (atividadesDasTurmas ?? []).map((a) => a.id as string)

  const { data: entregasSemNota } = idsAtividades.length
    ? await supabase
        .from('entregas')
        .select('id, atividade_id, entregue_em, users:users!entregas_aluno_id_fkey(name)')
        .in('atividade_id', idsAtividades)
        .is('nota', null)
        // O que esperou mais aparece primeiro: é o aluno que está
        // sofrendo com a demora, e ordenar pelo mais novo esconderia
        // exatamente ele.
        .order('entregue_em', { ascending: true })
        .limit(60)
    : { data: [] as unknown[] }

  const idsPendentes = (entregasSemNota ?? []).map((e) => (e as { id: string }).id)
  const { data: anexosPendentes } = idsPendentes.length
    ? await supabase.from('entrega_arquivos').select('entrega_id').in('entrega_id', idsPendentes)
    : { data: [] as { entrega_id: string }[] }

  const anexosPorEntrega = new Map<string, number>()
  for (const a of anexosPendentes ?? []) {
    const k = a.entrega_id as string
    anexosPorEntrega.set(k, (anexosPorEntrega.get(k) ?? 0) + 1)
  }

  const atividadePorId = new Map(
    (atividadesDasTurmas ?? []).map((a) => [a.id as string, a])
  )
  const nomeDaTurma = new Map((turmas ?? []).map((t) => [t.id as string, t.nome as string]))

  const pendentes: EntregaPendente[] = (entregasSemNota ?? []).map((e) => {
    const linha = e as { id: string; atividade_id: string; entregue_em: string; users: unknown }
    const at = atividadePorId.get(linha.atividade_id)
    const u = linha.users as { name?: string } | null
    return {
      entregaId: linha.id,
      alunoNome: u?.name ?? 'Aluno',
      atividadeTitulo: (at?.titulo as string) ?? 'Atividade',
      turmaId: (at?.turma_id as string) ?? '',
      turmaNome: nomeDaTurma.get((at?.turma_id as string) ?? '') ?? '',
      entregueEm: linha.entregue_em,
      anexos: anexosPorEntrega.get(linha.id) ?? 0,
    }
  })

  const emAndamento = (turmas ?? []).filter((t) => t.status === 'em_andamento').length
  const totalAlunos = (turmas ?? []).reduce((s, t) => s + (alunosPorTurma.get(t.id) ?? 0), 0)

  const stats = [
    { icon: PlayCircle, value: emAndamento, label: 'Turmas em andamento', destaque: true },
    { icon: GraduationCap, value: turmas?.length ?? 0, label: 'Turmas ao todo' },
    { icon: Users2, value: totalAlunos, label: 'Alunos ao todo' },
  ]

  return (
    <div className="p-5 sm:p-8">
      <HeroPortal
        saudacao="Graça e Paz"
        nome={sessao.name}
        frase={
          sessao.role === 'admin'
            ? 'Você está vendo todas as turmas da escola, como administrador.'
            : 'Acompanhe as turmas sob sua responsabilidade.'
        }
        numeros={[
          { valor: emAndamento, label: 'EM ANDAMENTO', vivo: emAndamento > 0 },
          { valor: turmas?.length ?? 0, label: 'TURMAS' },
          { valor: totalAlunos, label: 'ALUNOS' },
        ]}
      />

      {/* A caixa de correções vem ANTES dos números da turma.
          Número de turma é retrato; entrega esperando é trabalho parado.
          O que cobra ação fica em cima. */}
      <div className="mt-6">
        <ParaCorrigir pendentes={pendentes} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="card-alive card-sheen group overflow-hidden p-5 animate-float-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent-500/50 via-accent-500/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="icon-pop mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-700 group-hover:border-brand-700 group-hover:bg-brand-700 group-hover:text-white">
              <stat.icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="font-display text-3xl font-bold tracking-[-0.02em] text-gray-900 tabular-nums">
              {stat.value}
            </div>
            <div className="mt-0.5 text-sm text-gray-500">{stat.label}</div>
            {stat.destaque && stat.value > 0 && (
              <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-soft-pulse" />
                ativo agora
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mb-3.5 mt-7 flex items-center gap-2.5">
        <Presentation className="h-3.5 w-3.5 text-brand-700" strokeWidth={2} />
        <h2 className="micro-rotulo text-[11px] font-extrabold tracking-[0.14em] text-[#41514a]">SUAS TURMAS</h2>
        <span className="h-px flex-1 bg-gradient-to-r from-brand-950/[0.08] to-transparent" />
      </div>

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

              {(() => {
                const c = turma.cursos as unknown as {
                  titulo?: string
                  modalidade?: ModalidadeCurso
                } | null
                if (!c?.titulo) {
                  return (
                    <p className="text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2.5 py-1 inline-block mb-3">
                      Sem curso definido
                    </p>
                  )
                }
                const m = MODALIDADE[c.modalidade ?? 'ead']
                return (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 ring-1 ring-brand-200 rounded-full px-2.5 py-1">
                      <BookOpenText className="h-3.5 w-3.5" strokeWidth={2} />
                      {c.titulo}
                    </span>
                    <Selo tom={m.tom} icone={m.icone}>
                      {m.label}
                    </Selo>
                  </div>
                )
              })()}
              {turma.descricao && (
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{turma.descricao}</p>
              )}

              <div className="flex items-center gap-4 pt-3 border-t border-gray-100 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1.5">
                  <Users2 className="h-4 w-4 text-brand-600" strokeWidth={2} />
                  <span className="font-semibold text-gray-700 tabular-nums">
                    {alunosPorTurma.get(turma.id) ?? 0}
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
                <span className="flex items-center gap-1.5">
                  <Video className="h-4 w-4 text-brand-600" strokeWidth={2} />
                  <span className="font-semibold text-gray-700 tabular-nums">
                    {aulasDaTurma(turma.curso_id)}
                  </span>
                  aulas
                </span>
              </div>

              {/* Atalhos para as áreas da turma. Cada um respeita a permissão
                  que o admin definiu no painel de controle. */}
              <div className="flex flex-wrap items-center gap-1.5">
                {sessao.permissoes.ver_alunos && (
                  <AtalhoTurma
                    href={`/dashboard/professor/turmas/${turma.id}/avanco`}
                    icone={TrendingUp}
                    principal
                  >
                    Avanço
                  </AtalhoTurma>
                )}
                {sessao.permissoes.fazer_chamada && (
                  <AtalhoTurma
                    href={`/dashboard/professor/turmas/${turma.id}/chamada`}
                    icone={ClipboardCheck}
                  >
                    {modalidadeDaTurma(turma) === 'presencial' ? 'Chamada' : 'Frequência'}
                  </AtalhoTurma>
                )}
                {sessao.permissoes.ver_alunos && (
                  <>
                    <AtalhoTurma
                      href={`/dashboard/professor/turmas/${turma.id}/notas`}
                      icone={GraduationCap}
                    >
                      Notas
                    </AtalhoTurma>
                    <AtalhoTurma
                      href={`/dashboard/professor/turmas/${turma.id}/atividades`}
                      icone={FileText}
                    >
                      Atividades
                    </AtalhoTurma>
                  </>
                )}
                {sessao.permissoes.gerenciar_aulas && turma.curso_id && (
                  <AtalhoTurma
                    href={`/dashboard/professor/cursos/${turma.curso_id}`}
                    icone={Video}
                  >
                    Vídeo aulas
                  </AtalhoTurma>
                )}
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
    </div>
  )
}
