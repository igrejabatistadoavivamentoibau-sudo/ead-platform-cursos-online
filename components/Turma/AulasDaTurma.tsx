'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Lock, Unlock, PlayCircle, MessageSquare, CalendarRange, X } from 'lucide-react'
import {
  definirJanelaDaAula,
  definirJanelaDeTodasAsAulas,
  decidirLiberacaoDeAula,
} from '@/app/dashboard/professor/actions'
import {
  lerJanela,
  momentoPorExtenso,
  doCampoParaISO,
  doISOParaCampo,
  fimDoDia,
} from '@/lib/janelaDaAtividade'
import { Botao, Card, Alerta, Selo, EstadoVazio, CAMPO, Campo } from '@/components/ui'

export interface AulaDaTurma {
  id: string
  numero: number
  titulo: string
  abre_em: string | null
  vence_em: string | null
  concluidas: number
}

export interface PedidoDeLiberacao {
  id: string
  aulaId: string
  aulaTitulo: string
  alunoNome: string
  motivo: string
  status: 'pendente' | 'liberada' | 'recusada'
  resposta: string | null
  liberaAte: string | null
  criadoEm: string
}

/* ============================================================
   AS AULAS DENTRO DA TURMA

   Esta tela não edita a AULA — ela edita a janela da aula NESTA TURMA. É
   uma distinção que precisa ficar visível, senão o professor acha que
   está mudando o conteúdo e some com a aula de outra turma. Por isso o
   título e o texto de apoio insistem em "nesta turma".
   ============================================================ */

const VAZIO = { abre_em: '', vence_em: '' }

