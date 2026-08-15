import Link from 'next/link'
import Image from 'next/image'
import { BookOpenText, Clock, Users2, ArrowRight, Check, Play, Monitor, Users } from 'lucide-react'
import { corDoCurso, urlDaCapa, NIVEL_LABEL, MODALIDADE, type Curso } from '@/lib/cursos'

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
  const iniciado = progresso !== undefined && progresso > 0

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-xl bg-white ring-1 ring-brand-950/[0.07] transition-all duration-300 hover:-translate-y-[3px] hover:shadow-float hover:ring-brand-950/[0.1]"
    >
      {/* ---------------- Capa ---------------- */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {capa ? (
          <Image
            src={capa}
            alt={curso.titulo}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${cor.gradiente}`}>
            {/* Textura discreta em vez de um gradiente chapado */}
            <div
              className="absolute inset-0 opacity-[0.10]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(255,255,255,.85) 1px, transparent 0)',
                backgroundSize: '18px 18px',
              }}
            />
            <BookOpenText
              className="absolute -bottom-6 -right-3 h-32 w-32 text-white/[0.14]"
              strokeWidth={0.9}
            />
          </div>
        )}

        {/* Véu só na base, para os selos não competirem com a foto */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-brand-950/55 to-transparent" />

        {/* Selos do topo */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {curso.categoria ? (
            <span className="rounded-md bg-white/95 px-2 py-[3px] text-[10.5px] font-semibold tracking-wide text-brand-950 shadow-soft backdrop-blur-sm">
              {curso.categoria}
            </span>
          ) : (
            <span />
          )}

          {mostrarStatus && !curso.publicado && (
            <span className="rounded-md bg-brand-950/80 px-2 py-[3px] text-[10.5px] font-semibold text-white/90 backdrop-blur-sm">
              Rascunho
            </span>
          )}
          {concluido && (
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-[3px] text-[10.5px] font-bold text-white shadow-soft">
              <Check className="h-3 w-3" strokeWidth={3} />
              Concluído
            </span>
          )}
        </div>

        {/* Nível + play, na base da capa */}
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.18] px-2 py-[3px] text-[10.5px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
              {curso.modalidade === 'presencial' ? (
                <Users className="h-3 w-3" strokeWidth={2.2} />
              ) : (
                <Monitor className="h-3 w-3" strokeWidth={2.2} />
              )}
              {MODALIDADE[curso.modalidade]?.label ?? 'EAD'}
            </span>
            <span className="rounded-md bg-white/[0.12] px-2 py-[3px] text-[10.5px] font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-md">
              {NIVEL_LABEL[curso.nivel]}
            </span>
          </span>
          <span className="flex h-8 w-8 translate-y-1 items-center justify-center rounded-full bg-white/95 text-brand-900 opacity-0 shadow-float transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <Play className="ml-[1px] h-3.5 w-3.5 fill-current" strokeWidth={0} />
          </span>
        </div>
      </div>

      {/* ---------------- Corpo ---------------- */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[15px] font-bold leading-snug tracking-[-0.01em] text-gray-900 transition-colors duration-200 group-hover:text-brand-800">
          {curso.titulo}
        </h3>

        {curso.subtitulo && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-gray-500">
            {curso.subtitulo}
          </p>
        )}

        {/* Métricas — peso leve de propósito, são apoio e não protagonistas */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px] text-gray-400">
          {totalAulas !== undefined && (
            <span className="inline-flex items-center gap-1">
              <BookOpenText className="h-3.5 w-3.5" strokeWidth={1.9} />
              <span className="font-semibold text-gray-600 tabular-nums">{totalAulas}</span>
              aulas
            </span>
          )}
          {curso.carga_horaria && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.9} />
              <span className="font-semibold text-gray-600 tabular-nums">
                {curso.carga_horaria}h
              </span>
            </span>
          )}
          {totalAlunos !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Users2 className="h-3.5 w-3.5" strokeWidth={1.9} />
              <span className="font-semibold text-gray-600 tabular-nums">{totalAlunos}</span>
              alunos
            </span>
          )}
        </div>

        {/* Progresso do aluno */}
        {progresso !== undefined && (
          <div className="mt-3.5">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-[11.5px] text-gray-500">
                {aulasConcluidas !== undefined && totalAulas !== undefined
                  ? `${aulasConcluidas} de ${totalAulas} aulas`
                  : 'Seu progresso'}
              </span>
              <span className={`text-[12px] font-bold tabular-nums ${cor.texto}`}>
                {Math.round(progresso)}%
              </span>
            </div>
            <div className="h-[3px] overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${cor.solido} transition-[width] duration-700 ease-out`}
                style={{ width: `${Math.max(progresso, 1.5)}%` }}
              />
            </div>
          </div>
        )}

        {/* Chamada de ação */}
        <div
          className={`mt-auto flex items-center gap-1 pt-3.5 text-[12.5px] font-semibold ${cor.texto}`}
        >
          {progresso !== undefined
            ? concluido
              ? 'Rever curso'
              : iniciado
                ? 'Continuar curso'
                : 'Começar curso'
            : 'Abrir curso'}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2.25}
          />
        </div>
      </div>
    </Link>
  )
}
