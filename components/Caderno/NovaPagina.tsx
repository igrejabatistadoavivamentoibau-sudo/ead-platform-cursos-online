'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { criarPagina } from '@/app/dashboard/caderno/actions'

/**
 * Começar uma página solta — anotação de culto, de leitura, de conversa.
 *
 * Cria e JÁ LEVA para dentro dela. Criar e voltar para a lista obrigaria a
 * pessoa a caçar a folha nova no meio das outras para começar a escrever.
 */
export default function NovaPagina({ rotulo = 'Nova página' }: { rotulo?: string }) {
  const router = useRouter()
  const [criando, iniciar] = useTransition()

  return (
    <button
      type="button"
      disabled={criando}
      onClick={() =>
        iniciar(async () => {
          try {
            const id = await criarPagina()
            router.push(`/dashboard/caderno/${id}`)
          } catch {
            // Sem internet agora: a pessoa tenta de novo, nada se perdeu.
          }
        })
      }
      className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
    >
      {criando ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
      ) : (
        <Plus className="h-4 w-4" strokeWidth={2.4} />
      )}
      {rotulo}
    </button>
  )
}
