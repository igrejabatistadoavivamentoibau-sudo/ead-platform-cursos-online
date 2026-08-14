'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { matricularAluno, removerMatricula } from '@/app/dashboard/admin/actions'

interface AlunoMatriculado {
  matriculaId: string
  id: string
  name: string
  email: string
}

interface AlunoDisponivel {
  id: string
  name: string
}

export default function MatriculaManager({
  turmaId,
  matriculados,
  disponiveis,
}: {
  turmaId: string
  matriculados: AlunoMatriculado[]
  disponiveis: AlunoDisponivel[]
}) {
  const [selecionado, setSelecionado] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const alunosNaoMatriculados = disponiveis.filter(
    (a) => !matriculados.some((m) => m.id === a.id)
  )

  const handleAdicionar = () => {
    if (!selecionado) return
    setError(null)
    startTransition(async () => {
      try {
        await matricularAluno(turmaId, selecionado)
        setSelecionado('')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao matricular aluno.')
      }
    })
  }

  const handleRemover = (matriculaId: string) => {
    setError(null)
    startTransition(async () => {
      try {
        await removerMatricula(turmaId, matriculaId)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao remover matrícula.')
      }
    })
  }

  return (
    <div className="card-alive p-5 sm:p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Alunos matriculados ({matriculados.length})</h2>

      {matriculados.length > 0 ? (
        <ul className="divide-y divide-gray-100 mb-5">
          {matriculados.map((aluno) => (
            <li key={aluno.matriculaId} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{aluno.name}</p>
                <p className="text-xs text-gray-500">{aluno.email}</p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleRemover(aluno.matriculaId)}
                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                aria-label={`Remover ${aluno.name} da turma`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 mb-5">Nenhum aluno matriculado ainda.</p>
      )}

      {alunosNaoMatriculados.length > 0 ? (
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-100">
          <select
            value={selecionado}
            onChange={(e) => setSelecionado(e.target.value)}
            className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 bg-white"
          >
            <option value="">Selecione um aluno...</option>
            {alunosNaoMatriculados.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selecionado || isPending}
            onClick={handleAdicionar}
            className="inline-flex items-center justify-center gap-2 bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-800 transition-colors disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" strokeWidth={2.25} />
            Adicionar
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400 pt-4 border-t border-gray-100">
          Todos os alunos cadastrados já estão nesta turma.
        </p>
      )}

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
