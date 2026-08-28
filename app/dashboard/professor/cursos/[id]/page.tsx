import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BookOpenText, Users2, Eye } from 'lucide-react'
import Voltar from '@/components/ui/Voltar'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import type { AulaItem } from '@/components/Aulas/LinhaDaAula'
import type { MaterialNaTela } from '@/components/Materiais/MateriaisDaAula'
import ConteudoDoCurso, { type ModuloComAulas } from '@/components/Cursos/ConteudoDoCurso'
import { MODALIDADE, type ModalidadeCurso } from '@/lib/cursos'
import { Selo } from '@/components/ui'

export default async function CursoProfessorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sessao = await exigirPermissao('gerenciar_aulas')
  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id, titulo, subtitulo, modalidade')
    .eq('id', id)
    .single()

  if (!curso) notFound()

  // Professor só abre curso que ele leciona em alguma turma.
  if (sessao.role !== 'admin') {
    const { count } = await supabase
      .from('turmas')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', id)
      .eq('professor_id', sessao.id)
    if (!count) redirect('/dashboard/professor')
  }

  const [{ data: aulas }, { data: turmas }, { data: modulos }, { data: disciplinas }] =
    await Promise.all([
    supabase
      .from('aulas')
      .select('id, numero, titulo, descricao, video_url, duracao_minutos, publicada, modulo_id, disciplina_id')
      .eq('curso_id', id)
      .order('numero', { ascending: true }),
    supabase.from('turmas').select('id, modulo_id').eq('curso_id', id),
    /* Os módulos são a forma da tela: a aula mora dentro de um deles. O
       professor não reorganiza módulos — isso é da coordenação —, mas ele
       CRIA aula, e aula sem módulo é aula que o aluno nunca vê. */
    supabase
      .from('modulos')
      .select('id, nome, descricao, ordem, video_boas_vindas')
      .eq('curso_id', id)
      .order('ordem', { ascending: true }),
    /* As matérias de cada módulo, numa consulta só para o curso inteiro. */
    supabase
      .from('disciplinas')
      .select('id, nome, ordem, padrao, modulo_id, modulos!disciplinas_modulo_id_fkey!inner(curso_id)')
      .eq('modulos.curso_id', id)
      .order('ordem', { ascending: true }),
  ])

  const turmasPorModulo = new Map<string, number>()
  for (const t of turmas ?? []) {
    const k = (t.modulo_id as string) ?? ''
    if (k) turmasPorModulo.set(k, (turmasPorModulo.get(k) ?? 0) + 1)
  }

  const idsTurmas = (turmas ?? []).map((t) => t.id)
  const idsAulas = (aulas ?? []).map((a) => a.id)

  const [{ data: matriculas }, { data: progresso }] = await Promise.all([
    idsTurmas.length
      ? supabase.from('turma_alunos').select('turma_id').in('turma_id', idsTurmas)
      : Promise.resolve({ data: [] as { turma_id: string }[] }),
    idsAulas.length
      ? supabase
          .from('aula_progresso')
          .select('aula_id, concluida')
          .in('aula_id', idsAulas)
          .eq('concluida', true)
      : Promise.resolve({ data: [] as { aula_id: string }[] }),
  ])

  const concluidasPorAula = new Map<string, number>()
  for (const p of progresso ?? []) {
    concluidasPorAula.set(p.aula_id, (concluidasPorAula.get(p.aula_id) ?? 0) + 1)
  }

  /* O material de apoio de cada aula. Uma consulta só para todas as aulas,
     e não uma por aula: numa tela com 20 aulas isso seriam 20 idas à rede
     em fila só para desenhar a lista. */
  const { data: materiaisBanco } = idsAulas.length
    ? await supabase
        .from('materiais')
        .select('id, aula_id, titulo, descricao, tipo, formato, tamanho')
        .in('aula_id', idsAulas)
        .order('ordem', { ascending: true })
    : {
        data: [] as {
          id: string
          aula_id: string
          titulo: string
          descricao: string | null
          tipo: string
          formato: string | null
          tamanho: number | null
        }[],
      }

  const materiaisPorAula = new Map<string, MaterialNaTela[]>()
  for (const m of materiaisBanco ?? []) {
    const k = m.aula_id as string
    materiaisPorAula.set(k, [
      ...(materiaisPorAula.get(k) ?? []),
      {
        id: m.id as string,
        titulo: m.titulo as string,
        descricao: (m.descricao as string) ?? null,
        tipo: m.tipo as 'arquivo' | 'link',
        formato: (m.formato as string) ?? null,
        tamanho: m.tamanho === null ? null : Number(m.tamanho),
      },
    ])
  }

  const lista: AulaItem[] = (aulas ?? []).map((a) => ({
    ...a,
    concluidas: concluidasPorAula.get(a.id) ?? 0,
    materiais: materiaisPorAula.get(a.id as string) ?? [],
  }))

  const arvore: ModuloComAulas[] = (modulos ?? []).map((m) => {
    const doModulo = lista
      .filter((a) => a.modulo_id === m.id)
      .sort((a, b) => a.numero - b.numero)

    return {
      id: m.id as string,
      nome: m.nome as string,
      descricao: (m.descricao as string) ?? null,
      ordem: Number(m.ordem),
      turmas: turmasPorModulo.get(m.id as string) ?? 0,
      video_boas_vindas: (m.video_boas_vindas as string) ?? null,
      disciplinas: (disciplinas ?? [])
        .filter((d) => d.modulo_id === m.id)
        .map((d) => ({
          id: d.id as string,
          nome: d.nome as string,
          ordem: Number(d.ordem),
          padrao: Boolean(d.padrao),
          aulas: doModulo.filter((a) => a.disciplina_id === d.id),
        })),
      aulas: doModulo,
    }
  })

  const semModulo = lista.filter((a) => !a.modulo_id)

  const modalidade = MODALIDADE[(curso.modalidade as ModalidadeCurso) ?? 'ead']

  return (
    <div className="p-5 sm:p-8">
      <Voltar
        href="/dashboard/professor"
        label="Minhas turmas"
        titulo={curso.titulo}
        margem="mb-4"
      />

      <div className="mb-7 flex flex-wrap items-start justify-between gap-4 animate-float-in">
        <div className="min-w-0">
        <div className="mb-2">
          <Selo tom={modalidade.tom} icone={modalidade.icone}>
            {modalidade.label}
          </Selo>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{curso.titulo}</h1>
        <p className="text-gray-500 mt-1.5">
          {curso.subtitulo || modalidade.descricao}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-sm text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <BookOpenText className="h-4 w-4 text-brand-600" strokeWidth={2} />
            <span className="font-semibold text-gray-700 tabular-nums">{lista.length}</span> aulas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users2 className="h-4 w-4 text-brand-600" strokeWidth={2} />
            <span className="font-semibold text-gray-700 tabular-nums">
              {matriculas?.length ?? 0}
            </span>{' '}
            alunos
          </span>
        </div>
        </div>

        <Link
          href={`/dashboard/professor/cursos/${id}/preview`}
          className="group inline-flex items-center gap-2 rounded-lg bg-white ring-1 ring-gray-200 px-3.5 py-2 text-[13px] font-semibold text-gray-700 transition-all hover:ring-brand-300 hover:text-brand-800 active:scale-[0.98]"
        >
          <Eye className="h-4 w-4 text-brand-600" strokeWidth={2.25} />
          Ver como aluno
        </Link>
      </div>

      {/* Módulo → suas aulas. O botão de nova aula e o de aula gravada
          ficam DENTRO da seção do módulo: é assim que o professor sabe
          onde a aula vai parar sem preencher um campo "módulo". */}
      <ConteudoDoCurso
        cursoId={id}
        modulos={arvore}
        semModulo={semModulo}
        totalAlunos={matriculas?.length ?? 0}
        podeEditarModulos={false}
      />
    </div>
  )
}
