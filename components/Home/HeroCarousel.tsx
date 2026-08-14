'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface CarouselSlide {
  id: string
  titulo: string | null
  url: string | null
  gradient?: string
}

/** Usado enquanto o admin ainda não cadastrou nenhuma foto. */
const SLIDES_PADRAO: CarouselSlide[] = [
  { id: 'p1', titulo: 'Formação de Líderes', url: null, gradient: 'from-brand-900 via-brand-700 to-brand-500' },
  { id: 'p2', titulo: 'Aulas e Encontros', url: null, gradient: 'from-brand-800 via-brand-600 to-emerald-500' },
  { id: 'p3', titulo: 'Comunhão em Célula', url: null, gradient: 'from-brand-950 via-brand-800 to-brand-600' },
  { id: 'p4', titulo: 'Um só Corpo, uma só Visão', url: null, gradient: 'from-teal-900 via-brand-700 to-brand-500' },
]

const AUTOPLAY_MS = 5500

export default function HeroCarousel({ slides }: { slides?: CarouselSlide[] }) {
  const lista = slides && slides.length > 0 ? slides : SLIDES_PADRAO
  const [index, setIndex] = useState(0)

  const goTo = useCallback(
    (i: number) => setIndex((i + lista.length) % lista.length),
    [lista.length]
  )

  const next = useCallback(() => goTo(index + 1), [goTo, index])
  const prev = useCallback(() => goTo(index - 1), [goTo, index])

  // Passa sozinho, sempre. Não pausa no hover — a pessoa não precisa
  // fazer nada para ver as fotos. O timer reinicia quando `index` muda,
  // então após clicar numa seta o slide seguinte ainda recebe o tempo cheio.
  useEffect(() => {
    if (lista.length <= 1) return
    const timer = setTimeout(() => {
      setIndex((atual) => (atual + 1) % lista.length)
    }, AUTOPLAY_MS)
    return () => clearTimeout(timer)
  }, [index, lista.length])

  return (
    <div className="absolute inset-0 overflow-hidden">
      {lista.map((slide, i) => {
        const ativo = i === index
        return (
          <div
            key={slide.id}
            aria-hidden={!ativo}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${
              ativo ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {slide.url ? (
              <Image
                src={slide.url}
                alt={slide.titulo || 'Foto da Escola de Líderes'}
                fill
                priority={i === 0}
                sizes="100vw"
                /* Zoom lento (efeito Ken Burns) enquanto o slide está visível:
                   dá vida à foto parada sem distrair. */
                className={`object-cover transition-transform duration-[6000ms] ease-out ${
                  ativo ? 'scale-110' : 'scale-100'
                }`}
              />
            ) : (
              <div className={`h-full w-full bg-gradient-to-br ${slide.gradient}`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.16),transparent_45%),radial-gradient(circle_at_85%_85%,rgba(0,0,0,0.22),transparent_50%)]" />
              </div>
            )}
          </div>
        )
      })}

      {/* Véu escuro para o texto por cima ficar sempre legível */}
      <div className="absolute inset-0 bg-gradient-to-t from-brand-950/90 via-brand-950/45 to-brand-950/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-950/70 via-transparent to-transparent" />

      {/* Legenda do slide atual — só no desktop. No celular a área do banner
          já está ocupada pelo selo da igreja, título e botões; mais um
          elemento ali deixaria tudo apertado e sobreposto. */}
      {lista[index]?.titulo && (
        <div className="hidden sm:block absolute bottom-12 right-12">
          <span
            key={lista[index].id}
            className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-4 py-2 text-sm font-medium text-white ring-1 ring-white/25 whitespace-nowrap animate-float-in shadow-float"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-soft-pulse" />
            {lista[index].titulo}
          </span>
        </div>
      )}

      {lista.length > 1 && (
        <>
          {/* Setas */}
          <button
            type="button"
            onClick={prev}
            aria-label="Foto anterior"
            className="hidden sm:flex absolute left-5 top-1/2 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 hover:scale-110 active:scale-95 backdrop-blur-md ring-1 ring-white/20 transition-all duration-300"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Próxima foto"
            className="hidden sm:flex absolute right-5 top-1/2 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 hover:scale-110 active:scale-95 backdrop-blur-md ring-1 ring-white/20 transition-all duration-300"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
          </button>

          {/* Indicadores com barra de tempo no slide ativo */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {lista.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir para a foto ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full overflow-hidden transition-all duration-500 ${
                  i === index ? 'w-10 bg-white/30' : 'w-1.5 bg-white/40 hover:bg-white/70'
                }`}
              >
                {i === index && (
                  <span
                    key={`barra-${index}`}
                    className="block h-full w-full bg-white origin-left"
                    style={{ animation: `grow-bar ${AUTOPLAY_MS}ms linear both` }}
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
