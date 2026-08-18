'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { renomearPagina, excluirPagina } from '@/app/dashboard/caderno/actions'

/**
 * O título da página, editável no lugar.
 *
 * Sem botão de "renomear" e sem janelinha: clicar no título e digitar é o
 * gesto que todo mundo já conhece de caderno e de arquivo. Salva ao sair do
 * campo ou no Enter.
 */
export default function TituloDaPagina({
  paginaId,
  titulo,
  podeExcluir = true,
}: {
  paginaId: string
  titulo: string
  podeExcluir?: boolean
}) {
  const router = useRouter()
  const [valor, setValor] = useState(titulo)
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, iniciar] = useTransition()
  const ultimoSalvo = useRef(titulo)

  const guardar = () => {
    const limpo = valor.trim() || 'Sem título'
    if (limpo === ultimoSalvo.current) return
    ultimoSalvo.current = limpo
    iniciar(async () => {
      try {
        await renomearPagina(paginaId, limpo)
      } catch {
        setValor(ultimoSalvo.current)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        placeholder="Título da página"
        className="min-w-0 flex-1 border-b border-transparent bg-transparent pb-1 font-display text-[22px] font-bold tracking-[-0.02em] text-gray-900 outline-none transition-colors placeholder:text-gray-300 hover:border-brand-950/[0.12] focus:border-brand-500 sm:text-[26px]"
      />

      {podeExcluir && (
        <>
          {confirmando ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  iniciar(async () => {
                    await excluirPagina(paginaId).catch(() => {})
                    router.push('/dashboard/caderno')
                  })
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {ocupado && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />}
                Apagar mesmo
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="inline-flex h-9 items-center rounded-lg px-3 text-[12.5px] font-semibold text-gray-500 transition-colors hover:bg-gray-100"
              >
                Cancelar
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              title="Apagar esta página"
              className="grid h-9 w-9 place-items-center rounded-lg border border-brand-950/[0.08] bg-white text-gray-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </>
      )}
    </div>
  )
}
