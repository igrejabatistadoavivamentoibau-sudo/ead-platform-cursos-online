'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle } from 'lucide-react'
import { removerTurma, resumoDaTurma } from '@/app/dashboard/admin/actions'
import { Alerta } from '@/components/ui'

interface Resumo {
  alunos: number
  encontros: number
  avaliacoes: number
  atividades: number
}

/**
 * Exclusão de turma em dois passos.
 *
 * O primeiro clique não apaga nada: ele vai buscar no banco o que existe
 * dentro da turma e mostra na tela. Só o segundo clique apaga. Preferi esse
 * caminho a um "tem certeza?" genérico porque o estrago aqui é irreversível
 * e a pessoa precisa ver o tamanho dele antes — apagar uma turma de teste
 * vazia e apagar uma turma com 30 alunos e notas lançadas são decisões
 * completamente diferentes, e um alerta igual para as duas não ajuda.
 */
export default function ExcluirTurma({
  turmaId,
  nomeDaTurma,
}: {
  turmaId: string
  nomeDaTurma: string
}) {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const abrirConfirmacao = () => {
    setError(null)
    startTransition(async () => {
      try {
        setResumo(await resumoDaTurma(turmaId))
        setConfirmando(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao verificar a turma.')
      }
    })
  }

  const apagar = () => {
    setError(null)
    startTransition(async () => {
      try {
        await removerTurma(turmaId)
        router.push('/dashboard/admin/turmas')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao apagar a turma.')
      }
    })
  }

  if (!confirmando) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={abrirConfirmacao}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-[13px] font-semibold text-red-600 ring-1 ring-red-200 transition-all hover:bg-red-50 hover:ring-red-300 disabled:opacity-50"
        >
          <Trash2 className="h-[15px] w-[15px]" strokeWidth={2} />
          {isPending ? 'Verificando...' : 'Excluir turma'}
        </button>
        {error && <Alerta>{error}</Alerta>}
      </div>
    )
  }

  const itens = [
    { n: resumo?.alunos ?? 0, label: 'aluno matriculado', plural: 'alunos matriculados' },
    { n: resumo?.encontros ?? 0, label: 'encontro com presenças', plural: 'encontros com presenças' },
    { n: resumo?.avaliacoes ?? 0, label: 'avaliação com notas', plural: 'avaliações com notas' },
    { n: resumo?.atividades ?? 0, label: 'atividade com entregas', plural: 'atividades com entregas' },
  ].filter((i) => i.n > 0)

  return (
    <div className="w-full max-w-md rounded-xl bg-white p-5 ring-1 ring-red-200">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-bold text-gray-900">
            Apagar a turma &ldquo;{nomeDaTurma}&rdquo;?
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-gray-500">
            Esta ação não tem volta.
          </p>
        </div>
      </div>

      {itens.length > 0 ? (
        <>
          <p className="mb-1.5 text-[12.5px] font-semibold text-gray-700">Será apagado junto:</p>
          <ul className="mb-3 space-y-1">
            {itens.map((i) => (
              <li key={i.label} className="flex items-center gap-2 text-[13px] text-gray-600">
                <span className="h-1 w-1 shrink-0 rounded-full bg-red-400" />
                <span className="font-semibold tabular-nums text-gray-900">{i.n}</span>
                {i.n === 1 ? i.label : i.plural}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2.5 text-[13px] text-gray-600">
          Esta turma está vazia — não há alunos, encontros nem notas para perder.
        </p>
      )}

      <p className="mb-4 rounded-lg bg-brand-50/70 px-3 py-2.5 text-[12.5px] leading-relaxed text-brand-900 ring-1 ring-brand-200">
        As vídeo aulas <strong>não</strong> serão apagadas. Elas pertencem ao curso, não à turma.
      </p>

      {error && (
        <div className="mb-3">
          <Alerta>{error}</Alerta>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={apagar}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          <Trash2 className="h-[15px] w-[15px]" strokeWidth={2} />
          {isPending ? 'Apagando...' : 'Sim, apagar a turma'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirmando(false)}
          className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
