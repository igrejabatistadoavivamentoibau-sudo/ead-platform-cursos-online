'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpenText, Check, AlertCircle } from 'lucide-react'
import { definirCursoDaTurma } from '@/app/dashboard/admin/actions'

export default function CursoDaTurma({
  turmaId,
  cursoAtual,
  cursos,
}: {
  turmaId: string
  cursoAtual: string | null
  cursos: { id: string; titulo: string }[]
}) {
  const [selecionado, setSelecionado] = useState(cursoAtual ?? '')
  const [salvo, setSalvo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const salvar = (valor: string) => {
    setSelecionado(valor)
    setError(null)
    startTransition(async () => {
      try {
        await definirCursoDaTurma(turmaId, valor || null)
        setSalvo(true)
        setTimeout(() => setSalvo(false), 2000)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao definir o curso.')
      }
    })
  }

  return (
    <div className="card-alive p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
          <BookOpenText className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <h2 className="font-bold text-gray-900">Curso da turma</h2>
        {salvo && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 animate-float-in">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            salvo
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4 ml-11.5">
        É o curso que define quais vídeo aulas os alunos desta turma vão assistir.
      </p>

      <select
        value={selecionado}
        onChange={(e) => salvar(e.target.value)}
        disabled={isPending}
        className="w-full px-3.5 py-2.5 bg-gray-50/60 border border-gray-200 rounded-xl text-[15px] transition-all focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 disabled:opacity-50"
      >
        <option value="">Nenhum curso definido</option>
        {cursos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.titulo}
          </option>
        ))}
      </select>

      {cursos.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2 mt-3">
          Nenhum curso criado ainda. Crie um curso na aba Cursos para poder ligá-lo a esta turma.
        </p>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-xl px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={2.25} />
          {error}
        </div>
      )}
    </div>
  )
}
