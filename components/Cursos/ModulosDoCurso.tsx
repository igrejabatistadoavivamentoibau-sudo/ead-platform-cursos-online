'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, ChevronUp, ChevronDown, PenLine, Trash2, X, Plus, Video, Users2 } from 'lucide-react'
import {
  criarModulo,
  renomearModulo,
  moverModulo,
  removerModulo,
  moverAulaDeModulo,
} from '@/app/dashboard/admin/actions'
import { Botao, Card, Alerta, Selo, CAMPO, Campo } from '@/components/ui'

export interface AulaDoModulo {
  id: string
  numero: number
  titulo: string
  publicada: boolean
}

export interface ModuloItem {
  id: string
  nome: string
  descricao: string | null
  ordem: number
  aulas: AulaDoModulo[]
  turmas: number
}

/* ============================================================
   OS MÓDULOS DO CURSO

   A forma da escola, dita pela coordenação:

     Curso: Escola de Líderes
       Módulo 1  →  várias turmas
       Módulo 2  →  várias turmas

   O que esta tela precisa deixar claro, porque é onde as pessoas erram:
   a ORDEM não é enfeite. É ela que decide o pré-requisito — só entra numa
   turma do Módulo 2 quem foi aprovado no Módulo 1. Mover um módulo de
   lugar muda quem pode entrar em quê. Por isso a ordem aparece como
   número grande à esquerda, e a troca é uma casa por vez, com seta.
   ============================================================ */

const VAZIO = { nome: '', descricao: '' }

export default function ModulosDoCurso({
  cursoId,
  modulos,
}: {
  cursoId: string
  modulos: ModuloItem[]
}) {
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState(VAZIO)
  const [confirmando, setConfirmando] = useState<string | null>(null)
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

  const fechar = () => {
    setCriando(false)
    setEditando(null)
    setForm(VAZIO)
  }

  return (
    <div className="space-y-4">
      {error && <Alerta>{error}</Alerta>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-bold text-gray-900">Módulos do curso</h2>
          <p className="mt-0.5 max-w-xl text-[12.5px] leading-relaxed text-gray-500">
            Cada módulo é uma etapa. As aulas e as turmas pertencem ao módulo — é o que permite
            várias turmas de primeiro módulo e várias de segundo, ao mesmo tempo.{' '}
            <b>A ordem decide o pré-requisito:</b> só entra numa turma do módulo seguinte quem foi
            aprovado no anterior.
          </p>
        </div>
        {!criando && editando === null && (
          <Botao
            icone="Plus"
            tamanho="sm"
            onClick={() => {
              setForm(VAZIO)
              setCriando(true)
            }}
          >
            Novo módulo
          </Botao>
        )}
      </div>

      {(criando || editando !== null) && (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (criando) acao(() => criarModulo(cursoId, form), fechar)
              else acao(() => renomearModulo(editando!, cursoId, form), fechar)
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-[14.5px] font-bold text-gray-900">
                {criando ? 'Novo módulo' : 'Renomear módulo'}
              </h3>
              <button type="button" onClick={fechar} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Nome">
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Módulo 2 — Fundamentos da liderança"
                  className={CAMPO}
                />
              </Campo>
              <Campo label="Descrição (opcional)">
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Uma linha sobre o que se estuda aqui"
                  className={CAMPO}
                />
              </Campo>
            </div>

            <div className="mt-3 flex gap-2">
              <Botao type="submit" tamanho="sm" disabled={isPending}>
                {isPending ? 'Salvando...' : 'Salvar'}
              </Botao>
              <Botao type="button" tamanho="sm" variante="fantasma" onClick={fechar}>
                Cancelar
              </Botao>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {modulos.map((m, i) => (
          <Card key={m.id} padding={false}>
            <div className="flex items-start gap-3.5 p-4">
              {/* O número da ordem, grande. É o que define o pré-requisito,
                  então é o que precisa ser lido primeiro. */}
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-display text-[17px] font-bold text-brand-700 ring-1 ring-brand-200">
                {m.ordem}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-[15px] font-bold text-gray-900">{m.nome}</h3>
                  <Selo tom="neutro" icone="Video">
                    {m.aulas.length} {m.aulas.length === 1 ? 'aula' : 'aulas'}
                  </Selo>
                  <Selo tom={m.turmas > 0 ? 'azul' : 'neutro'} icone="Users2">
                    {m.turmas} {m.turmas === 1 ? 'turma' : 'turmas'}
                  </Selo>
                </div>
                {m.descricao && (
                  <p className="mt-0.5 text-[12.5px] text-gray-500">{m.descricao}</p>
                )}

                {m.aulas.length > 0 && (
                  <ul className="mt-2.5 space-y-1">
                    {m.aulas.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center gap-2 text-[12.5px] text-gray-600"
                      >
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100 text-[10.5px] font-bold text-gray-500">
                          {a.numero}
                        </span>
                        <span className={a.publicada ? '' : 'text-gray-400'}>
                          {a.titulo}
                          {!a.publicada && ' (rascunho)'}
                        </span>

                        {/* Mover aula entre módulos.
                            O select só aparece se houver para onde mover —
                            um campo com uma opção só é ruído. */}
                        {modulos.length > 1 && (
                          <select
                            value=""
                            disabled={isPending}
                            onChange={(e) => {
                              if (!e.target.value) return
                              acao(() => moverAulaDeModulo(a.id, cursoId, e.target.value))
                            }}
                            className="ml-auto rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[11.5px] text-gray-600"
                            aria-label={`Mover ${a.titulo} para outro módulo`}
                          >
                            <option value="">mover para…</option>
                            {modulos
                              .filter((x) => x.id !== m.id)
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.nome}
                                </option>
                              ))}
                          </select>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-center gap-1">
                <button
                  type="button"
                  disabled={i === 0 || isPending}
                  onClick={() => acao(() => moverModulo(m.id, cursoId, 'cima'))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  aria-label="Subir módulo"
                >
                  <ChevronUp className="h-4 w-4" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  disabled={i === modulos.length - 1 || isPending}
                  onClick={() => acao(() => moverModulo(m.id, cursoId, 'baixo'))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  aria-label="Descer módulo"
                >
                  <ChevronDown className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setForm({ nome: m.nome, descricao: m.descricao ?? '' })
                    setCriando(false)
                    setEditando(m.id)
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
                  aria-label="Renomear módulo"
                >
                  <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
                </button>

                {confirmando === m.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        acao(() => removerModulo(m.id, cursoId), () => setConfirmando(null))
                      }
                      className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-red-700"
                    >
                      Apagar
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
                    onClick={() => setConfirmando(m.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label="Apagar módulo"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
