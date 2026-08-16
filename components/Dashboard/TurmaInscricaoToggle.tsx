'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { alternarInscricoesDaTurma } from '@/app/dashboard/admin/actions'

/** Chave que liga/desliga a turma na página pública de inscrição. */
export default function TurmaInscricaoToggle({
  turmaId,
  nome,
  abertas,
}: {
  turmaId: string
  nome: string
  abertas: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const alternar = () =>
    startTransition(async () => {
      await alternarInscricoesDaTurma(turmaId, !abertas)
      router.refresh()
    })

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="min-w-0 truncate text-[13.5px] font-medium text-gray-800">{nome}</span>
      <button
        type="button"
        role="switch"
        aria-checked={abertas}
        aria-label={`Inscrições da turma ${nome}`}
        disabled={isPending}
        onClick={alternar}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          abertas ? 'bg-brand-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            abertas ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </li>
  )
}
