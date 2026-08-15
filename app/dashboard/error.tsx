'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

/**
 * Tela de erro do painel.
 *
 * Antes, quando uma consulta falhava, a página simplesmente mostrava
 * "nenhum registro ainda" — o sistema mentia que estava vazio. Agora a
 * falha aparece com a mensagem real, para dar para consertar em vez de
 * ficar adivinhando.
 */
export default function ErroDoPainel({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[IBAU] Falha na tela do painel:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl bg-white p-7 text-center ring-1 ring-brand-950/[0.07]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <AlertTriangle className="h-6 w-6" strokeWidth={1.9} />
        </div>

        <h1 className="font-display text-[17px] font-bold text-gray-900">
          Não consegui carregar esta tela
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-gray-500">
          Alguma coisa falhou ao buscar os dados. A mensagem abaixo diz o que foi — se o problema
          continuar, mande esse texto para quem cuida do sistema.
        </p>

        <p className="mt-4 break-words rounded-lg bg-gray-50 px-3.5 py-3 text-left font-mono text-[12px] leading-relaxed text-gray-700 ring-1 ring-gray-200">
          {error.message || 'Erro desconhecido'}
          {error.digest && (
            <span className="mt-1.5 block text-[11px] text-gray-400">código: {error.digest}</span>
          )}
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800"
        >
          <RotateCw className="h-[15px] w-[15px]" strokeWidth={2} />
          Tentar de novo
        </button>
      </div>
    </div>
  )
}
