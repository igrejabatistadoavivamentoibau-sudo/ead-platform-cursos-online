'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { BookMarked, Loader2, Search, X } from 'lucide-react'
import { procurarVersiculo, type VersiculoAchado } from '@/app/dashboard/caderno/actions'

/**
 * A janelinha de colar versículo dentro do caderno.
 *
 * O CAMPO ACEITA OS DOIS JEITOS DE PEDIR
 * Numa aula o professor fala o endereço ("abram em Efésios 4"), e o aluno
 * digita o endereço. Em casa, estudando, ele lembra da frase e não do
 * capítulo. Um campo só resolve os dois — quem decide o que fazer com o que
 * foi digitado é o servidor (ver `procurarVersiculo`).
 *
 * A busca só dispara depois de meio segundo parado. Buscar a cada tecla
 * mandaria uma varredura da Bíblia inteira por letra digitada.
 */
export default function SeletorVersiculo({
  aoEscolher,
  aoFechar,
}: {
  aoEscolher: (referencia: string, texto: string) => void
  aoFechar: () => void
}) {
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<VersiculoAchado[]>([])
  const [procurando, iniciarBusca] = useTransition()
  const [procurou, setProcurou] = useState(false)
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  const digitou = (valor: string) => {
    setTermo(valor)
    if (relogio.current) clearTimeout(relogio.current)
    if (valor.trim().length < 2) {
      setAchados([])
      setProcurou(false)
      return
    }
    relogio.current = setTimeout(() => {
      iniciarBusca(async () => {
        try {
          setAchados(await procurarVersiculo(valor))
        } catch {
          setAchados([])
        }
        setProcurou(true)
      })
    }, 500)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-brand-950/40 backdrop-blur-[2px]" onClick={aoFechar} />

      <div className="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-deep ring-1 ring-brand-950/10 animate-float-in">
        <div className="flex items-center gap-2.5 border-b border-brand-950/[0.07] px-4 py-3">
          <BookMarked className="h-4 w-4 shrink-0 text-brand-700" strokeWidth={2} />
          <p className="font-display text-[14px] font-bold tracking-[-0.01em] text-gray-900">
            Colar um versículo
          </p>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex items-center gap-2.5 border-b border-brand-950/[0.07] px-4 py-3">
          {procurando ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" strokeWidth={2} />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
          )}
          <input
            autoFocus
            value={termo}
            onChange={(e) => digitou(e.target.value)}
            placeholder="Ex.: Jo 3.16   ·   Efésios 4   ·   bem-aventurados os mansos"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {achados.length === 0 && (
            <p className="px-5 py-8 text-center text-[13px] leading-relaxed text-gray-400">
              {procurou
                ? 'Nada encontrado. Tente o endereço (Jo 3.16) ou uma palavra sozinha.'
                : 'Digite o endereço do versículo ou um pedaço da frase.'}
            </p>
          )}

          {achados.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => aoEscolher(a.referencia, a.texto)}
              className="block w-full border-b border-brand-950/[0.06] px-5 py-3 text-left transition-colors last:border-0 hover:bg-[#f6faf8]"
            >
              <p className="micro-rotulo text-[10px] font-extrabold tracking-[0.12em] text-brand-700">
                {a.referencia.toUpperCase()}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-gray-700">{a.texto}</p>
            </button>
          ))}
        </div>

        {achados.length > 0 && (
          <p className="border-t border-brand-950/[0.07] px-5 py-2.5 text-[11px] text-gray-400">
            Clique no versículo para colá-lo na sua anotação, já com a referência.
          </p>
        )}
      </div>
    </div>
  )
}
