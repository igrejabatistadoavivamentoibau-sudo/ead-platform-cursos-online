'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Trash2, Paperclip, Check } from 'lucide-react'
import {
  criarAtividade,
  removerAtividade,
  corrigirEntrega,
} from '@/app/dashboard/professor/actions'
import { Botao, Card, Alerta, Selo, EstadoVazio, CAMPO, Campo } from '@/components/ui'

export interface AtividadeItem {
  id: string
  titulo: string
  descricao: string | null
  prazo: string | null
  nota_maxima: number
}

export interface EntregaItem {
  id: string
  atividade_id: string
  aluno_id: string
  aluno_nome: string
  texto: string | null
  arquivo_nome: string | null
  arquivo_url: string | null
  entregue_em: string
  nota: number | null
  feedback: string | null
}

function formatarData(d: string) {
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

export default function AtividadesManager({
  turmaId,
  atividades,
  entregas,
  totalAlunos,
}: {
  turmaId: string
  atividades: AtividadeItem[]
  entregas: EntregaItem[]
  totalAlunos: number
}) {
  const [criando, setCriando] = useState(false)
  const [aberta, setAberta] = useState<string | null>(atividades[0]?.id ?? null)
  const [form, setForm] = useState({ titulo: '', descricao: '', prazo: '', nota_maxima: '10' })
  const [correcao, setCorrecao] = useState<Record<string, { nota: string; feedback: string }>>({})
  const [error, setError] = useState<string | null>(null)
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

  const criar = (e: React.FormEvent) => {
    e.preventDefault()
    acao(
      () =>
        criarAtividade(turmaId, {
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          prazo: form.prazo || undefined,
          nota_maxima: Number(form.nota_maxima) || 10,
        }),
      () => {
        setForm({ titulo: '', descricao: '', prazo: '', nota_maxima: '10' })
        setCriando(false)
      }
    )
  }

  return (
    <div className="space-y-5">
      {error && <Alerta>{error}</Alerta>}

      {!criando ? (
        <Botao icone="Plus" onClick={() => setCriando(true)}>
          Nova atividade
        </Botao>
      ) : (
        <Card>
          <form onSubmit={criar}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-[15px] font-bold text-gray-900">Nova atividade</h3>
              <button
                type="button"
                onClick={() => setCriando(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Título" className="sm:col-span-2">
                <input
                  type="text"
                  required
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex: Trabalho sobre liderança servil"
                  className={CAMPO}
                />
              </Campo>
              <Campo label="Enunciado" className="sm:col-span-2">
                <textarea
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Explique o que o aluno deve entregar"
                  className={`${CAMPO} resize-none`}
                />
              </Campo>
              <Campo label="Prazo de entrega">
                <input
                  type="date"
                  value={form.prazo}
                  onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                  className={CAMPO}
                />
              </Campo>
              <Campo label="Nota máxima">
                <input
                  type="number"
                  min={1}
                  step="0.5"
                  value={form.nota_maxima}
                  onChange={(e) => setForm({ ...form, nota_maxima: e.target.value })}
                  className={CAMPO}
                />
              </Campo>
            </div>

            <div className="mt-4 flex gap-2">
              <Botao type="submit" disabled={isPending}>
                {isPending ? 'Criando...' : 'Criar atividade'}
              </Botao>
              <Botao type="button" variante="fantasma" onClick={() => setCriando(false)}>
                Cancelar
              </Botao>
            </div>
          </form>
        </Card>
      )}

      {atividades.length === 0 ? (
        <EstadoVazio
          icone="FileText"
          titulo="Nenhuma atividade criada"
          descricao="Crie atividades para os alunos entregarem trabalhos complementares pela plataforma."
        />
      ) : (
        <div className="space-y-3">
          {atividades.map((at) => {
            const doAtiv = entregas.filter((e) => e.atividade_id === at.id)
            const corrigidas = doAtiv.filter((e) => e.nota !== null).length
            const expandida = aberta === at.id

            return (
              <Card key={at.id} padding={false}>
                <button
                  type="button"
                  onClick={() => setAberta(expandida ? null : at.id)}
                  className="flex w-full items-start justify-between gap-4 p-4 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-[15px] font-bold text-gray-900">
                        {at.titulo}
                      </h3>
                      {at.prazo && <Selo tom="neutro" icone="Calendar">{formatarData(at.prazo)}</Selo>}
                      <Selo tom="neutro">vale {Number(at.nota_maxima)}</Selo>
                    </div>
                    {at.descricao && (
                      <p className="mt-1 line-clamp-2 text-[13px] text-gray-500">{at.descricao}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-gray-500">
                      <span>
                        <span className="font-semibold text-gray-700 tabular-nums">
                          {doAtiv.length}
                        </span>
                        /{totalAlunos} entregaram
                      </span>
                      <span>
                        <span className="font-semibold text-gray-700 tabular-nums">
                          {corrigidas}
                        </span>{' '}
                        corrigidas
                      </span>
                    </div>
                  </div>

                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      acao(() => removerAtividade(at.id, turmaId))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation()
                        acao(() => removerAtividade(at.id, turmaId))
                      }
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label="Remover atividade"
                    title="Remover atividade"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                </button>

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

                              {en.arquivo_url && (
                                <a
                                  href={en.arquivo_url}
                                  target="_blank"
                                  rel="noopener"
                                  className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:text-brand-800"
                                >
                                  <Paperclip className="h-3.5 w-3.5" strokeWidth={2} />
                                  {en.arquivo_nome ?? 'Arquivo anexado'}
                                </a>
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
