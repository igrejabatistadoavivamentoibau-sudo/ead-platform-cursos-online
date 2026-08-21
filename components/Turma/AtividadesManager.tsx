'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Trash2,
  Check,
  Lock,
  Clock,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  PenLine,
  UserRound,
} from 'lucide-react'
import {
  criarAtividade,
  editarAtividade,
  removerAtividade,
  corrigirEntrega,
  type DadosDaAtividade,
} from '@/app/dashboard/professor/actions'
import {
  lerJanela,
  momentoPorExtenso,
  doCampoParaISO,
  doISOParaCampo,
  fimDoDia,
} from '@/lib/janelaDaAtividade'
import { Botao, Card, Alerta, Selo, EstadoVazio, CAMPO, Campo } from '@/components/ui'

export interface AnexoEntrega {
  id: string
  nome: string
  tipo: string
  url: string | null
}

export interface AtividadeItem {
  id: string
  titulo: string
  descricao: string | null
  aviso: string | null
  abre_em: string | null
  vence_em: string | null
  nota_maxima: number
  criada_por: string | null
  criada_por_nome: string | null
}

export interface EntregaItem {
  id: string
  atividade_id: string
  aluno_id: string
  aluno_nome: string
  texto: string | null
  entregue_em: string
  nota: number | null
  feedback: string | null
  anexos: AnexoEntrega[]
}

interface EstadoDoFormulario {
  titulo: string
  descricao: string
  aviso: string
  abre_em: string
  vence_em: string
  nota_maxima: string
}

const FORMULARIO_VAZIO: EstadoDoFormulario = {
  titulo: '',
  descricao: '',
  aviso: '',
  abre_em: '',
  vence_em: '',
  nota_maxima: '10',
}

function paraFormulario(at: AtividadeItem): EstadoDoFormulario {
  return {
    titulo: at.titulo,
    descricao: at.descricao ?? '',
    aviso: at.aviso ?? '',
    abre_em: doISOParaCampo(at.abre_em),
    vence_em: doISOParaCampo(at.vence_em),
    nota_maxima: String(Number(at.nota_maxima)),
  }
}

/* ============================================================
   O FORMULÁRIO

   Fica FORA do componente de propósito. Um componente declarado dentro de
   outro é recriado a cada desenho, e o React trata isso como um componente
   diferente: o campo perde o foco no meio da digitação e o que já foi
   escrito some. É um erro que já apareceu neste projeto.
   ============================================================ */
