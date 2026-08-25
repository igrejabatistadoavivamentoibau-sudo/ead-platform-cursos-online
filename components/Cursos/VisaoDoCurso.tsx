import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, Clock, Trophy, Lock, Video, EyeOff, Layers, Check } from 'lucide-react'
import VideoPlayer from '@/components/Aulas/VideoPlayer'
import AulaTrancada, { type SituacaoDoPedido } from '@/components/Aulas/AulaTrancada'
import { lerJanela } from '@/lib/janelaDaAtividade'
import ResumoAula from '@/components/Aulas/ResumoAula'
import CadernoDaAula from '@/components/Caderno/CadernoDaAula'
import MateriaisDaAula, { type MaterialNaTela } from '@/components/Materiais/MateriaisDaAula'
import { corDoCurso, urlDaCapa, NIVEL_LABEL, type Curso } from '@/lib/cursos'
import type { EstadoDoModulo } from '@/lib/modulosDoAluno'
import { enderecoDoVideo } from '@/lib/video'

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
 * A janela da aula NESTA turma, e o que o aluno já pediu sobre ela.
 *
 * Não vem no preview do professor: lá não existe aluno nem turma, e
 * trancar a pré-visualização impediria justamente quem precisa conferir
 * o conteúdo de conferir.
 */
export interface JanelaDaAula {
  turmaId: string | null
  abre_em: string | null
  vence_em: string | null
  pedido: SituacaoDoPedido
  respostaDoProfessor: string | null
  /** Liberação individual em vigor: passa por cima da janela. */
  liberada: boolean
}

/**
 * Um módulo do curso já resolvido para esta pessoa: com as aulas dele e
 * com a informação de se ela pode ou não entrar.
 *
 * Quem decide isso é `lib/modulosDoAluno.ts` — aqui só desenhamos.
 */
