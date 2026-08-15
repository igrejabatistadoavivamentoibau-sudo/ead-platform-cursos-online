'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Trash2, AlertCircle } from 'lucide-react'
import { publicarCurso, removerCurso } from '@/app/dashboard/admin/actions'

export default function CursoAcoes({
  cursoId,
  publicado,
  temTurmas,
}: {
  cursoId: string
  publicado: boolean
  temTurmas: boolean
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const acao = (fn: () => Promise<void>, redirecionar = false) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        if (redirecionar) router.push('/dashboard/admin/cursos')
        else router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao executar a ação.')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => acao(() => publicarCurso(cursoId, !publicado))}
          className="inline-flex items-center gap-2 bg-white ring-1 ring-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:ring-brand-300 hover:text-brand-800 disabled:opacity-50"
        >
          {publicado ? (
            <>
              <EyeOff className="h-4 w-4" strokeWidth={2.25} />
              Despublicar
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" strokeWidth={2.25} />
              Publicar curso
            </>
          )}
        </button>

        {confirmando ? (
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => acao(() => removerCurso(cursoId), true)}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.25} />
              {isPending ? 'Excluindo...' : 'Confirmar exclusão'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmando(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            aria-label="Excluir curso"
            title="Excluir curso"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )}
      </div>

      {confirmando && temTurmas && (
        <p className="text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2 max-w-xs text-right">
          Há turmas ligadas a este curso. Elas ficarão sem curso, mas os alunos e a chamada
          continuam salvos.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          {error}
        </div>
      )}
    </div>
  )
}