function LinhaDaAula({
  aula,
  turmaId,
  aoAgir,
  ocupado,
}: {
  aula: AulaDaTurma
  turmaId: string
  aoAgir: (fn: () => Promise<unknown>, aoTerminar?: () => void) => void
  ocupado: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    abre_em: doISOParaCampo(aula.abre_em),
    vence_em: doISOParaCampo(aula.vence_em),
  })

  const janela = lerJanela(aula.abre_em, aula.vence_em)
  const temJanela = !!aula.abre_em || !!aula.vence_em

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Aula {aula.numero}
            </span>
            <h3 className="font-display text-[14.5px] font-bold text-gray-900">{aula.titulo}</h3>
            {!temJanela ? (
              <Selo tom="neutro" icone="Unlock">
                Sempre disponível
              </Selo>
            ) : janela.estado === 'encerrada' ? (
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
          </div>

          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-gray-500">
            <Clock className="h-3 w-3 shrink-0" strokeWidth={2.2} />
            {temJanela ? (
              <>
                {aula.abre_em && <>abre {momentoPorExtenso(aula.abre_em)}</>}
                {aula.abre_em && aula.vence_em && ' · '}
                {aula.vence_em && <>fecha {momentoPorExtenso(aula.vence_em)}</>}
              </>
            ) : (
              <>sem data marcada — o aluno assiste quando quiser</>
            )}
          </p>

          <p className="mt-0.5 text-[12px] text-gray-400">
            <span className="font-semibold tabular-nums text-gray-600">{aula.concluidas}</span>{' '}
            {aula.concluidas === 1 ? 'aluno concluiu' : 'alunos concluíram'}
          </p>
        </div>

        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={editando ? 'X' : 'CalendarRange'}
          onClick={() => setEditando(!editando)}
        >
          {editando ? 'Fechar' : temJanela ? 'Mudar data' : 'Marcar data'}
        </Botao>
      </div>

      {editando && (
        <div className="mt-3 rounded-xl bg-gray-50 p-3.5 ring-1 ring-gray-200">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Libera em">
              <input
                type="datetime-local"
                value={form.abre_em}
                onChange={(e) => setForm({ ...form, abre_em: e.target.value })}
                className={CAMPO}
              />
            </Campo>
            <Campo label="Fecha em">
              <input
                type="datetime-local"
                value={form.vence_em}
                onChange={(e) => setForm({ ...form, vence_em: e.target.value })}
                className={CAMPO}
              />
              {form.vence_em && !form.vence_em.endsWith('23:59') && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, vence_em: fimDoDia(form.vence_em.slice(0, 10)) })}
                  className="mt-1.5 text-[11.5px] font-semibold text-brand-700 underline underline-offset-2"
                >
                  Usar o fim do dia (23:59)
                </button>
              )}
            </Campo>
          </div>

          <p className="mt-2 text-[11.5px] text-gray-500">
            Deixe os dois vazios para a aula ficar sempre disponível. Depois que fecha, o aluno
            ainda pode pedir liberação para você.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Botao
              tamanho="sm"
              disabled={ocupado}
              onClick={() =>
                aoAgir(
                  () =>
                    definirJanelaDaAula(turmaId, aula.id, {
                      abre_em: doCampoParaISO(form.abre_em),
                      vence_em: doCampoParaISO(form.vence_em),
                    }),
                  () => setEditando(false)
                )
              }
            >
              Salvar
            </Botao>
            {temJanela && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                disabled={ocupado}
                onClick={() => {
                  setForm(VAZIO)
                  aoAgir(
                    () => definirJanelaDaAula(turmaId, aula.id, { abre_em: null, vence_em: null }),
                    () => setEditando(false)
                  )
                }}
              >
                Tirar a data
              </Botao>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

export default function AulasDaTurma({
  turmaId,
  aulas,
  pedidos,
}: {
  turmaId: string
  aulas: AulaDaTurma[]
  pedidos: PedidoDeLiberacao[]
}) {
  const [error, setError] = useState<string | null>(null)
  const [emTodas, setEmTodas] = useState(false)
  const [todas, setTodas] = useState(VAZIO)
  const [respostas, setRespostas] = useState<Record<string, { resposta: string; ate: string }>>({})
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

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

  const pendentes = pedidos.filter((p) => p.status === 'pendente')
  const respondidos = pedidos.filter((p) => p.status !== 'pendente')

  return (
    <div className="space-y-5">
      {error && <Alerta>{error}</Alerta>}

      {/* OS PEDIDOS VÊM PRIMEIRO.
          Tem gente esperando resposta para conseguir estudar. Isso ganha
          de qualquer configuração de data. */}
      {pendentes.length > 0 && (
        <Card padding={false}>
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
              <Unlock className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div>
              <h2 className="font-display text-[15px] font-bold text-gray-900">
                Pedidos para assistir
              </h2>
              <p className="text-[12px] text-gray-500">
                <span className="font-semibold tabular-nums text-gray-700">{pendentes.length}</span>{' '}
                {pendentes.length === 1 ? 'aluno esperando' : 'alunos esperando'} sua resposta
              </p>
            </div>
          </div>

          <ul className="divide-y divide-gray-100">
            {pendentes.map((p) => {
              const r = respostas[p.id] ?? { resposta: '', ate: '' }
              return (
                <li key={p.id} className="p-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-gray-800">{p.alunoNome}</p>
                    <span className="text-[12.5px] text-gray-500">· {p.aulaTitulo}</span>
                  </div>
                  <p className="mb-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-[13px] leading-relaxed text-gray-700">
                    {p.motivo}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo label="Resposta para o aluno (opcional)">
                      <input
                        type="text"
                        value={r.resposta}
                        onChange={(e) =>
                          setRespostas((x) => ({ ...x, [p.id]: { ...r, resposta: e.target.value } }))
                        }
                        placeholder="Ex: Assista até domingo, Deus te abençoe."
                        className={CAMPO}
                      />
                    </Campo>
                    <Campo label="Liberar até (opcional)">
                      <input
                        type="datetime-local"
                        value={r.ate}
                        onChange={(e) =>
                          setRespostas((x) => ({ ...x, [p.id]: { ...r, ate: e.target.value } }))
                        }
                        className={CAMPO}
                      />
                      {/* Sem prazo, o "sim" vira um sim para sempre. Com
                          prazo, a aula fecha de novo sozinha e o professor
                          não precisa lembrar de nada. */}
                      <p className="mt-1 text-[11.5px] text-gray-500">
                        Vazio = liberado sem prazo.
                      </p>
                    </Campo>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Botao
                      tamanho="sm"
                      icone="Unlock"
                      disabled={isPending}
                      onClick={() =>
                        acao(() =>
                          decidirLiberacaoDeAula(p.id, turmaId, {
                            status: 'liberada',
                            resposta: r.resposta,
                            libera_ate: doCampoParaISO(r.ate),
                          })
                        )
                      }
                    >
                      Liberar
                    </Botao>
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      disabled={isPending}
                      onClick={() =>
                        acao(() =>
                          decidirLiberacaoDeAula(p.id, turmaId, {
                            status: 'recusada',
                            resposta: r.resposta,
                          })
                        )
                      }
                    >
                      Não liberar
                    </Botao>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* ---------- A janela de todas de uma vez ---------- */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[15px] font-bold text-gray-900">
              Quando esta turma pode assistir
            </h2>
            <p className="mt-0.5 text-[12.5px] text-gray-500">
              As datas valem só para <b>esta turma</b>. Outra turma do mesmo curso segue com as
              datas dela.
            </p>
          </div>
          <Botao
            variante="secundario"
            tamanho="sm"
            icone={emTodas ? 'X' : 'CalendarRange'}
            onClick={() => setEmTodas(!emTodas)}
          >
            {emTodas ? 'Fechar' : 'Marcar todas de uma vez'}
          </Botao>
        </div>

        {emTodas && (
          <div className="mt-4 rounded-xl bg-gray-50 p-3.5 ring-1 ring-gray-200">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Libera em">
                <input
                  type="datetime-local"
                  value={todas.abre_em}
                  onChange={(e) => setTodas({ ...todas, abre_em: e.target.value })}
                  className={CAMPO}
                />
              </Campo>
              <Campo label="Fecha em">
                <input
                  type="datetime-local"
                  value={todas.vence_em}
                  onChange={(e) => setTodas({ ...todas, vence_em: e.target.value })}
                  className={CAMPO}
                />
              </Campo>
            </div>
            <p className="mt-2 text-[11.5px] text-gray-500">
              Isto substitui a data de <b>todas</b> as aulas desta turma. Com os dois campos
              vazios, todas voltam a ficar sempre disponíveis.
            </p>
            <div className="mt-3">
              <Botao
                tamanho="sm"
                disabled={isPending}
                onClick={() =>
                  acao(
                    () =>
                      definirJanelaDeTodasAsAulas(turmaId, {
                        abre_em: doCampoParaISO(todas.abre_em),
                        vence_em: doCampoParaISO(todas.vence_em),
                      }),
                    () => setEmTodas(false)
                  )
                }
              >
                Aplicar em todas
              </Botao>
            </div>
          </div>
        )}
      </Card>

      {/* ---------- Aula por aula ---------- */}
      {aulas.length === 0 ? (
        <EstadoVazio
          icone="Video"
          titulo="Nenhuma aula publicada"
          descricao="As aulas são do curso. Publique aulas no curso desta turma para poder marcar datas aqui."
        />
      ) : (
        <Card padding={false}>
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200">
              <PlayCircle className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h2 className="font-display text-[15px] font-bold text-gray-900">
              Aulas do curso ({aulas.length})
            </h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {aulas.map((a) => (
              <LinhaDaAula
                key={a.id}
                aula={a}
                turmaId={turmaId}
                aoAgir={acao}
                ocupado={isPending}
              />
            ))}
          </ul>
        </Card>
      )}

      {/* ---------- Histórico das decisões ---------- */}
      {respondidos.length > 0 && (
        <Card padding={false}>
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
              <MessageSquare className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h2 className="font-display text-[15px] font-bold text-gray-900">
              Pedidos já respondidos
            </h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {respondidos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                {p.status === 'liberada' ? (
                  <Selo tom="verde" icone="Unlock">
                    Liberada
                  </Selo>
                ) : (
                  <Selo tom="neutro" icone="Lock">
                    Não liberada
                  </Selo>
                )}
                <span className="text-[13px] font-medium text-gray-800">{p.alunoNome}</span>
                <span className="text-[12.5px] text-gray-500">· {p.aulaTitulo}</span>
                {p.liberaAte && (
                  <span className="text-[12px] text-gray-400">
                    até {momentoPorExtenso(p.liberaAte)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