export interface ModuloNaTela {
  id: string
  nome: string
  descricao?: string | null
  ordem: number
  estado: EstadoDoModulo
  aberto: boolean
  atual: boolean
  motivo?: string
  aulas: AulaDoCurso[]
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
  janelas,
  modulos,
  materiais = [],
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
  /** Janela de cada aula nesta turma. Vazio = tudo liberado. */
  janelas?: Map<string, JanelaDaAula>
  /**
   * O curso dividido em módulos. Sem isso, a tela cai no comportamento
   * antigo — uma lista só —, o que continua certo para curso de um módulo.
   */
  modulos?: ModuloNaTela[]
  /**
   * O material de apoio da aula aberta. A turma presencial pediu vídeo E
   * material; o vídeo já existia, isto é a outra metade.
   */
  materiais?: MaterialNaTela[]
}) {
  const cor = corDoCurso(curso.cor)
  const capa = urlDaCapa(curso.capa_path)
  const progressoAtual = progressoPorAula.get(aulaAtual.id)

  /* A TRAVA DA AULA.
     Calculada aqui, no servidor, porque esta tela é um Server Component —
     o relógio é o do servidor, mas todas as comparações são em instantes
     absolutos, onde fuso não existe. Quem já concluiu a aula continua
     podendo revê-la: fechar o que a pessoa já assistiu seria tirar dela
     um material que ela conquistou. */
  const janelaDe = (aulaId: string) => {
    if (preview || !janelas) return null
    const j = janelas.get(aulaId)
    if (!j) return null
    if (j.liberada) return null
    if (progressoPorAula.get(aulaId)?.concluida) return null
    const estado = lerJanela(j.abre_em, j.vence_em).estado
    if (estado === 'aberta') return null
    return { ...j, estado }
  }

  const trancaAtual = janelaDe(aulaAtual.id)

  /* ---------- Os módulos, e o que conta como "o curso" ----------

     Sem módulos declarados, cai no comportamento antigo: um grupo só, com
     tudo dentro. É o que continua certo para curso de um módulo.

     Com módulos, o avanço passa a medir o MÓDULO EM QUE A PESSOA ESTÁ, e
     não o curso inteiro. Contar o curso inteiro parece mais completo e é
     desanimador e falso: quem está no Módulo 1 de três nunca passaria de
     33%, por mais que fizesse tudo certo — e as aulas que faltam para
     chegar a 100% ela nem tem permissão de abrir. */
  const grupos: ModuloNaTela[] =
    modulos && modulos.length > 0
      ? [...modulos].sort((a, b) => a.ordem - b.ordem)
      : [
          {
            id: '_todos',
            nome: curso.titulo,
            ordem: 1,
            estado: 'cursando' as EstadoDoModulo,
            aberto: true,
            atual: true,
            aulas,
          },
        ]

  const temModulos = (modulos?.length ?? 0) > 1
  const grupoDoAvanco = grupos.find((g) => g.atual) ?? grupos.find((g) => g.aberto) ?? grupos[0]

  const publicadas = (grupoDoAvanco?.aulas ?? aulas).filter((a) => a.publicada !== false)
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
              {preview
                ? 'Progresso de exemplo'
                : temModulos
                  ? `${pctGeral}% de ${grupoDoAvanco?.nome ?? 'este módulo'}`
                  : `${pctGeral}% do curso concluído`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* ---------- Player ---------- */}
        <div>
          {trancaAtual ? (
            <AulaTrancada
              turmaId={trancaAtual.turmaId}
              aulaId={aulaAtual.id}
              tituloAula={aulaAtual.titulo}
              motivo={trancaAtual.estado === 'ainda_nao_abriu' ? 'ainda_nao_abriu' : 'encerrada'}
              abreEm={trancaAtual.abre_em}
              venceEm={trancaAtual.vence_em}
              pedido={trancaAtual.pedido}
              respostaDoProfessor={trancaAtual.respostaDoProfessor}
            />
          ) : (
            <VideoPlayer
              key={aulaAtual.id}
              aulaId={aulaAtual.id}
              /* Arquivo guardado na plataforma passa pela porta que confere
                  permissão; link de fora vai direto, como sempre foi. */
              videoUrl={
                aulaAtual.video_path
                  ? enderecoDoVideo(aulaAtual.id)
                  : aulaAtual.video_url
              }
              titulo={aulaAtual.titulo}
              concluidaInicial={progressoAtual?.concluida ?? false}
              percentualInicial={progressoAtual?.percentual ?? 0}
              somenteLeitura={preview}
            />
          )}

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

          {/* O material de apoio vem logo abaixo da aula e ANTES do caderno:
              é conteúdo da aula, não anotação de quem assiste. Quem chegou
              aqui para pegar a apostila encontra sem rolar a tela inteira. */}
          <MateriaisDaAula materiais={materiais} />

          {/* O caderno vem ANTES do resumo de propósito. São coisas
              diferentes e a ordem ensina isso: primeiro a pessoa anota para
              si mesma, enquanto assiste; depois, se quiser, escreve o
              resumo que o professor vai ler. */}
          <CadernoDaAula
            key={`caderno-${aulaAtual.id}`}
            aulaId={aulaAtual.id}
            cursoId={curso.id}
            tituloAula={aulaAtual.titulo}
            desligado={preview}
          />

          <ResumoAula
            key={aulaAtual.id}
            aulaId={aulaAtual.id}
            textoInicial={resumo?.texto ?? ''}
            feedback={resumo?.feedback ?? null}
            somenteLeitura={preview}
          />
        </div>

        {/* ---------- Lista de aulas, agrupada por módulo ----------

             O agrupamento não é enfeite de organização: com a numeração
             recomeçando em cada módulo, uma lista corrida mostra duas
             "Aula 1" seguidas e some com a informação que explica isso.

             O módulo fechado APARECE, com cadeado e com o motivo. Esconder
             seria mais limpo e pior: quem termina o Módulo 1 precisa ver
             que existe um 2, senão a conclusão parece o fim do curso. E as
             aulas dele não são listadas — não é o cadeado que segura, é
             não existir link nenhum para clicar. */}
        <div className="space-y-5">
          <h2 className="font-bold text-gray-900">Conteúdo do curso</h2>

          {grupos.map((g) => (
            <div key={g.id}>
              {temModulos && (
                <div
                  className={`mb-2 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 ring-1 ${
                    g.atual
                      ? `${cor.suave} ${cor.anel}`
                      : g.aberto
                        ? 'bg-white ring-brand-950/[0.06]'
                        : 'bg-gray-50 ring-gray-200'
                  }`}
                >
                  {g.aberto ? (
                    <Layers
                      className={`h-4 w-4 shrink-0 ${g.atual ? cor.texto : 'text-gray-400'}`}
                      strokeWidth={2.1}
                    />
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2.25} />
                  )}

                  <span
                    className={`text-[13.5px] font-bold ${
                      g.aberto ? (g.atual ? cor.texto : 'text-gray-800') : 'text-gray-500'
                    }`}
                  >
                    {g.nome}
                  </span>

                  {g.estado === 'aprovado' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 ring-1 ring-brand-200">
                      <Check className="h-3 w-3" strokeWidth={2.75} />
                      Concluído
                    </span>
                  )}
                  {g.atual && g.estado !== 'aprovado' && (
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold text-gray-600 ring-1 ring-brand-950/[0.08]">
                      Você está aqui
                    </span>
                  )}

                  <span className="ml-auto text-[11.5px] tabular-nums text-gray-500">
                    {g.aulas.length} {g.aulas.length === 1 ? 'aula' : 'aulas'}
                  </span>

                  {!g.aberto && g.motivo && (
                    <p className="w-full text-[12px] leading-relaxed text-gray-500">{g.motivo}</p>
                  )}
                </div>
              )}

              {g.aberto && g.aulas.length > 0 && (
          <div className="card-alive divide-y divide-gray-100 overflow-hidden">
            {g.aulas.map((a) => {
              const p = progressoPorAula.get(a.id)
              const ativa = a.id === aulaAtual.id
              const rascunho = a.publicada === false
              const tranca = janelaDe(a.id)

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
                    ) : tranca ? (
                      /* O cadeado ocupa o lugar do número de propósito: é a
                         informação que muda o que a pessoa vai fazer a
                         seguir, e o número dela continua no título. */
                      <Lock className="h-4 w-4" strokeWidth={2.25} />
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
                      ) : tranca ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                          <Lock className="h-3 w-3" strokeWidth={2.25} />
                          {tranca.estado === 'ainda_nao_abriu' ? 'Abre depois' : 'Prazo encerrado'}
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
              )}

              {g.aberto && g.aulas.length === 0 && (
                <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-brand-950/[0.06]">
                  <Video className="mx-auto mb-2 h-7 w-7 text-gray-300" strokeWidth={1.6} />
                  <p className="text-[13px] text-gray-500">
                    Nenhuma aula publicada neste módulo ainda.
                  </p>
                </div>
              )}
            </div>
          ))}

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
