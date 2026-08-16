import Image from 'next/image'
import { urlDaImagem, type BlocoSite } from '@/lib/blocos'
import Reveal from '@/components/Reveal'

/**
 * Um bloco de conteúdo na página inicial.
 *
 * O texto é escrito em campo livre, então respeitamos as quebras de linha
 * que a pessoa digitou e transformamos parágrafos em parágrafos de verdade.
 * Sem isso, um texto bem escrito no editor viraria um paredão único aqui —
 * e ninguém lê paredão.
 */
export default function BlocoPublico({ bloco }: { bloco: BlocoSite }) {
  const imagem = urlDaImagem(bloco.imagem_path)
  const paragrafos = (bloco.texto ?? '').split(/\n{2,}/).filter((p) => p.trim())

  const Texto = () => (
    <div className="min-w-0">
      {bloco.subtitulo && (
        <p className="micro-rotulo mb-2.5 text-[12px] font-bold uppercase tracking-[0.18em] text-brand-600">
          {bloco.subtitulo}
        </p>
      )}
      <h2 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-gray-900 sm:text-[34px]">
        {bloco.titulo}
      </h2>
      {paragrafos.length > 0 && (
        <div className="mt-5 space-y-4">
          {paragrafos.map((p, i) => (
            <p key={i} className="whitespace-pre-line text-[15.5px] leading-relaxed text-gray-600">
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  )

  const Foto = () =>
    imagem ? (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-float ring-1 ring-brand-950/[0.06]">
        <Image
          src={imagem}
          alt={bloco.titulo}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>
    ) : null

  /* ---------- Destaque: foto ao fundo, texto por cima ---------- */
  if (bloco.layout === 'destaque') {
    return (
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0">
              {imagem ? (
                <Image src={imagem} alt="" fill sizes="100vw" className="object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-brand-800 to-brand-950" />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-brand-950/92 via-brand-950/75 to-brand-950/45" />
            </div>
            <div className="relative max-w-2xl px-6 py-16 sm:px-12 sm:py-20">
              {bloco.subtitulo && (
                <p className="micro-rotulo mb-2.5 text-[12px] font-bold uppercase tracking-[0.18em] text-accent-400">
                  {bloco.subtitulo}
                </p>
              )}
              <h2 className="font-display text-[30px] font-bold leading-tight text-white sm:text-[38px]">
                {bloco.titulo}
              </h2>
              {paragrafos.map((p, i) => (
                <p
                  key={i}
                  className="mt-4 whitespace-pre-line text-[15.5px] leading-relaxed text-brand-50/85"
                >
                  {p}
                </p>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    )
  }

  /* ---------- Só texto, centralizado ---------- */
  if (bloco.layout === 'texto_centralizado' || !imagem) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
        <Reveal>
          <Texto />
        </Reveal>
      </section>
    )
  }

  /* ---------- Texto + foto, nos dois sentidos ---------- */
  const fotoPrimeiro = bloco.layout === 'imagem_texto'
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <Reveal>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className={fotoPrimeiro ? 'lg:order-2' : ''}>
            <Texto />
          </div>
          <div className={fotoPrimeiro ? 'lg:order-1' : ''}>
            <Foto />
          </div>
        </div>
      </Reveal>
    </section>
  )
}
