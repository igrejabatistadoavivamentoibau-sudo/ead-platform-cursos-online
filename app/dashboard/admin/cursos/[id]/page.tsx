import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Users2, BookOpenText, Clock, GraduationCap, Eye } from 'lucide-react'
import Voltar from '@/components/ui/Voltar'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import CursoForm from '@/components/Cursos/CursoForm'
import CursoAcoes from '@/components/Cursos/CursoAcoes'
import type { AulaItem } from '@/components/Aulas/LinhaDaAula'
import type { MaterialNaTela } from '@/components/Materiais/MateriaisDaAula'
import ConteudoDoCurso, { type ModuloComAulas } from '@/components/Cursos/ConteudoDoCurso'
import MatrizCurricular from '@/components/Cursos/MatrizCurricular'
import type { EstruturaExistente } from '@/lib/nucleo/matrizCurricular'
import {
  corDoCurso,
  urlDaCapa,
  NIVEL_LABEL,
  MODALIDADE,
  type Curso,
  type ModalidadeCurso,
} from '@/lib/cursos'

export default async function CursoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await exigirSessao()
  const supabase = await createClient()

  const { data: curso } = await supabase.from('cursos').select('*').eq('id', id).single()
  if (!curso) notFound()

  const [{ data: aulas }, { data: turmas }, { data: modulos }, { data: disciplinas }] =
    await Promise.all([
    supabase
      .from('aulas')
      .select('id, numero, titulo, descricao, video_url, duracao_minutos, publicada, modulo_id, disciplina_id')
      .eq('curso_id', id)
      .order('numero', { ascending: true }),
    supabase.from('turmas').select('id, nome, status, modulo_id').eq('curso_id', id),
    supabase
      .from('modulos')
      .select('id, nome, descricao, ordem, video_boas_vindas')
      .eq('curso_id', id)
      .order('ordem', { ascending: true }),
    /* As matérias de cada módulo. Uma consulta só para o curso inteiro, e
       não uma por módulo — a mesma economia do material de apoio logo
       abaixo. O vínculo explícito evita o embed ambíguo que já deixou uma
       caixa vazia neste projeto. */
    supabase
      .from('disciplinas')
      .select('id, nome, ordem, padrao, modulo_id, modulos!disciplinas_modulo_id_fkey!inner(curso_id)')
      .eq('modulos.curso_id', id)
      .order('ordem', { ascending: true }),
  ])

  /* Quantas turmas estão penduradas em cada módulo. O número importa na
     tela: apagar um módulo com turma dentro é recusado, e a pessoa precisa
     ver isso ANTES de tentar. */
  const modulosPorId = new Map<string, { nome: string; ordem: number }>(
    (modulos ?? []).map((m) => [m.id as string, { nome: m.nome as string, ordem: Number(m.ordem) }])
  )

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
      : Promise.resolve({ data: [] as { aula_id: string; concluida: boolean }[] }),
  ])

  const totalAlunos = matriculas?.length ?? 0

  /* Quantos alunos em cada turma. O número no cartão é o que faz a
     coordenação ver, do próprio curso, que uma turma está vazia — sem
     abrir uma por uma. */
  const alunosPorTurma = new Map<string, number>()
  for (const m of matriculas ?? []) {
    const k = m.turma_id as string
    alunosPorTurma.set(k, (alunosPorTurma.get(k) ?? 0) + 1)
  }

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

  /* A árvore que a tela desenha: módulo → suas aulas, em ordem. É montada
     aqui, no servidor, e não no navegador, porque é a mesma agrupação que
     o aluno enxerga — a tela de quem monta e a de quem estuda passam a
     descrever a mesma coisa. */
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

  /* Aulas de antes de os módulos existirem. O gatilho do banco impede que
     nasçam novas, mas as antigas precisam ser ENCONTRÁVEIS — aula fora de
     módulo é aula que nenhum aluno vê. */
  const semModulo = lista.filter((a) => !a.modulo_id)

  /* A ÁRVORE ATUAL, achatada em nomes, para a matriz poder comparar.

     Sem isto a prévia diria "criar 3 módulos, 6 disciplinas, 60 aulas"
     mesmo quando metade disso já está no curso — e ela só descobriria a
     duplicata depois de clicar. Com isto, cada linha da prévia vem
     marcada: nova, já existe, ou muda de matéria. */
  const estruturaAtual: EstruturaExistente = {
    modulos: arvore.map((m) => ({
      nome: m.nome,
      disciplinas: m.disciplinas.map((d) => ({
        nome: d.nome,
        padrao: d.padrao,
        aulas: d.aulas.map((a) => a.titulo),
      })),
    })),
  }

  const cor = corDoCurso(curso.cor)
  const capa = urlDaCapa(curso.capa_path)

  return (
    <div className="p-5 sm:p-8">
      <Voltar
        href="/dashboard/admin/cursos"
        label="Todos os cursos"
        titulo={curso.titulo}
        margem="mb-4"
      />

      {/* ---------- Cabeçalho do curso ---------- */}
      <div className="relative overflow-hidden rounded-2xl mb-7 animate-float-in">
        <div className="absolute inset-0">
          {capa ? (
            <Image src={capa} alt={curso.titulo} fill sizes="100vw" className="object-cover" />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${cor.gradiente}`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950/92 via-brand-950/75 to-brand-950/45" />
        </div>

        <div className="relative p-6 sm:p-8 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {curso.categoria && (
                <span className="rounded-full bg-white/15 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/20">
                  {curso.categoria}
                </span>
              )}
              <span className="rounded-full bg-white/15 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20">
                {NIVEL_LABEL[curso.nivel as Curso['nivel']]}
              </span>
              <span className="rounded-full bg-white/15 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20">
                {MODALIDADE[(curso.modalidade as ModalidadeCurso) ?? 'ead'].label}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  curso.publicado ? 'bg-brand-500 text-white' : 'bg-gray-900/70 text-white'
                }`}
              >
                {curso.publicado ? 'Publicado' : 'Rascunho'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white">{curso.titulo}</h1>
            {curso.subtitulo && (
              <p className="text-brand-50/85 mt-1.5 max-w-2xl">{curso.subtitulo}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm text-brand-50/80">
              <span className="inline-flex items-center gap-1.5">
                <BookOpenText className="h-4 w-4" strokeWidth={2} />
                <span className="font-semibold text-white tabular-nums">{lista.length}</span> aulas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4" strokeWidth={2} />
                <span className="font-semibold text-white tabular-nums">
                  {turmas?.length ?? 0}
                </span>{' '}
                turmas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users2 className="h-4 w-4" strokeWidth={2} />
                <span className="font-semibold text-white tabular-nums">{totalAlunos}</span> alunos
              </span>
              {curso.carga_horaria && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" strokeWidth={2} />
                  <span className="font-semibold text-white tabular-nums">
                    {curso.carga_horaria}h
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2.5">
            <Link
              href={`/dashboard/admin/cursos/${curso.id}/preview`}
              className="group inline-flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-md px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 transition-all hover:bg-white/25 active:scale-[0.98]"
            >
              <Eye className="h-4 w-4" strokeWidth={2.25} />
              Ver como aluno
            </Link>
            <CursoAcoes
              cursoId={curso.id}
              publicado={curso.publicado}
              temTurmas={(turmas?.length ?? 0) > 0}
            />
          </div>
        </div>
      </div>

      {/* ---------- Turmas ligadas ---------- */}
      {turmas && turmas.length > 0 && (
        <div className="mb-7">
          <h2 className="font-bold text-gray-900 mb-3">Turmas usando este curso</h2>
          {/* CADA TURMA COM O CAMINHO PARA O QUE SE FAZ NELA.

              Antes eram etiquetas com o nome da turma e mais nada — para
              puxar a chamada era preciso sair do curso, ir em Turmas,
              achar a turma certa e entrar nela. Dentro do curso, as
              turmas dele são o lugar óbvio de procurar, e cada uma agora
              diz de qual MÓDULO é (duas turmas do mesmo curso em etapas
              diferentes têm chamadas diferentes) e quantos alunos tem. */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {turmas.map((t) => {
              const mod = modulosPorId.get((t.modulo_id as string) ?? '')
              const quantos = alunosPorTurma.get(t.id as string) ?? 0
              return (
                <div
                  key={t.id}
                  className="superficie overflow-hidden rounded-2xl"
                  data-teste="turma-do-curso"
                >
                  <Link
                    href={`/dashboard/admin/turmas/${t.id}`}
                    className="flex items-start gap-2.5 px-3.5 py-3 transition-colors hover:bg-gray-50"
                  >
                    <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold text-gray-900">
                        {t.nome}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-gray-500">
                        {mod ? `${mod.ordem}. ${mod.nome}` : 'Sem módulo'} ·{' '}
                        <span
                          className={quantos === 0 ? 'font-semibold text-amber-700' : ''}
                          data-teste="alunos-da-turma"
                        >
                          {quantos} {quantos === 1 ? 'aluno' : 'alunos'}
                        </span>
                      </span>
                    </span>
                  </Link>
                  <div className="flex divide-x divide-gray-100 border-t border-gray-100 text-[11.5px] font-semibold">
                    <Link
                      href={`/dashboard/professor/turmas/${t.id}/chamada`}
                      data-teste="atalho-chamada"
                      className="flex-1 px-2 py-2 text-center text-gray-600 transition-colors hover:bg-brand-50 hover:text-brand-800"
                    >
                      Chamada
                    </Link>
                    <Link
                      href={`/dashboard/professor/turmas/${t.id}/notas`}
                      className="flex-1 px-2 py-2 text-center text-gray-600 transition-colors hover:bg-brand-50 hover:text-brand-800"
                    >
                      Notas
                    </Link>
                    <Link
                      href={`/dashboard/admin/turmas/${t.id}`}
                      className="flex-1 px-2 py-2 text-center text-gray-600 transition-colors hover:bg-brand-50 hover:text-brand-800"
                    >
                      Alunos
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---------- A matriz curricular, montada de uma vez ----------
           Vem ANTES da árvore de propósito: num curso vazio, montar a
           estrutura é o próximo passo, e ele não pode estar embaixo de uma
           lista de nada. Num curso que já tem conteúdo, é um botão
           fechado que não atrapalha. */}
      <div className="mb-5">
        <MatrizCurricular
          cursoId={curso.id}
          cursoVazio={lista.length === 0}
          existente={estruturaAtual}
        />
      </div>

      {/* ---------- Módulos e vídeo aulas, numa árvore só ---------- */}
      <ConteudoDoCurso
        cursoId={curso.id}
        modulos={arvore}
        semModulo={semModulo}
        totalAlunos={totalAlunos}
        podeEditarModulos
      />

      {/* ---------- Editar dados ---------- */}
      <h2 className="font-bold text-gray-900 mt-10 mb-4">Dados do curso</h2>
      <CursoForm curso={curso as Curso} />
    </div>
  )
}
