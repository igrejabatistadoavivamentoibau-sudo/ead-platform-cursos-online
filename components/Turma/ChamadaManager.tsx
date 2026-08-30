'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  CalendarPlus,
  Save,
  FileDown,
  Sheet,
  Trash2,
  Users2,
  Sparkles,
} from 'lucide-react'
import {
  criarEncontroTurma,
  salvarChamadaTurma,
  removerEncontro,
} from '@/app/dashboard/professor/actions'
import { Botao, Card, Alerta, Selo, EstadoVazio, CAMPO } from '@/components/ui'

export interface EncontroItem {
  id: string
  titulo: string | null
  data: string
  automatico: boolean
}

export interface LinhaPresenca {
  aluno_id: string
  nome: string
  email: string
  presente: boolean
  /** Ainda sem marca neste encontro — entrou na turma depois dele. */
  semRegistro?: boolean
  /** Tem marca, mas já não está na turma. Aparece para não sumir do registro. */
  saiu?: boolean
}

function formatarData(d: string) {
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

export default function ChamadaManager({
  turmaId,
  presencial,
  encontros,
  encontroAtual,
  linhas,
}: {
  turmaId: string
  presencial: boolean
  encontros: EncontroItem[]
  encontroAtual: EncontroItem | null
  linhas: LinhaPresenca[]
}) {
  const [lista, setLista] = useState(linhas)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [salvo, setSalvo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const presentes = lista.filter((l) => l.presente).length

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
      async () => {
        const id = await criarEncontroTurma(turmaId, { titulo: titulo || undefined, data })
        router.push(`/dashboard/professor/turmas/${turmaId}/chamada?encontro=${id}`)
      },
      () => setTitulo('')
    )
  }

  const salvar = () => {
    setSalvo(false)
    acao(
      () =>
        salvarChamadaTurma(
          encontroAtual!.id,
          turmaId,
          lista.map((l) => ({ aluno_id: l.aluno_id, presente: l.presente }))
        ),
      () => {
        setSalvo(true)
        setTimeout(() => setSalvo(false), 2500)
      }
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* ================= Encontros ================= */}
      <div className="space-y-4">
        {presencial ? (
          <Card>
            <form onSubmit={criar} className="space-y-2.5">
              <p className="text-[12.5px] font-semibold text-gray-700">Novo encontro</p>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Tema do encontro (opcional)"
                className={CAMPO}
              />
              <input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className={CAMPO}
              />
              <Botao type="submit" icone="CalendarPlus" disabled={isPending} className="w-full">
                {isPending ? 'Criando...' : 'Criar encontro'}
              </Botao>
            </form>
          </Card>
        ) : (
          <Alerta tom="info">
            <p className="font-semibold">Frequência automática</p>
            <p className="mt-0.5">
              Este curso é EAD: a presença é registrada sozinha quando o aluno conclui cada vídeo
              aula. Você não precisa preencher nada.
            </p>
          </Alerta>
        )}

        <div>
          <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            {encontros.length} encontro{encontros.length === 1 ? '' : 's'}
          </p>
          {encontros.length > 0 ? (
            <div className="overflow-hidden rounded-xl bg-white ring-1 ring-brand-950/[0.07]">
              {encontros.map((e) => {
                const ativo = e.id === encontroAtual?.id
                return (
                  <a
                    key={e.id}
                    href={`/dashboard/professor/turmas/${turmaId}/chamada?encontro=${e.id}`}
                    className={`flex items-center gap-2.5 border-b border-gray-100 px-3.5 py-3 last:border-0 transition-colors ${
                      ativo ? 'bg-brand-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        ativo ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {e.automatico ? (
                        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                      ) : (
                        <Users2 className="h-3.5 w-3.5" strokeWidth={2} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[13px] font-medium ${
                          ativo ? 'text-brand-800' : 'text-gray-800'
                        }`}
                      >
                        {e.titulo || 'Encontro'}
                      </span>
                      <span className="text-[11.5px] text-gray-500">{formatarData(e.data)}</span>
                    </span>
                    {e.automatico && <Selo tom="azul">auto</Selo>}
                  </a>
                )
              })}
            </div>
          ) : (
            <Card>
              <p className="text-[13px] text-gray-500">
                {presencial
                  ? 'Nenhum encontro criado ainda.'
                  : 'Nenhuma aula concluída pelos alunos ainda.'}
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* ================= Lista do encontro ================= */}
      <div>
        {error && (
          <div className="mb-4">
            <Alerta>{error}</Alerta>
          </div>
        )}

        {!encontroAtual ? (
          <EstadoVazio
            icone="ClipboardCheck"
            titulo="Escolha um encontro"
            descricao={
              presencial
                ? 'Selecione um encontro à esquerda ou crie um novo para fazer a chamada.'
                : 'A frequência aparece aqui conforme os alunos concluem as vídeo aulas.'
            }
          />
        ) : (
          <Card padding={false}>
            {/* Cabeçalho do encontro */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-[15px] font-bold text-gray-900">
                    {encontroAtual.titulo || 'Encontro'}
                  </h3>
                  {encontroAtual.automatico && <Selo tom="azul" icone="Sparkles">automático</Selo>}
                </div>
                <p className="mt-0.5 text-[12.5px] text-gray-500">
                  {formatarData(encontroAtual.data)} ·{' '}
                  <span className="font-semibold text-gray-700 tabular-nums">{presentes}</span> de{' '}
                  {lista.length} presentes
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/chamada/${encontroAtual.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-[13px] font-semibold text-gray-700 ring-1 ring-gray-200 transition-all hover:bg-gray-50 hover:ring-gray-300"
                >
                  <FileDown className="h-[15px] w-[15px] text-red-600" strokeWidth={1.9} />
                  PDF timbrado
                </a>
                <a
                  href={`/api/chamada/${encontroAtual.id}/excel`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-[13px] font-semibold text-gray-700 ring-1 ring-gray-200 transition-all hover:bg-gray-50 hover:ring-gray-300"
                >
                  <Sheet className="h-[15px] w-[15px] text-brand-600" strokeWidth={1.9} />
                  Excel
                </a>
                {presencial && (
                  <Botao
                    variante="fantasma"
                    tamanho="md"
                    icone="Trash2"
                    disabled={isPending}
                    onClick={() =>
                      acao(async () => {
                        await removerEncontro(encontroAtual.id, turmaId)
                        router.push(`/dashboard/professor/turmas/${turmaId}/chamada`)
                      })
                    }
                    className="!text-gray-400 hover:!text-red-600 hover:!bg-red-50"
                    aria-label="Remover encontro"
                  />
                )}
              </div>
            </div>

            {/* Marcação rápida */}
            {presencial && lista.length > 0 && (
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setLista((p) => p.map((l) => ({ ...l, presente: true })))}
                  className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                >
                  Marcar todos presentes
                </button>
                <button
                  type="button"
                  onClick={() => setLista((p) => p.map((l) => ({ ...l, presente: false })))}
                  className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-gray-500 transition-colors hover:bg-gray-100"
                >
                  Limpar
                </button>
              </div>
            )}

            {/* Alunos */}
            {lista.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {lista.map((l) => (
                  <li key={l.aluno_id} className="flex items-center gap-3.5 px-4 py-3">
                    <button
                      type="button"
                      disabled={!presencial}
                      onClick={() =>
                        setLista((p) =>
                          p.map((x) =>
                            x.aluno_id === l.aluno_id ? { ...x, presente: !x.presente } : x
                          )
                        )
                      }
                      aria-pressed={l.presente}
                      aria-label={`Presença de ${l.nome}`}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 transition-all ${
                        l.presente
                          ? 'bg-brand-600 text-white ring-brand-600'
                          : 'bg-white text-transparent ring-gray-300'
                      } ${presencial ? 'hover:ring-brand-400' : 'cursor-default opacity-90'}`}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 truncate text-[13.5px] font-medium text-gray-800">
                        {l.nome}
                        {/* Entrou na turma depois deste encontro. Sem esta
                            marca, ele apareceria como falta de alguém que
                            ainda nem era da turma no dia. */}
                        {l.semRegistro && (
                          <span
                            className="rounded-full bg-blue-50 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-blue-700 ring-1 ring-blue-200"
                            data-teste="sem-registro"
                          >
                            entrou depois
                          </span>
                        )}
                        {l.saiu && (
                          <span
                            className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-gray-500"
                            data-teste="saiu-da-turma"
                          >
                            saiu da turma
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11.5px] text-gray-500">{l.email}</p>
                    </div>

                    {!l.presente && !l.semRegistro && <Selo tom="vermelho">Ausente</Selo>}
                    {l.semRegistro && <Selo tom="neutro">Sem marca</Selo>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-10 text-center text-[13px] text-gray-500">
                Nenhum aluno matriculado nesta turma ainda.
              </div>
            )}

            {presencial && lista.length > 0 && (
              <div className="flex items-center gap-3 border-t border-gray-100 p-4">
                <Botao icone="Save" onClick={salvar} disabled={isPending}>
                  {isPending ? 'Salvando...' : 'Salvar chamada'}
                </Botao>
                {salvo && (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700">
                    <Save className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Chamada salva
                  </span>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
