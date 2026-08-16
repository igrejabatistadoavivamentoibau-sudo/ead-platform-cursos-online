'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Trash2 } from 'lucide-react'
import { criarAvaliacao, removerAvaliacao, lancarNota } from '@/app/dashboard/professor/actions'
import { Botao, Card, Alerta, Selo, EstadoVazio, CAMPO, Campo, Selecao} from '@/components/ui'

export interface Avaliacao {
  id: string
  titulo: string
  tipo: string
  peso: number
  nota_maxima: number
  data: string | null
}

export interface AlunoNota {
  id: string
  nome: string
  email: string
}

const TIPO_LABEL: Record<string, string> = {
  prova: 'Prova',
  trabalho: 'Trabalho',
  participacao: 'Participação',
  outro: 'Outro',
}

export default function NotasManager({
  turmaId,
  avaliacoes,
  alunos,
  notas,
}: {
  turmaId: string
  avaliacoes: Avaliacao[]
  alunos: AlunoNota[]
  /** Chave "alunoId|avaliacaoId" -> nota */
  notas: Record<string, number | null>
}) {
  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    tipo: 'prova',
    peso: '1',
    nota_maxima: '10',
    data: '',
  })
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
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
        criarAvaliacao(turmaId, {
          titulo: form.titulo,
          tipo: form.tipo,
          peso: Number(form.peso) || 1,
          nota_maxima: Number(form.nota_maxima) || 10,
          data: form.data || undefined,
        }),
      () => {
        setForm({ titulo: '', tipo: 'prova', peso: '1', nota_maxima: '10', data: '' })
        setCriando(false)
      }
    )
  }

  /** Média ponderada do aluno, considerando só o que já foi lançado. */
  const media = (alunoId: string) => {
    let soma = 0
    let pesos = 0
    for (const av of avaliacoes) {
      const v = notas[`${alunoId}|${av.id}`]
      if (v === null || v === undefined) continue
      // Normaliza para escala 0–10 antes de ponderar, para avaliações com
      // nota máxima diferente não distorcerem a média.
      soma += (Number(v) / Number(av.nota_maxima)) * 10 * Number(av.peso)
      pesos += Number(av.peso)
    }
    return pesos > 0 ? soma / pesos : null
  }

  const corMedia = (m: number | null) =>
    m === null ? 'text-gray-300' : m >= 7 ? 'text-brand-700' : m >= 5 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="space-y-5">
      {error && <Alerta>{error}</Alerta>}

      {/* -------- Nova avaliação -------- */}
      {!criando ? (
        <Botao icone="Plus" onClick={() => setCriando(true)}>
          Nova avaliação
        </Botao>
      ) : (
        <Card>
          <form onSubmit={criar}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-[15px] font-bold text-gray-900">Nova avaliação</h3>
              <button
                type="button"
                onClick={() => setCriando(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Campo label="Nome" className="sm:col-span-2">
                <input
                  type="text"
                  required
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex: Prova do Módulo 1"
                  className={CAMPO}
                />
              </Campo>
              <Campo label="Tipo">
                <Selecao
                  valorInicial={form.tipo}
                  aoMudar={(valor) => setForm({ ...form, tipo: valor })}
                  opcoes={[
                    { valor: 'prova', rotulo: 'Prova' },
                    { valor: 'trabalho', rotulo: 'Trabalho' },
                    { valor: 'participacao', rotulo: 'Participação' },
                    { valor: 'outro', rotulo: 'Outro' },
                  ]}
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
              <Campo label="Peso" dica="Quanto vale na média">
                <input
                  type="number"
                  min={0.5}
                  step="0.5"
                  value={form.peso}
                  onChange={(e) => setForm({ ...form, peso: e.target.value })}
                  className={CAMPO}
                />
              </Campo>
            </div>

            <div className="mt-4 flex gap-2">
              <Botao type="submit" disabled={isPending}>
                {isPending ? 'Criando...' : 'Criar avaliação'}
              </Botao>
              <Botao type="button" variante="fantasma" onClick={() => setCriando(false)}>
                Cancelar
              </Botao>
            </div>
          </form>
        </Card>
      )}

      {/* -------- Boletim -------- */}
      {avaliacoes.length === 0 ? (
        <EstadoVazio
          icone="GraduationCap"
          titulo="Nenhuma avaliação criada"
          descricao="Crie a primeira avaliação para começar a lançar as notas da turma."
        />
      ) : alunos.length === 0 ? (
        <EstadoVazio
          icone="Users2"
          titulo="Nenhum aluno matriculado"
          descricao="Matricule alunos nesta turma para lançar notas."
        />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="sticky left-0 z-10 min-w-[190px] bg-gray-50/95 px-4 py-3 text-left font-semibold text-gray-700 backdrop-blur-sm">
                    Aluno
                  </th>
                  {avaliacoes.map((av) => (
                    <th key={av.id} className="px-2 py-3 text-center font-semibold text-gray-600">
                      <div className="flex flex-col items-center gap-1">
                        <span className="max-w-[110px] truncate" title={av.titulo}>
                          {av.titulo}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
                          <span>{TIPO_LABEL[av.tipo]}</span>
                          <span>·</span>
                          <span>peso {Number(av.peso)}</span>
                        </span>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => acao(() => removerAvaliacao(av.id, turmaId))}
                          className="text-gray-300 transition-colors hover:text-red-600"
                          aria-label={`Remover ${av.titulo}`}
                          title="Remover avaliação"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Média</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {alunos.map((aluno) => {
                  const m = media(aluno.id)
                  return (
                    <tr key={aluno.id} className="transition-colors hover:bg-brand-50/30">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                        <p className="truncate font-medium text-gray-800">{aluno.nome}</p>
                        <p className="truncate text-[11px] text-gray-500">{aluno.email}</p>
                      </td>

                      {avaliacoes.map((av) => {
                        const chave = `${aluno.id}|${av.id}`
                        const valor = rascunho[chave] ?? (notas[chave] ?? '')
                        return (
                          <td key={av.id} className="px-2 py-2.5 text-center">
                            <input
                              type="number"
                              min={0}
                              max={Number(av.nota_maxima)}
                              step="0.1"
                              value={valor === null ? '' : String(valor)}
                              disabled={isPending}
                              onChange={(e) =>
                                setRascunho((r) => ({ ...r, [chave]: e.target.value }))
                              }
                              onBlur={(e) => {
                                const txt = e.target.value.trim()
                                const novo = txt === '' ? null : Number(txt)
                                const antigo = notas[chave] ?? null
                                if (novo === antigo) return
                                if (novo !== null && (isNaN(novo) || novo < 0 || novo > Number(av.nota_maxima))) {
                                  setError(`A nota deve ficar entre 0 e ${Number(av.nota_maxima)}.`)
                                  return
                                }
                                acao(() => lancarNota(av.id, aluno.id, turmaId, novo))
                              }}
                              placeholder="—"
                              aria-label={`Nota de ${aluno.nome} em ${av.titulo}`}
                              className="h-8 w-16 rounded-md border border-gray-200 bg-gray-50/60 text-center text-[13px] tabular-nums transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:opacity-50"
                            />
                          </td>
                        )
                      })}

                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-display text-[15px] font-bold tabular-nums ${corMedia(m)}`}>
                          {m === null ? '—' : m.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 px-4 py-3 text-[11.5px] text-gray-500">
            <span>A nota é salva sozinha ao sair do campo.</span>
            <span className="flex items-center gap-3">
              <Selo tom="verde">≥ 7,0</Selo>
              <Selo tom="ambar">5,0 a 6,9</Selo>
              <Selo tom="vermelho">&lt; 5,0</Selo>
            </span>
          </div>
        </Card>
      )}
    </div>
  )
}
