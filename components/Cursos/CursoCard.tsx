import Link from 'next/link'
import Image from 'next/image'
import { BookOpenText, Clock, Users2, ArrowRight, CheckCircle2, PlayCircle } from 'lucide-react'
import { corDoCurso, urlDaCapa, NIVEL_LABEL, type Curso } from '@/lib/cursos'

export interface CursoCardProps {
  curso: Curso
  href: string
  totalAulas?: number
  totalAlunos?: number
  /** Progresso do aluno neste curso, de 0 a 100. Omitir para visão de gestão. */
  progresso?: number
  aulasConcluidas?: number
  /** Mostra o selo de rascunho quando o curso ainda não foi publicado. */
  mostrarStatus?: boolean
}

export default function CursoCard({
  curso,
  href,
  totalAulas,
  totalAlunos,
  progresso,
  aulasConcluidas,
  mostrarStatus = false,
}: CursoCardProps) {
  const cor = corDoCurso(curso.cor)
  const capa = urlDaCapa(curso.capa_path)
  const concluido = progresso !== undefined && progresso >= 100

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-brand-950/[0.07] shadow-soft transition-all duration-400 hover:-translate-y-1.5 hover:shadow-float hover:ring-brand-950/10"
    >
      {/* ---------- Capa ---------- */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {capa ? (
          <Image
            src={capa}
            alt={curso.titulo}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${cor.gradiente}`}>
            {/* Padrão geométrico discreto quando não há foto de capa */}
            <div
              className="absolute inset-0 opacity-[0.13]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(255,255,255,.9) 1px, transparent 0)',
                backgroundSize: '22px 22px',
              }}
            />
            <div className="absolute -bottom-10 -right-6 opacity-20">
              <BookOpenText className="h-40 w-40 text-white" strokeWidth={1} />
            </div>
          </div>
        )}

        {/* Véu inferior para os selos ficarem legíveis sobre qualquer foto */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950/75 via-transparent to-transparent" />

        {/* Selos superiores */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          {curso.categoria && (
            <span className="rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-brand-900 shadow-soft">
              {curso.categoria}
            </span>
          )}
          {mostrarStatus && !curso.publicado && (
            <span className="ml-auto rounded-full bg-gray-900/85 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold text-white">
              Rascunho
            </span>
          )}
          {concluido && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-glow">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
              Concluído
            </span>
          )}
        </div>

        {/* Nível, no rodapé da capa */}
        <span className="absolute bottom-3 left-3 rounded-full bg-white/15 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20">
          {NIVEL_LABEL[curso.nivel]}
        </span>

        {/* Botão fantasma que aparece no hover */}
        <span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-brand-800 opacity-0 translate-y-2 shadow-float transition-all duration-400 group-hover:opacity-100 group-hover:translate-y-0">
          <PlayCircle className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>

      {/* ---------- Conteúdo ---------- */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display font-bold text-[17px] leading-snug text-gray-900 transition-colors duration-300 group-hover:text-brand-800">
          {curso.titulo}
        </h3>

        {curso.subtitulo && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2 leading-relaxed">
            {curso.subtitulo}
          </p>
        )}

        {/* Métricas */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
          {totalAulas !== undefined && (
            <span className="inline-flex items-center gap-1.5">
              <BookOpenText className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="font-semibold text-gray-700 tabular-nums">{totalAulas}</span>
              aula{totalAulas === 1 ? '' : 's'}
            </span>
          )}
          {curso.carga_horaria && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="font-semibold text-gray-700 tabular-nums">
                {curso.carga_horaria}h
              </span>
            </span>
          )}
          {totalAlunos !== undefined && (
            <span className="inline-flex items-center gap-1.5">
              <Users2 className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="font-semibold text-gray-700 tabular-nums">{totalAlunos}</span>
              aluno{totalAlunos === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {/* Progresso do aluno */}
        {progresso !== undefined && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-gray-600">
                {aulasConcluidas !== undefined && totalAulas !== undefined
                  ? `${aulasConcluidas} de ${totalAulas} aulas`
                  : 'Seu progresso'}
              </span>
              <span className={`font-bold tabular-nums ${cor.texto}`}>
                {Math.round(progresso)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${cor.solido} transition-[width] duration-700`}
                style={{ width: `${Math.max(progresso, 2)}%` }}
              />
            </div>
          </div>
        )}

        {/* Chamada de ação */}
        <div
          className={`mt-4 pt-4 border-t border-gray-100 flex items-center gap-1.5 text-sm font-semibold ${cor.texto}`}
        >
          {progresso !== undefined
            ? concluido
              ? 'Rever curso'
              : progresso > 0
                ? 'Continuar curso'
                : 'Começar curso'
            : 'Abrir curso'}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2.25}
          />
        </div>
      </div>
    </Link>
  )
}
