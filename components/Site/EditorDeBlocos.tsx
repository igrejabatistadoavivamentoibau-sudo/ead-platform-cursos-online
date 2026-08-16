'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Plus, X, ArrowUp, ArrowDown, Trash2, ImagePlus, PenLine, ExternalLink } from 'lucide-react'
import {
  salvarBlocoSite,
  alternarBlocoSite,
  moverBlocoSite,
  removerBlocoSite,
} from '@/app/dashboard/admin/actions'
import { LAYOUTS, urlDaImagem, type BlocoSite, type LayoutBloco } from '@/lib/blocos'
import { Botao, Card, CardTitulo, Alerta, Selo, CAMPO, Campo, Selecao } from '@/components/ui'

export default function EditorDeBlocos({ blocos }: { blocos: BlocoSite[] }) {
  const [editando, setEditando] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [previa, setPrevia] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  const agir = (fn: () => Promise<void>, aoTerminar?: () => void) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        aoTerminar?.()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar.')
      }
    })
  }

  const salvar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const dados = new FormData(e.currentTarget)
    agir(
      () => salvarBlocoSite(dados),
      () => {
        setEditando(null)
        setCriando(false)
        setPrevia(null)
      }
    )
  }

  const Formulario = ({ bloco }: { bloco?: BlocoSite }) => (
    <Card>
      <form ref={formRef} onSubmit={salvar}>
        {bloco && <input type="hidden" name="id" value={bloco.id} />}

        <div className="mb-4 flex items-center justify-between">
          <CardTitulo icone="PenLine">{bloco ? 'Editar seção' : 'Nova seção'}</CardTitulo>
          <button
            type="button"
            onClick={() => {
              setEditando(null)
              setCriando(false)
              setPrevia(null)
            }}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="space-y-4">
          <Campo label="Título" dica="O nome grande da seção.">
            <input
              name="titulo"
              type="text"
              required
              defaultValue={bloco?.titulo}
              placeholder="Ex: Nossa história"
              className={CAMPO}
            />
          </Campo>

          <Campo label="Chapéu (opcional)" dica="Uma linha pequena acima do título.">
            <input
              name="subtitulo"
              type="text"
              defaultValue={bloco?.subtitulo ?? ''}
              placeholder="Ex: Igreja Batista do Avivamento"
              className={CAMPO}
            />
          </Campo>

          <Campo
            label="Texto"
            dica="Pule uma linha em branco entre os parágrafos — eles aparecem separados no site."
          >
            <textarea
              name="texto"
              rows={8}
              defaultValue={bloco?.texto ?? ''}
              placeholder="Conte a história da igreja..."
              className={`${CAMPO} resize-y leading-relaxed`}
            />
          </Campo>

          <Campo label="Como a seção aparece">
            <Selecao
              name="layout"
              valorInicial={bloco?.layout ?? 'texto_imagem'}
              opcoes={(Object.keys(LAYOUTS) as LayoutBloco[]).map((l) => ({
                valor: l,
                rotulo: LAYOUTS[l].label,
                descricao: LAYOUTS[l].descricao,
              }))}
            />
          </Campo>

          <Campo label="Foto" dica="JPG, PNG ou WEBP, até 4 MB. Deixe em branco para manter a atual.">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 px-4 py-3.5 transition-colors hover:border-brand-400 hover:bg-brand-50/40">
              <input
                type="file"
                name="imagem"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  setPrevia(f ? URL.createObjectURL(f) : null)
                }}
                className="sr-only"
              />
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <ImagePlus className="h-4.5 w-4.5" strokeWidth={1.9} />
              </span>
              <span className="text-[13px] font-semibold text-gray-700">
                {previa ? 'Foto escolhida' : 'Escolher foto'}
              </span>
            </label>

            {(previa || bloco?.imagem_path) && (
              <div className="relative mt-3 aspect-[16/9] w-full max-w-xs overflow-hidden rounded-xl ring-1 ring-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previa ?? urlDaImagem(bloco?.imagem_path) ?? ''}
                  alt="Prévia"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </Campo>

          {error && <Alerta>{error}</Alerta>}

          <div className="flex gap-2">
            <Botao type="submit" icone="Check" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar seção'}
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => {
                setEditando(null)
                setCriando(false)
                setPrevia(null)
              }}
            >
              Cancelar
            </Botao>
          </div>
        </div>
      </form>
    </Card>
  )

  return (
    <div className="space-y-4">
      {!criando && !editando && (
        <div className="flex flex-wrap gap-2">
          <Botao icone="Plus" onClick={() => setCriando(true)}>
            Nova seção
          </Botao>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-[13px] font-semibold text-gray-700 ring-1 ring-gray-200 transition-all hover:ring-brand-300 hover:text-brand-800"
          >
            <ExternalLink className="h-[15px] w-[15px]" strokeWidth={2} />
            Ver a página inicial
          </a>
        </div>
      )}

      {criando && <Formulario />}
      {error && !criando && !editando && <Alerta>{error}</Alerta>}

      <div className="space-y-3">
        {blocos.map((b, i) =>
          editando === b.id ? (
            <Formulario key={b.id} bloco={b} />
          ) : (
            <Card key={b.id}>
              <div className="flex flex-wrap items-start gap-4">
                {b.imagem_path && (
                  <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg ring-1 ring-gray-200">
                    <Image
                      src={urlDaImagem(b.imagem_path)!}
                      alt=""
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-display text-[15px] font-bold text-gray-900">
                      {b.titulo}
                    </span>
                    <Selo tom="neutro">{LAYOUTS[b.layout].label}</Selo>
                    {!b.publicado && <Selo tom="ambar">Escondida</Selo>}
                  </div>
                  {b.subtitulo && (
                    <p className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-wider text-brand-600">
                      {b.subtitulo}
                    </p>
                  )}
                  {b.texto && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-gray-500">
                      {b.texto}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={isPending || i === 0}
                    onClick={() => agir(() => moverBlocoSite(b.id, 'cima'))}
                    aria-label="Subir"
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    disabled={isPending || i === blocos.length - 1}
                    onClick={() => agir(() => moverBlocoSite(b.id, 'baixo'))}
                    aria-label="Descer"
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(b.id)
                      setCriando(false)
                      setPrevia(null)
                    }}
                    aria-label="Editar"
                    className="rounded-md p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <PenLine className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={b.publicado}
                    aria-label={`Mostrar ${b.titulo} no site`}
                    disabled={isPending}
                    onClick={() => agir(() => alternarBlocoSite(b.id, !b.publicado))}
                    className={`relative ml-1 h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                      b.publicado ? 'bg-brand-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        b.publicado ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => agir(() => removerBlocoSite(b.id))}
                    aria-label="Apagar"
                    className="ml-1 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </Card>
          )
        )}
      </div>

      {blocos.length === 0 && !criando && (
        <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-[13px] text-gray-500">
          Nenhuma seção criada. Comece contando a história da igreja.
        </p>
      )}
    </div>
  )
}
