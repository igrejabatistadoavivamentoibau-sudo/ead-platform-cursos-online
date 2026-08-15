import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, Clock, Trophy, Lock, Video, EyeOff } from 'lucide-react'
import VideoPlayer from '@/components/Aulas/VideoPlayer'
import ResumoAula from '@/components/Aulas/ResumoAula'
import { corDoCurso, urlDaCapa, NIVEL_LABEL, type Curso } from '@/lib/cursos'
import { urlDoVideo } from '@/lib/video'

export interface AulaDoCurso {
  id: string
  numero: number
  titulo: string
  descricao: string | null
  video_url: string | null
  video_path?: string | null
  duracao_minutos: number | null
  /** Só vem preenchido na pré-visualização, para marcar rascunhos. */
  publicada?: boolean
}

export interface ProgressoAula {
  concluida: boolean
  percentual: number
}

/**
 * A tela do curso como o ALUNO vê.
 *
 * É usada tanto pelo portal do aluno quanto pela pré-visualização do
 * admin/professor — de propósito. Se fossem duas telas separadas, elas
 * divergiriam com o tempo e a pré-visualização deixaria de servir para
 * testar a experiência real.
 */
export default function VisaoDoCurso({
  curso,
  aulas,
  aulaAtual,
  progressoPorAula,
  hrefAula,
  preview = false,
  resumo,
}: {
  curso: Curso
  aulas: AulaDoCurso[]
  aulaAtual: AulaDoCurso
  progressoPorAula: Map<string, ProgressoAula>
  /** Monta o link de cada aula (varia entre portal do aluno e preview). */
  hrefAula: (aulaId: string) => string
  preview?: boolean
  /** Resumo que o aluno já escreveu para a aula aberta. */
  resumo?: { texto: string; feedback: string | null }
}) {
  const cor = corDoCurso(curso.cor)
  const capa = urlDaCapa(curso.capa_path)
  const progressoAtual = progressoPorAula.get(aulaAtual.id)

  const publicadas = aulas.filter((a) => a.publicada !== false)
  const totalConcluidas = publicadas.filter((a) => progressoPorAula.get(a.id)?.concluida).length
  const pctGeral =
    publicadas.length > 0 ? Math.round((totalConcluidas / publicadas.length) * 100) : 0

  return (
    <>
      {/* ---------- Cabeçalho do curso ---------- */}
      <div className="relative overflow-hidden rounded-2xl mb-6 animate-float-in">
        <div className="absolute inset-0">
          {capa ? (
            <Image src={capa} alt={curso.titulo} fill sizes="100vw" className="object-cover" />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${cor.gradiente}`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950/92 via-brand-950/75 to-brand-950/40" />
        </div>

        <div className="relative p-6 sm:p-7 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              {curso.categoria && (
                <span className="rounded-full bg-white/15 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/20">
                  {curso.categoria}
                </span>
              )}
              <span className="rounded-full bg-white/15 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20">
                {NIVEL_LABEL[curso.nivel]}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{curso.titulo}</h1>
            {curso.subtitulo && (
              <p className="text-brand-50/85 mt-1.5 max-w-2xl text-[15px]">{curso.subtitulo}</p>
            )}
          </div>

          <div className="rounded-2xl bg-white/12 backdrop-blur-md ring-1 ring-white/20 px-5 py-4 min-w-[210px]">
            <div className="flex items-center gap-2.5 mb-2.5">
              <Trophy className="h-5 w-5 text-accent-300" strokeWidth={2} />
              <span className="text-sm font-bold text-white tabular-nums">
                {totalConcluidas} de {publicadas.length} aulas
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-300 to-white animate-grow-bar"
                style={{ width: `${Math.max(pctGeral, 2)}%` }}
              />
            </div>
            <p className="text-brand-100/80 text-xs mt-2">
              {preview ? 'Progresso de exemplo' : `${pctGeral}% do curso concluído`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* ---------- Player ---------- */}
        <div>
          <VideoPlayer
            key={aulaAtual.id}
            aulaId={aulaAtual.id}
            videoUrl={urlDoVideo(aulaAtual.video_path) ?? aulaAtual.video_url}
            concluidaInicial={progressoAtual?.concluida ?? false}
            percentualInicial={progressoAtual?.percentual ?? 0}
            somenteLeitura={preview}
          />

          <div className="mt-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`text-xs font-bold uppercase tracking-widest ${cor.texto}`}>
                Aula {aulaAtual.numero}
              </span>
              {preview && aulaAtual.publicada === false && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-300">
                  <EyeOff className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Rascunho — o aluno não vê esta aula
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 mt-1.5">{aulaAtual.titulo}</h2>
            {aulaAtual.descricao && (
              <p className="text-gray-500 mt-2 leading-relaxed">{aulaAtual.descricao}</p>
            )}
          </div>

          <ResumoAula
            key={aulaAtual.id}
            aulaId={aulaAtual.id}
            textoInicial={resumo?.texto ?? ''}
            feedback={resumo?.feedback ?? null}
            somenteLeitura={preview}
          />
        </div>

        {/* ---------- Lista de aulas ---------- */}
        <div>
          <h2 className="font-bold text-gray-900 mb-3">Conteúdo do curso</h2>
          <div className="card-alive divide-y divide-gray-100 overflow-hidden">
            {aulas.map((a) => {
              const p = progressoPorAula.get(a.id)
              const ativa = a.id === aulaAtual.id
              const rascunho = a.publicada === false

              return (
                <Link
                  key={a.id}
                  href={hrefAula(a.id)}
                  scroll={false}
                  className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                    ativa ? cor.suave : 'hover:bg-gray-50'
                  } ${rascunho ? 'bg-amber-50/40' : ''}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                      p?.concluida
                        ? `${cor.solido} text-white`
                        : ativa
                          ? `bg-white ${cor.texto} ring-1 ${cor.anel}`
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {p?.concluida ? (
                      <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2.25} />
                    ) : (
                      a.numero
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium truncate ${ativa ? cor.texto : 'text-gray-800'}`}
                    >
                      {a.titulo}
                    </p>
                    <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                      {a.duracao_minutos && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                          <Clock className="h-3 w-3" strokeWidth={2} />
                          {a.duracao_minutos} min
                        </span>
                      )}
                      {rascunho ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                          <EyeOff className="h-3 w-3" strokeWidth={2.25} />
                          Rascunho
                        </span>
                      ) : p?.concluida ? (
                        <span className={`text-[11px] font-semibold ${cor.texto}`}>Concluída</span>
                      ) : p && p.percentual > 0 ? (
                        <span className="text-[11px] text-gray-500 tabular-nums">
                          {Math.round(p.percentual)}% assistido
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">Não iniciada</span>
                      )}
                    </div>
                  </div>

                  {!a.video_url && (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-gray-300" strokeWidth={2.25} />
                  )}
                </Link>
              )
            })}
          </div>

          {aulas.length === 0 && (
            <div className="card-alive p-8 text-center">
              <Video className="h-8 w-8 mx-auto text-gray-300 mb-2" strokeWidth={1.6} />
              <p className="text-sm text-gray-500">Nenhuma aula publicada ainda.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