function FormularioDaAtividade({
  titulo,
  valores,
  onChange,
  onSalvar,
  onCancelar,
  salvando,
}: {
  titulo: string
  valores: EstadoDoFormulario
  onChange: (v: EstadoDoFormulario) => void
  onSalvar: () => void
  onCancelar: () => void
  salvando: boolean
}) {
  const mudar = (campo: keyof EstadoDoFormulario, valor: string) =>
    onChange({ ...valores, [campo]: valor })

  const janelaInvertida =
    !!valores.abre_em && !!valores.vence_em && new Date(valores.vence_em) <= new Date(valores.abre_em)

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSalvar()
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-[15px] font-bold text-gray-900">{titulo}</h3>
          <button
            type="button"
            onClick={onCancelar}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Título" className="sm:col-span-2">
            <input
              type="text"
              required
              value={valores.titulo}
              onChange={(e) => mudar('titulo', e.target.value)}
              placeholder="Ex: Trabalho sobre liderança servil"
              className={CAMPO}
            />
          </Campo>

          <Campo label="Enunciado" className="sm:col-span-2">
            <textarea
              rows={3}
              value={valores.descricao}
              onChange={(e) => mudar('descricao', e.target.value)}
              placeholder="O que o aluno tem que fazer"
              className={`${CAMPO} resize-y`}
            />
          </Campo>

          {/* O AVISO — campo separado do enunciado.
              São duas informações diferentes: o enunciado é O QUE fazer, o
              aviso é COMO entregar. Juntá-los num campo só faz a instrução
              de entrega se perder no meio do texto — e é justamente ela que
              o aluno esquece de ler. */}
          <Campo label="Aviso sobre a entrega" className="sm:col-span-2">
            <textarea
              rows={2}
              value={valores.aviso}
              onChange={(e) => mudar('aviso', e.target.value)}
              placeholder="Ex: Faça à punho, fotografe cada página e anexe aqui em JPEG."
              className={`${CAMPO} resize-y`}
            />
            <p className="mt-1 text-[11.5px] text-gray-500">
              Aparece em destaque para o aluno, antes do campo de resposta.
            </p>
          </Campo>

          <Campo label="Abre para entrega em">
            <input
              type="datetime-local"
              value={valores.abre_em}
              onChange={(e) => mudar('abre_em', e.target.value)}
              className={CAMPO}
            />
            <p className="mt-1 text-[11.5px] text-gray-500">
              Deixe vazio para liberar já. Antes disso o aluno vê a atividade, mas não anexa.
            </p>
          </Campo>

          <Campo label="Prazo de entrega">
            <input
              type="datetime-local"
              value={valores.vence_em}
              onChange={(e) => mudar('vence_em', e.target.value)}
              className={CAMPO}
            />
            <p className="mt-1 text-[11.5px] text-gray-500">
              Depois deste instante o portal não aceita mais anexos.
            </p>
            {/* ATALHO DO FIM DO DIA.
                Quem digita uma data no campo de data e hora recebe 00:00
                de brinde — e sem perceber fecha a atividade um dia inteiro
                antes do que queria. Este botão existe para esse engano
                não acontecer. */}
            {valores.vence_em && !valores.vence_em.endsWith('23:59') && (
              <button
                type="button"
                onClick={() => mudar('vence_em', fimDoDia(valores.vence_em.slice(0, 10)))}
                className="mt-1.5 text-[11.5px] font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
              >
                Usar o fim do dia (23:59)
              </button>
            )}
          </Campo>

          <Campo label="Nota máxima">
            <input
              type="number"
              min={0.5}
              step="0.5"
              value={valores.nota_maxima}
              onChange={(e) => mudar('nota_maxima', e.target.value)}
              className={CAMPO}
            />
          </Campo>
        </div>

        {janelaInvertida && (
          <div className="mt-3">
            <Alerta tom="aviso">
              O prazo está antes da abertura. Do jeito que está, ninguém consegue entregar.
            </Alerta>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Botao type="submit" disabled={salvando || janelaInvertida}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Botao>
          <Botao type="button" variante="fantasma" onClick={onCancelar}>
            Cancelar
          </Botao>
        </div>
      </form>
    </Card>
  )
}

export default function AtividadesManager({
  turmaId,
  atividades,
  entregas,
  totalAlunos,
  usuarioId,
  ehAdmin,
}: {
  turmaId: string
  atividades: AtividadeItem[]
  entregas: EntregaItem[]
  totalAlunos: number
  usuarioId: string
  ehAdmin: boolean
}) {
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [aberta, setAberta] = useState<string | null>(atividades[0]?.id ?? null)
  const [form, setForm] = useState<EstadoDoFormulario>(FORMULARIO_VAZIO)
  const [correcao, setCorrecao] = useState<Record<string, { nota: string; feedback: string }>>({})
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  /** A regra pedida, aplicada na tela. O servidor confere de novo. */
  const podeMexer = (at: AtividadeItem) => ehAdmin || at.criada_por === usuarioId

  const acao = (fn: () => Promise<unknown>, aoTerminar?: () => void) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        aoTerminar?.()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar.')
      }
    })
  }

  const dadosDoForm = (): DadosDaAtividade => ({
    titulo: form.titulo,
    descricao: form.descricao || undefined,
    aviso: form.aviso || undefined,
    abre_em: doCampoParaISO(form.abre_em),
    vence_em: doCampoParaISO(form.vence_em),
    nota_maxima: Number(form.nota_maxima) || 10,
  })

  const fechar = () => {
    setCriando(false)
    setEditando(null)
    setForm(FORMULARIO_VAZIO)
  }

  return (
    <div className="space-y-5">
      {error && <Alerta>{error}</Alerta>}

      {criando ? (
        <FormularioDaAtividade
          titulo="Nova atividade"
          valores={form}
          onChange={setForm}
          salvando={isPending}
          onCancelar={fechar}
          onSalvar={() => acao(() => criarAtividade(turmaId, dadosDoForm()), fechar)}
        />
      ) : editando === null ? (
        <Botao
          icone="Plus"
          onClick={() => {
            setForm(FORMULARIO_VAZIO)
            setCriando(true)
          }}
        >
          Nova atividade
        </Botao>
      ) : null}

      {atividades.length === 0 ? (
        <EstadoVazio
          icone="FileText"
          titulo="Nenhuma atividade criada"
          descricao="Crie atividades para os alunos entregarem trabalhos complementares pela plataforma."
        />
      ) : (
        <div className="space-y-3">
          {atividades.map((at) => {
            if (editando === at.id) {
              return (
                <FormularioDaAtividade
                  key={at.id}
                  titulo={`Editando: ${at.titulo}`}
                  valores={form}
                  onChange={setForm}
                  salvando={isPending}
                  onCancelar={fechar}
                  onSalvar={() => acao(() => editarAtividade(at.id, turmaId, dadosDoForm()), fechar)}
                />
              )
            }

            const doAtiv = entregas.filter((e) => e.atividade_id === at.id)
            const corrigidas = doAtiv.filter((e) => e.nota !== null).length
            const expandida = aberta === at.id
            const janela = lerJanela(at.abre_em, at.vence_em)
            const meu = podeMexer(at)

            return (
              <Card key={at.id} padding={false}>
                {/* O cabeçalho não é mais um <button> gigante com outros
                    botões dentro — isso é HTML inválido e faz o clique cair
                    no lugar errado. O clique de abrir/fechar mora no título;
                    editar e apagar são botões irmãos. */}
                <div className="flex items-start justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setAberta(expandida ? null : at.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-[15px] font-bold text-gray-900">
                        {at.titulo}
                      </h3>
                      {janela.estado === 'encerrada' ? (
                        <Selo tom="vermelho" icone="Lock">
                          Encerrada
                        </Selo>
                      ) : janela.estado === 'ainda_nao_abriu' ? (
                        <Selo tom="neutro" icone="Clock">
                          Abre depois
                        </Selo>
                      ) : (
                        <Selo tom="verde" icone="Check">
                          Aberta
                        </Selo>
                      )}
                      <Selo tom="neutro">vale {Number(at.nota_maxima)}</Selo>
                    </div>

                    <div className="mt-1.5 space-y-0.5 text-[12px] text-gray-500">
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 shrink-0" strokeWidth={2.2} />
                        {at.abre_em && <>abre {momentoPorExtenso(at.abre_em)} · </>}
                        {at.vence_em ? (
                          <>vence {momentoPorExtenso(at.vence_em)}</>
                        ) : (
                          <>sem prazo definido</>
                        )}
                      </p>
                      {at.criada_por_nome && (
                        <p className="flex items-center gap-1.5">
                          <UserRound className="h-3 w-3 shrink-0" strokeWidth={2.2} />
                          criada por {at.criada_por_nome}
                          {!meu && ' · você não pode editar'}
                        </p>
                      )}
                    </div>

                    {at.aviso && (
                      <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-accent-800">
                        <AlertTriangle className="mt-px h-3 w-3 shrink-0" strokeWidth={2.2} />
                        <span className="line-clamp-1">{at.aviso}</span>
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-gray-500">
                      <span>
                        <span className="font-semibold tabular-nums text-gray-700">
                          {doAtiv.length}
                        </span>
                        /{totalAlunos} entregaram
                      </span>
                      <span>
                        <span className="font-semibold tabular-nums text-gray-700">
                          {corrigidas}
                        </span>{' '}
                        corrigidas
                      </span>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    {meu ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setForm(paraFormulario(at))
                            setCriando(false)
                            setEditando(at.id)
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
                          aria-label="Editar atividade"
                          title="Editar atividade"
                        >
                          <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                        {/* APAGAR PEDE CONFIRMAÇÃO.
                            Apagar a atividade leva junto todas as entregas
                            dos alunos. Antes bastava um toque, e no celular
                            esse toque acontecia sem querer. */}
                        {confirmando === at.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                acao(() => removerAtividade(at.id, turmaId), () =>
                                  setConfirmando(null)
                                )
                              }
                              className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-red-700"
                            >
                              Apagar mesmo
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmando(null)}
                              className="rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-gray-500 hover:bg-gray-100"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmando(at.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600"
                            aria-label="Remover atividade"
                            title="Remover atividade"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        )}
                      </>
                    ) : (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300"
                        title="Criada por outra pessoa — só quem criou, ou um administrador, pode alterar"
                      >
                        <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                    )}
                  </div>
                </div>

                {expandida && (
                  <div className="border-t border-gray-100">
                    {doAtiv.length === 0 ? (
                      <p className="px-4 py-8 text-center text-[13px] text-gray-500">
                        Nenhuma entrega ainda.
                      </p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {doAtiv.map((en) => {
                          const c = correcao[en.id] ?? {
                            nota: en.nota === null ? '' : String(en.nota),
                            feedback: en.feedback ?? '',
                          }
                          return (
                            <li key={en.id} className="p-4">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[13.5px] font-semibold text-gray-800">
                                  {en.aluno_nome}
                                </p>
                                {en.nota !== null ? (
                                  <Selo tom="verde" icone="Check">
                                    Corrigida — {Number(en.nota)}
                                  </Selo>
                                ) : (
                                  <Selo tom="ambar">Aguardando correção</Selo>
                                )}
                              </div>

                              {en.texto && (
                                <p className="mb-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-[13px] leading-relaxed text-gray-700">
                                  {en.texto}
                                </p>
                              )}

                              {en.anexos.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                  {en.anexos.map((a) => (
                                    <a
                                      key={a.id}
                                      href={a.url ?? '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[12px] font-semibold text-brand-700 ring-1 ring-brand-200/70 transition-colors hover:bg-brand-100"
                                    >
                                      {a.tipo === 'application/pdf' ? (
                                        <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                                      ) : (
                                        <ImageIcon
                                          className="h-3.5 w-3.5 shrink-0"
                                          strokeWidth={2}
                                        />
                                      )}
                                      <span className="truncate">{a.nome}</span>
                                    </a>
                                  ))}
                                </div>
                              )}

                              <div className="mt-2 flex flex-wrap items-end gap-2">
                                <div>
                                  <label className="mb-1 block text-[11.5px] font-semibold text-gray-600">
                                    Nota (até {Number(at.nota_maxima)})
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={Number(at.nota_maxima)}
                                    step="0.1"
                                    value={c.nota}
                                    onChange={(e) =>
                                      setCorrecao((r) => ({
                                        ...r,
                                        [en.id]: { ...c, nota: e.target.value },
                                      }))
                                    }
                                    className="h-9 w-24 rounded-lg border border-gray-200 bg-gray-50/60 px-3 text-center text-[13px] tabular-nums focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                                  />
                                </div>
                                <div className="min-w-[200px] flex-1">
                                  <label className="mb-1 block text-[11.5px] font-semibold text-gray-600">
                                    Comentário para o aluno
                                  </label>
                                  <input
                                    type="text"
                                    value={c.feedback}
                                    onChange={(e) =>
                                      setCorrecao((r) => ({
                                        ...r,
                                        [en.id]: { ...c, feedback: e.target.value },
                                      }))
                                    }
                                    placeholder="Opcional"
                                    className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50/60 px-3 text-[13px] focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                                  />
                                </div>
                                <Botao
                                  icone="Check"
                                  disabled={isPending}
                                  onClick={() =>
                                    acao(() =>
                                      corrigirEntrega(en.id, turmaId, {
                                        nota: c.nota.trim() === '' ? null : Number(c.nota),
                                        feedback: c.feedback,
                                      })
                                    )
                                  }
                                >
                                  Salvar
                                </Botao>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
