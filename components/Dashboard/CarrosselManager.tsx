'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Upload,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  ImagePlus,
  Check,
  Pencil,
} from 'lucide-react'
import {
  criarSlide,
  alternarSlide,
  moverSlide,
  removerSlide,
  renomearSlide,
} from '@/app/dashboard/admin/actions'
import { urlDaFoto, type SlideDB } from '@/lib/slides'

export default function CarrosselManager({ slides }: { slides: SlideDB[] }) {
  const [titulo, setTitulo] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const selecionarArquivo = (file: File | null) => {
    setError(null)
    if (previa) URL.revokeObjectURL(previa)
    setArquivo(file)
    setPrevia(file ? URL.createObjectURL(file) : null)
  }

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!arquivo) {
      setError('Escolha uma foto primeiro.')
      return
    }
    setError(null)

    const formData = new FormData()
    formData.append('file', arquivo)
    formData.append('titulo', titulo)

    startTransition(async () => {
      try {
        await criarSlide(formData)
        setTitulo('')
        selecionarArquivo(null)
        if (inputRef.current) inputRef.current.value = ''
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao enviar a foto.')
      }
    })
  }

  const acao = (fn: () => Promise<void>) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar.')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* ===== Envio de nova foto ===== */}
      <form
        onSubmit={handleEnviar}
        className="card-alive p-5 sm:p-6"
      >
        <h2 className="font-bold text-gray-900 mb-1">Adicionar foto</h2>
        <p className="text-sm text-gray-500 mb-5">
          As fotos aparecem no banner grande da página inicial, em ordem, trocando sozinhas.
        </p>

        {/* Área de arrastar e soltar */}
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setArrastando(true)
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastando(false)
            const file = e.dataTransfer.files?.[0]
            if (file) selecionarArquivo(file)
          }}
          className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all duration-300 ${
            arrastando
              ? 'border-brand-500 bg-brand-50 scale-[1.01]'
              : 'border-gray-200 hover:border-brand-400 hover:bg-brand-50/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => selecionarArquivo(e.target.files?.[0] ?? null)}
            className="sr-only"
          />

          {previa ? (
            <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden shadow-float">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previa} alt="Prévia da foto" className="h-full w-full object-cover" />
            </div>
          ) : (
            <>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 icon-pop group-hover:bg-brand-600 group-hover:text-white">
                <ImagePlus className="h-7 w-7" strokeWidth={1.75} />
              </span>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">
                  Arraste uma foto aqui ou clique para escolher
                </p>
                <p className="text-xs text-gray-500 mt-1">JPG, PNG ou WEBP — até 8 MB</p>
              </div>
            </>
          )}

          {arquivo && (
            <p className="text-xs font-medium text-brand-700 truncate max-w-full">{arquivo.name}</p>
          )}
        </label>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Legenda da foto (opcional). Ex: Culto de Celebração"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-shadow"
          />
          <button
            type="submit"
            disabled={isPending || !arquivo}
            className="inline-flex items-center justify-center gap-2 bg-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 active:scale-[0.98] transition-all shadow-glow disabled:opacity-40 disabled:shadow-none disabled:active:scale-100 whitespace-nowrap"
          >
            <Upload className="h-4 w-4" strokeWidth={2.25} />
            {isPending ? 'Enviando...' : 'Enviar foto'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}
      </form>

      {/* ===== Fotos já cadastradas ===== */}
      {slides.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              className={`card-alive group overflow-hidden ${slide.ativo ? '' : 'opacity-60'}`}
            >
              <div className="relative aspect-video overflow-hidden bg-brand-950">
                <Image
                  src={urlDaFoto(slide.image_path)}
                  alt={slide.titulo || 'Foto do carrossel'}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-transparent to-transparent" />

                <span className="absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm text-xs font-bold text-brand-800 shadow-soft">
                  {i + 1}
                </span>

                {!slide.ativo && (
                  <span className="absolute top-3 right-3 rounded-full bg-gray-900/80 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold text-white">
                    Oculta
                  </span>
                )}

                {slide.titulo && (
                  <p className="absolute bottom-3 left-3 right-3 text-sm font-semibold text-white drop-shadow truncate">
                    {slide.titulo}
                  </p>
                )}
              </div>

              <div className="p-3">
                {editando === slide.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={novoTitulo}
                      onChange={(e) => setNovoTitulo(e.target.value)}
                      placeholder="Legenda"
                      className="flex-1 min-w-0 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    />
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        acao(async () => {
                          await renomearSlide(slide.id, novoTitulo)
                          setEditando(null)
                        })
                      }
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
                      aria-label="Salvar legenda"
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={isPending || i === 0}
                        onClick={() => acao(() => moverSlide(slide.id, 'cima'))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Mover para antes"
                        title="Mover para antes"
                      >
                        <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        disabled={isPending || i === slides.length - 1}
                        onClick={() => acao(() => moverSlide(slide.id, 'baixo'))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Mover para depois"
                        title="Mover para depois"
                      >
                        <ArrowDown className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setEditando(slide.id)
                          setNovoTitulo(slide.titulo ?? '')
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-30"
                        aria-label="Editar legenda"
                        title="Editar legenda"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                    </div>

                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => acao(() => alternarSlide(slide.id, !slide.ativo))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-30"
                        aria-label={slide.ativo ? 'Ocultar da página inicial' : 'Mostrar na página inicial'}
                        title={slide.ativo ? 'Ocultar da página inicial' : 'Mostrar na página inicial'}
                      >
                        {slide.ativo ? (
                          <Eye className="h-4 w-4" strokeWidth={2.25} />
                        ) : (
                          <EyeOff className="h-4 w-4" strokeWidth={2.25} />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => acao(() => removerSlide(slide.id))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                        aria-label="Remover foto"
                        title="Remover foto"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-alive p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <ImagePlus className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="text-gray-600 font-medium">Nenhuma foto cadastrada ainda.</p>
          <p className="text-sm text-gray-500 mt-1">
            Enquanto não houver fotos, a página inicial mostra um fundo verde animado.
          </p>
        </div>
      )}
    </div>
  )
}
