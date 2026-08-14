'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Slide {
  caption: string
  gradient: string
  /**
   * Quando houver uma foto real (da igreja, das aulas, etc.), coloque o
   * arquivo em /public/carousel/ e informe o caminho aqui — o carrossel
   * troca automaticamente o gradiente pela foto. Até lá, cada slide usa um
   * gradiente + ícone como espaço reservado.
   */
  image?: string
}

const slides: Slide[] = [
  {
    caption: 'Formação de Líderes',
    gradient: 'from-green-800 via-green-700 to-emerald-600',
  },
  {
    caption: 'Aulas e Encontros',
    gradient: 'from-emerald-700 via-green-600 to-green-500',
  },
  {
    caption: 'Comunhão em Célula',
    gradient: 'from-green-900 via-green-700 to-emerald-600',
  },
  {
    caption: 'Um só Corpo, uma só Visão',
    gradient: 'from-teal-800 via-green-700 to-green-600',
  },
]

const AUTOPLAY_MS = 6000

export default function HeroCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const goTo = useCallback((i: number) => {
    setIndex((i + slides.length) % slides.length)
  }, [])

  const next = useCallback(() => goTo(index + 1), [goTo, index])
  const prev = useCallback(() => goTo(index - 1), [goTo, index])

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [paused])

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {slides.map((slide, i) => (
        <div
          key={slide.caption}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {slide.image ? (
            <Image
              src={slide.image}
              alt={slide.caption}
              fill
              priority={i === 0}
              className="object-cover"
            />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${slide.gradient}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.14),transparent_45%),radial-gradient(circle_at_85%_85%,rgba(0,0,0,0.2),transparent_50%)]" />
            </div>
          )}
        </div>
      ))}

      {/* Véu escuro para legibilidade do texto por cima */}
      <div className="absolute inset-0 bg-gradient-to-t from-green-950/85 via-green-950/30 to-green-950/10" />

      {/* Legenda do slide atual */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:bottom-10 sm:right-10 md:right-14">
        <span className="inline-flex items-center rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-white ring-1 ring-white/25 whitespace-nowrap">
          {slides[index].caption}
        </span>
      </div>

      {/* Setas */}
      <button
        type="button"
        onClick={prev}
        aria-label="Slide anterior"
        className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 backdrop-blur-sm ring-1 ring-white/20 transition-colors"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Próximo slide"
        className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 backdrop-blur-sm ring-1 ring-white/20 transition-colors"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
      </button>

      {/* Indicadores */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={slide.caption}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Ir para o slide ${i + 1}`}
            aria-current={i === index}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
