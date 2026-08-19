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
    <div className="card-alive p-5 sm:p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Encontros e lista de chamada</h2>

      {/* POR QUE ESTE FORMULÁRIO ESCAPAVA DO CARTÃO

          Numa linha flexível, cada campo se recusa a encolher abaixo do
          próprio conteúdo — é o comportamento padrão. Somando o campo de
          tema, o de data e o botão, a linha ficava mais larga que o cartão,
          e o excesso simplesmente vazava para fora da borda. Não era o
          botão "solto": era a linha inteira transbordando.

          Duas correções, e as duas são necessárias:
          - `min-w-0` no campo de tema: autoriza ele a encolher, que é o que
            deve ceder espaço;
          - `flex-wrap` na linha: se ainda assim não couber, o botão desce
            para a linha de baixo DENTRO do cartão, em vez de sair por fora. */}
      <form onSubmit={handleCriar} className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Tema do encontro (opcional)"
          className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 sm:basis-[180px]"
        />
        <input
          type="date"
          required
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="min-w-0 shrink-0 rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
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
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shrink-0">
                    <ClipboardCheck className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {encontro.titulo || 'Encontro'}
                    </p>
                    <p className="text-xs text-gray-500">{formatarData(encontro.data)}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-brand-600 transition-colors" />
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
