import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, Users2, BookOpenText, Clock, GraduationCap, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import CursoForm from '@/components/Cursos/CursoForm'
import CursoAcoes from '@/components/Cursos/CursoAcoes'
import AulasManager, { type AulaItem } from '@/components/Aulas/AulasManager'
import AulaAvulsaForm from '@/components/Aulas/AulaAvulsaForm'
import ModulosDoCurso, { type ModuloItem } from '@/components/Cursos/ModulosDoCurso'
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

  const [{ data: aulas }, { data: turmas }, { data: modulos }] = await Promise.all([
    supabase
      .from('aulas')
      .select('id, numero, titulo, descricao, video_url, duracao_minutos, publicada, modulo_id')
      .eq('curso_id', id)
      .order('numero', { ascending: true }),
    supabase.from('turmas').select('id, nome, status, modulo_id').eq('curso_id', id),
    supabase
      .from('modulos')
      .select('id, nome, descricao, ordem')
      .eq('curso_id', id)
      .order('ordem', { ascending: true }),
  ])

  /* Os módulos com o que está pendurado em cada um. O número de turmas
     importa na tela: apagar um módulo com turma dentro é recusado, e a
     pessoa precisa ver isso ANTES de tentar. */
  const turmasPorModulo = new Map<string, number>()
  for (const t of turmas ?? []) {
    const k = (t.modulo_id as string) ?? ''
    if (k) turmasPorModulo.set(k, (turmasPorModulo.get(k) ?? 0) + 1)
  }

  const listaDeModulos: ModuloItem[] = (modulos ?? []).map((m) => ({
    id: m.id as string,
    nome: m.nome as string,
    descricao: (m.descricao as string) ?? null,
    ordem: Number(m.ordem),
    aulas: (aulas ?? [])
      .filter((a) => a.modulo_id === m.id)
      .map((a) => ({
        id: a.id as string,
        numero: Number(a.numero),
        titulo: a.titulo as string,
        publicada: a.publicada as boolean,
      })),
    turmas: turmasPorModulo.get(m.id as string) ?? 0,
  }))

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

  const concluidasPorAula = new Map<string, number>()
  for (const p of progresso ?? []) {
    concluidasPorAula.set(p.aula_id, (concluidasPorAula.get(p.aula_id) ?? 0) + 1)
  }

  const lista: AulaItem[] = (aulas ?? []).map((a) => ({
    ...a,
    concluidas: concluidasPorAula.get(a.id) ?? 0,
  }))

  const cor = corDoCurso(curso.cor)
  const capa = urlDaCapa(curso.capa_path)

  return (
    <div className="p-5 sm:p-8">
      <Link
        href="/dashboard/admin/cursos"
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700 transition-colors mb-4"
      >
        <ArrowLeft
          className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
          strokeWidth={2.25}
        />
        Todos os cursos
      </Link>

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
          <div className="flex flex-wrap gap-2">
            {turmas.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/admin/turmas/${t.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-white ring-1 ring-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition-all hover:ring-brand-300 hover:text-brand-800 hover:shadow-soft"
              >
                <GraduationCap className="h-4 w-4 text-brand-600" strokeWidth={2} />
                {t.nome}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Aulas ---------- */}
      <h2 className="font-bold text-gray-900 mb-4">Vídeo aulas do curso</h2>
      <div className="mb-5">
        <AulaAvulsaForm cursoId={curso.id} />
      </div>
      {/* Os módulos vêm ANTES da lista de aulas de propósito: é a
          estrutura que explica a lista. Quem chega aqui para organizar o
          curso precisa ver primeiro em quantas etapas ele se divide. */}
      <div className="mb-8">
        <ModulosDoCurso cursoId={curso.id} modulos={listaDeModulos} />
      </div>

      <AulasManager cursoId={curso.id} aulas={lista} totalAlunos={totalAlunos} />

      {/* ---------- Editar dados ---------- */}
      <h2 className="font-bold text-gray-900 mt-10 mb-4">Dados do curso</h2>
      <CursoForm curso={curso as Curso} />
    </div>
  )
}
