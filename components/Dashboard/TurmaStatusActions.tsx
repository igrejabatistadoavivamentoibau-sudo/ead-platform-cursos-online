'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PlayCircle, CheckCircle2 } from 'lucide-react'
import { iniciarTurma, encerrarTurma } from '@/app/dashboard/admin/actions'

export default function TurmaStatusActions({
  turmaId,
  status,
}: {
  turmaId: string
  status: 'planejada' | 'em_andamento' | 'encerrada'
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handle = (action: (id: string) => Promise<void>) => {
    startTransition(async () => {
      await action(turmaId)
      router.refresh()
    })
  }

  if (status === 'planejada') {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => handle(iniciarTurma)}
        className="inline-flex items-center gap-2 bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors disabled:opacity-50 shadow-sm"
      >
        <PlayCircle className="h-4 w-4" strokeWidth={2.25} />
        {isPending ? 'Iniciando...' : 'Iniciar turma'}
      </button>
    )
  }

  if (status === 'em_andamento') {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => handle(encerrarTurma)}
        className="inline-flex items-center gap-2 bg-white ring-1 ring-gray-300 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
        {isPending ? 'Encerrando...' : 'Encerrar turma'}
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm text-gray-400 font-medium">
      <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
      Turma encerrada
    </span>
  )
}
