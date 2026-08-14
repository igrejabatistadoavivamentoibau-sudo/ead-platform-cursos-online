'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarPlus, ClipboardCheck, ChevronRight } from 'lucide-react'
import { criarEncontro } from '@/app/dashboard/admin/actions'

interface Encontro {
  id: string
  titulo: string | null
  data: string
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export default function EncontroManager({
  turmaId,
  encontros,
}: {
  turmaId: string
  encontros: Encontro[]
}) {
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleCriar = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const encontroId = await criarEncontro(turmaId, { titulo: titulo || undefined, data })
        setTitulo('')
        router.push(`/dashboard/admin/turmas/${turmaId}/chamada/${encontroId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao criar encontro.')
      }
    })
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5 sm:p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Encontros e lista de chamada</h2>

      <form onSubmit={handleCriar} className="flex flex-col sm:flex-row gap-2 mb-5">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Tema do encontro (opcional)"
          className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
        />
        <input
          type="date"
          required
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <CalendarPlus className="h-4 w-4" strokeWidth={2.25} />
          {isPending ? 'Criando...' : 'Novo encontro'}
        </button>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {encontros.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {encontros.map((encontro) => (
            <li key={encontro.id}>
              <Link
                href={`/dashboard/admin/turmas/${turmaId}/chamada/${encontro.id}`}
                className="flex items-center justify-between py-3 group"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-700 shrink-0">
                    <ClipboardCheck className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {encontro.titulo || 'Encontro'}
                    </p>
                    <p className="text-xs text-gray-500">{formatarData(encontro.data)}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-green-600 transition-colors" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Nenhum encontro registrado ainda.</p>
      )}
    </div>
  )
}
