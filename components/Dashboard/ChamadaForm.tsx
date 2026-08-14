'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Save } from 'lucide-react'
import { salvarChamada } from '@/app/dashboard/admin/actions'

interface LinhaPresenca {
  aluno_id: string
  name: string
  email: string
  presente: boolean
  observacao: string
}

export default function ChamadaForm({
  turmaId,
  encontroId,
  presencasIniciais,
}: {
  turmaId: string
  encontroId: string
  presencasIniciais: LinhaPresenca[]
}) {
  const [linhas, setLinhas] = useState(presencasIniciais)
  const [salvo, setSalvo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const togglePresenca = (alunoId: string) => {
    setSalvo(false)
    setLinhas((prev) =>
      prev.map((l) => (l.aluno_id === alunoId ? { ...l, presente: !l.presente } : l))
    )
  }

  const marcarTodos = (presente: boolean) => {
    setSalvo(false)
    setLinhas((prev) => prev.map((l) => ({ ...l, presente })))
  }

  const handleSalvar = () => {
    setError(null)
    startTransition(async () => {
      try {
        await salvarChamada(
          encontroId,
          turmaId,
          linhas.map((l) => ({
            aluno_id: l.aluno_id,
            presente: l.presente,
            observacao: l.observacao || undefined,
          }))
        )
        setSalvo(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar a chamada.')
      }
    })
  }

  const presentes = linhas.filter((l) => l.presente).length

  if (linhas.length === 0) {
    return (
      <div className="bg-white rounded-2xl ring-1 ring-gray-200 p-10 text-center text-gray-500">
        Nenhum aluno matriculado nesta turma ainda. Matricule alunos antes de fazer a chamada.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-gray-100">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{presentes}</span> de {linhas.length} presentes
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => marcarTodos(true)}
            className="text-xs font-semibold text-green-700 hover:text-green-800 px-2.5 py-1 rounded-lg hover:bg-green-50"
          >
            Marcar todos presentes
          </button>
          <button
            type="button"
            onClick={() => marcarTodos(false)}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2.5 py-1 rounded-lg hover:bg-gray-50"
          >
            Limpar
          </button>
        </div>
      </div>

      <ul className="divide-y divide-gray-100">
        {linhas.map((linha) => (
          <li key={linha.aluno_id} className="flex items-center gap-4 px-5 py-3.5">
            <button
              type="button"
              onClick={() => togglePresenca(linha.aluno_id)}
              aria-pressed={linha.presente}
              aria-label={`Marcar presença de ${linha.name}`}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors ${
                linha.presente
                  ? 'bg-green-700 ring-green-700 text-white'
                  : 'bg-white ring-gray-300 text-transparent hover:ring-gray-400'
              }`}
            >
              <Check className="h-4 w-4" strokeWidth={3} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{linha.name}</p>
              <p className="text-xs text-gray-500 truncate">{linha.email}</p>
            </div>
            {!linha.presente && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-red-500 shrink-0">
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                Ausente
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="p-5 border-t border-gray-100 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSalvar}
          disabled={isPending}
          className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" strokeWidth={2.25} />
          {isPending ? 'Salvando...' : 'Salvar chamada'}
        </button>
        {salvo && <span className="text-sm text-green-700 font-medium">Chamada salva ✓</span>}
        {error && <span className="text-sm text-red-600 font-medium">{error}</span>}
      </div>
    </div>
  )
}
