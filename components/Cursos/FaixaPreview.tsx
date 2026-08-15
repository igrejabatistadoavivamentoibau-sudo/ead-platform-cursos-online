import Link from 'next/link'
import { Eye, ArrowLeft, EyeOff, Check } from 'lucide-react'

/**
 * Faixa fixa no topo durante a pré-visualização. Fica sempre visível para
 * não haver dúvida de que aquilo é um teste, e não a conta de um aluno real.
 */
export default function FaixaPreview({
  voltarHref,
  incluirRascunhos,
  alternarHref,
  totalRascunhos,
}: {
  voltarHref: string
  incluirRascunhos: boolean
  alternarHref: string
  totalRascunhos: number
}) {
  return (
    <div className="sticky top-0 z-40 -mx-5 sm:-mx-8 -mt-5 sm:-mt-8 mb-6">
      <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 px-5 sm:px-8 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-900/15 text-amber-950">
              <Eye className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-950 leading-tight">
                Você está vendo como aluno
              </p>
              <p className="text-[12px] text-amber-900/85 leading-tight">
                Modo de teste — nada é gravado no seu progresso nem no de ninguém.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalRascunhos > 0 && (
              <Link
                href={alternarHref}
                scroll={false}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900/12 px-3 py-2 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-900/20"
              >
                {incluirRascunhos ? (
                  <>
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    Mostrando rascunhos ({totalRascunhos})
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Incluir rascunhos ({totalRascunhos})
                  </>
                )}
              </Link>
            )}

            <Link
              href={voltarHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-950 px-3.5 py-2 text-xs font-bold text-amber-50 transition-colors hover:bg-amber-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
              Sair da pré-visualização
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
