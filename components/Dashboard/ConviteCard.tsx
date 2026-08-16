'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Copy, Check, Download, QrCode } from 'lucide-react'

/**
 * Cartão do link público de inscrição.
 *
 * O QR Code é gerado no servidor e chega pronto como imagem — assim ele
 * aparece já na primeira pintura da tela, sem depender de biblioteca no
 * navegador. É feito para ser projetado no telão ou impresso no mural: a
 * pessoa aponta a câmera e cai direto no formulário certo.
 */
export default function ConviteCard({
  titulo,
  descricao,
  url,
  qr,
  tom,
}: {
  titulo: string
  descricao: string
  url: string
  qr: string
  tom: 'azul' | 'roxo'
}) {
  const [copiado, setCopiado] = useState(false)

  const cor =
    tom === 'azul'
      ? { fundo: 'bg-sky-50', texto: 'text-sky-700', anel: 'ring-sky-200' }
      : { fundo: 'bg-violet-50', texto: 'text-violet-700', anel: 'ring-violet-200' }

  const copiar = () => {
    navigator.clipboard?.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-brand-950/[0.07]">
      <div className="flex items-start gap-4">
        <div className={`shrink-0 rounded-lg p-2 ring-1 ${cor.fundo} ${cor.anel}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR Code — ${titulo}`} width={104} height={104} className="rounded" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className={`flex items-center gap-1.5 font-display text-[15px] font-bold ${cor.texto}`}>
            <QrCode className="h-4 w-4" strokeWidth={2} />
            {titulo}
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-gray-500">{descricao}</p>

          <p className="mt-3 break-all rounded-lg bg-gray-50 px-2.5 py-2 font-mono text-[11.5px] text-gray-700 ring-1 ring-gray-200">
            {url}
          </p>

          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copiar}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-800"
            >
              {copiado ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
              ) : (
                <Copy className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {copiado ? 'Copiado!' : 'Copiar link'}
            </button>

            <a
              href={qr}
              download={`qrcode-${titulo.toLowerCase().replace(/\s+/g, '-')}.png`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[12.5px] font-semibold text-gray-700 ring-1 ring-gray-200 transition-colors hover:ring-gray-300"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Baixar QR Code
            </a>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${descricao}\n\n${url}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center rounded-lg px-3 text-[12.5px] font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            >
              Enviar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
