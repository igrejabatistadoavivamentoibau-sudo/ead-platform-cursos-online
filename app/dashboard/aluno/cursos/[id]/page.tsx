import { notFound } from 'next/navigation'
import { Video } from 'lucide-react'
import Voltar from '@/components/ui/Voltar'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import VisaoDoCurso, {
  type AulaDoCurso,
  type ProgressoAula,
  type JanelaDaAula,
  type ModuloNaTela,
} from '@/components/Cursos/VisaoDoCurso'
import type { MaterialNaTela } from '@/components/Materiais/MateriaisDaAula'
import {
  modulosDoAluno,
  aulaParaAbrir,
  type MatriculaNoModulo,
  type SituacaoNaTurma,
} from '@/lib/modulosDoAluno'
import type { Curso } from '@/lib/cursos'

export default async function CursoDoAlunoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aula?: string }>
}) {
  const { id } = await params
  const { aula: aulaSelecionada } = await searchParams
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: curso } = await supabase.from('cursos').select('*').eq('id', id).single()
  if (!curso) notFound()

  /* ---------- O curso agora é uma sequência de módulos ----------
     A consulta antiga pedia "todas as aulas deste CURSO", ordenadas por
     número. Isso quebrou de três jeitos quando os módulos nasceram:

     - o aluno via, e podia assistir, as aulas dos módulos seguintes;
     - a numeração recomeça em cada módulo, então ordenar por número
       dentro do curso embaralhava tudo (Aula 1 do M1, Aula 1 do M2,
       Aula 2 do M1...);
     - o avanço contava aulas que ele nem tinha permissão de abrir.

     Agora a tela é montada a partir dos módulos, e a ordem das aulas é
     "ordem do módulo, depois número dentro dele". */
  const [{ data: modulos }, { data: aulas }, { data: progressos }, { data: minhasTurmas }] =
    await Promise.all([
      supabase
        .from('modulos')
        .select('id, nome, descricao, ordem')
        .eq('curso_id', id)
        .order('ordem', { ascending: true }),
      supabase
        .from('aulas')
        .select('id, numero, titulo, descricao, video_url, video_path, duracao_minutos, modulo_id')
        .eq('curso_id', id)
        .eq('publicada', true)
        .order('numero', { ascending: true }),
      supabase
        .from('aula_progresso')
        .select('aula_id, concluida, percentual')
        .eq('aluno_id', sessao.id),
      /* Sem filtrar por `status`: a matrícula de quem foi APROVADO vira
         'concluido', e é justamente ela que mantém o módulo aberto para
         ele rever o material que conquistou. */
      supabase
        .from('turma_alunos')
        .select('turma_id, situacao, turmas!inner(id, curso_id, modulo_id)')
        .eq('aluno_id', sessao.id),
    ])

  const turmasDesteCurso = (minhasTurmas ?? [])
    .map((m) => ({
      turmaId: m.turma_id as string,
      situacao: (m.situacao as SituacaoNaTurma) ?? 'cursando',
      turma: m.turmas as unknown as { curso_id?: string; modulo_id?: string | null } | null,
    }))
    .filter((m) => m.turma?.curso_id === id)

  const matriculas: MatriculaNoModulo[] = turmasDesteCurso
    .filter((m) => m.turma?.modulo_id)
    .map((m) => ({ moduloId: m.turma!.modulo_id as string, situacao: m.situacao }))

  const estadoDosModulos = modulosDoAluno(
    (modulos ?? []).map((m) => ({
      id: m.id as string,
      nome: m.nome as string,
      descricao: (m.descricao as string) ?? null,
      ordem: Number(m.ordem),
    })),
    matriculas
  )

  const progressoPorAula = new Map<string, ProgressoAula>(
    (progressos ?? []).map((p) => [
      p.aula_id,
      { concluida: p.concluida as boolean, percentual: Number(p.percentual) },
    ])
  )

  const todasAsAulas = (aulas ?? []).map((a) => ({
    ...(a as unknown as AulaDoCurso),
    moduloId: (a.modulo_id as string) ?? null,
  }))

  const gruposDeModulo: ModuloNaTela[] = estadoDosModulos.map((m) => ({
    ...m,
    aulas: todasAsAulas
      .filter((a) => a.moduloId === m.id)
      .sort((x, y) => x.numero - y.numero) as AulaDoCurso[],
  }))

  const abertos = new Set(gruposDeModulo.filter((g) => g.aberto).map((g) => g.id))
  const disponiveis = gruposDeModulo.filter((g) => g.aberto).flatMap((g) => g.aulas)

  /* ---------- A janela de cada aula NESTA turma ----------
     A aula é do curso, mas a data de abrir e fechar é da turma. O aluno
     pode estar em mais de uma turma do mesmo módulo (repetindo, por
     exemplo); nesse caso vale a MAIS PERMISSIVA — se ele tem direito de
     assistir por algum caminho, ele tem direito. É a mesma regra do banco:
     as duas precisam concordar, senão a tela diz uma coisa e o servidor
     faz outra. */
  const idsDeTurmaAtivas = turmasDesteCurso
    .filter((m) => m.situacao === 'cursando')
    .map((m) => m.turmaId)

  const [{ data: janelasBanco }, { data: pedidos }] = await Promise.all([
    idsDeTurmaAtivas.length
      ? supabase
          .from('aula_turma')
          .select('turma_id, aula_id, abre_em, vence_em')
          .in('turma_id', idsDeTurmaAtivas)
      : Promise.resolve({ data: [] }),
    idsDeTurmaAtivas.length
      ? supabase
          .from('liberacoes_de_aula')
          .select('turma_id, aula_id, status, resposta, libera_ate')
          .in('turma_id', idsDeTurmaAtivas)
          .eq('aluno_id', sessao.id)
      : Promise.resolve({ data: [] }),
  ])

  const agora = Date.now()
  const janelas = new Map<string, JanelaDaAula>()
  for (const j of janelasBanco ?? []) {
    const aulaId = j.aula_id as string
    const p = (pedidos ?? []).find((x) => x.aula_id === aulaId && x.turma_id === j.turma_id)
    const liberada =
      p?.status === 'liberada' &&
      (!p.libera_ate || agora <= new Date(p.libera_ate as string).getTime())

    const nova: JanelaDaAula = {
      turmaId: j.turma_id as string,
      abre_em: (j.abre_em as string) ?? null,
      vence_em: (j.vence_em as string) ?? null,
      pedido: (p?.status as JanelaDaAula['pedido']) ?? 'nenhum',
      respostaDoProfessor: (p?.resposta as string) ?? null,
      liberada: !!liberada,
    }

    // Mais de uma turma com a mesma aula: fica a que deixa assistir.
    const jaTem = janelas.get(aulaId)
    if (!jaTem || nova.liberada) janelas.set(aulaId, nova)
  }

  if (disponiveis.length === 0) {
    const semNada = todasAsAulas.length === 0
    return (
      <div className="p-5 sm:p-8">
        <Voltar
          href="/dashboard/aluno/cursos"
          label="Meus cursos"
          titulo={curso.titulo}
          margem="mb-4"
        />
        <div className="card-alive p-14 text-center max-w-lg mx-auto">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <Video className="h-8 w-8" strokeWidth={1.6} />
          </div>
          <p className="text-gray-800 font-semibold">
            {semNada ? 'Nenhuma aula publicada ainda.' : 'Nenhuma aula liberada para você ainda.'}
          </p>
          <p className="text-sm text-gray-500 mt-1.5">
            {semNada
              ? 'Assim que o professor publicar a primeira aula deste curso, ela aparece aqui.'
              : 'As aulas aparecem quando a secretaria colocar você numa turma de um dos módulos.'}
          </p>
        </div>
      </div>
    )
  }

  /* `?aula=` é da barra de endereço, então é CONFERIDO e não obedecido:
     sem isso, colar o endereço de uma aula do Módulo 3 abriria o vídeo
     para quem nem entrou no Módulo 1, e o cadeado viraria enfeite. */
  const atual = aulaParaAbrir(
    todasAsAulas,
    estadoDosModulos,
    (aulaId) => progressoPorAula.get(aulaId)?.concluida === true,
    aulaSelecionada
  ) as AulaDoCurso & { moduloId: string | null }

  /* Módulo já aprovado não tem mais janela: ela existe para organizar quem
     está cursando. Trancar o material de quem passou seria tirar dele algo
     que ele conquistou. */
  const aprovados = new Set(
    gruposDeModulo.filter((g) => g.estado === 'aprovado').map((g) => g.id)
  )
  for (const a of todasAsAulas) {
    if (a.moduloId && aprovados.has(a.moduloId)) janelas.delete(a.id)
    if (a.moduloId && !abertos.has(a.moduloId)) janelas.delete(a.id)
  }

  /* O resumo e o material da aula aberta saem JUNTOS: nenhum dos dois
     depende do outro, e pedir um de cada vez seria uma ida à rede a mais
     na frente da pessoa. */
  const [{ data: resumo }, { data: materiaisBanco }] = await Promise.all([
    supabase
      .from('resumos_aula')
      .select('texto, feedback')
      .eq('aula_id', atual.id)
      .eq('aluno_id', sessao.id)
      .maybeSingle(),
    supabase
      .from('materiais')
      .select('id, titulo, descricao, tipo, formato, tamanho')
      .eq('aula_id', atual.id)
      .eq('publicado', true)
      .order('ordem', { ascending: true }),
  ])

  const materiais: MaterialNaTela[] = (materiaisBanco ?? []).map((m) => ({
    id: m.id as string,
    titulo: m.titulo as string,
    descricao: (m.descricao as string) ?? null,
    tipo: m.tipo as 'arquivo' | 'link',
    formato: (m.formato as string) ?? null,
    tamanho: m.tamanho === null ? null : Number(m.tamanho),
  }))

  return (
    <div className="p-5 sm:p-8">
      <Voltar
        href="/dashboard/aluno/cursos"
        label="Meus cursos"
        titulo={curso.titulo}
        margem="mb-4"
      />

      <VisaoDoCurso
        curso={curso as Curso}
        aulas={disponiveis}
        modulos={gruposDeModulo}
        aulaAtual={atual}
        progressoPorAula={progressoPorAula}
        janelas={janelas}
        materiais={materiais}
        hrefAula={(aulaId) => `/dashboard/aluno/cursos/${id}?aula=${aulaId}`}
        resumo={
          resumo
            ? { texto: resumo.texto as string, feedback: (resumo.feedback as string) ?? null }
            : undefined
        }
      />
    </div>
  )
}
