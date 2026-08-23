'use client'

import { useState, useTransition } from 'react'
import { FileText, Link2, Download, Paperclip, AlertCircle } from 'lucide-react'
import { linkDoMaterial } from '@/app/dashboard/professor/materiais/actions'
import { rotuloDoTipo, tamanhoLegivel } from '@/lib/materiais'

export interface MaterialNaTela {
  id: string
  titulo: string
  descricao: string | null
  tipo: 'arquivo' | 'link'
  formato: string | null
  tamanho: number | null
}

/* ============================================================
   O MATERIAL DE APOIO, DO LADO DE QUEM ESTUDA

   POR QUE O ENDEREÇO NÃO VEM PRONTO NA PÁGINA
   Porque o armazenamento é fechado e o endereço é assinado, com validade
   de uma hora. Se ele viesse dentro do HTML, ficaria no histórico do
   navegador, em qualquer print e em qualquer cópia da página — e valeria
   para quem o tivesse, dentro ou fora da igreja. Aqui o endereço é pedido
   no momento do clique e usado na hora.

   É por isso que o botão pisca "abrindo..." por um instante: aquele
   instante é a assinatura sendo feita.
   ============================================================ */

export default function MateriaisDaAula({ materiais }: { materiais: MaterialNaTela[] }) {
  const [erro, setErro] = useState<string | null>(null)
  const [abrindo, setAbrindo] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (materiais.length === 0) return null

  const abrir = (id: string) => {
    setErro(null)
    setAbrindo(id)
    startTransition(async () => {
      const r = await linkDoMaterial(id)
      setAbrindo(null)
      if (!r.ok) return setErro(r.erro)
      window.open(r.url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-brand-950/[0.06] sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-[15px] font-bold text-gray-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Paperclip className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        Material de apoio
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-gray-500">
        Apostila, slides e leituras desta aula. Vale para quem assiste aqui e para quem esteve no
        encontro presencial.
      </p>

      {erro && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[12.5px] text-red-800 ring-1 ring-red-200">
          <AlertCircle className="mt-px h-4 w-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {materiais.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => abrir(m.id)}
              disabled={abrindo === m.id}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-brand-950/[0.06] transition-all hover:bg-brand-50/50 hover:ring-brand-300 disabled:opacity-60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
                {m.tipo === 'link' ? (
                  <Link2 className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <FileText className="h-4 w-4" strokeWidth={2} />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-gray-800">
                  {m.titulo}
                </span>
                <span className="block text-[11.5px] text-gray-500">
                  {m.tipo === 'link' ? 'Link' : rotuloDoTipo(m.formato)}
                  {m.tamanho ? ` · ${tamanhoLegivel(m.tamanho)}` : ''}
                  {m.descricao ? ` · ${m.descricao}` : ''}
                </span>
              </span>

              <span className="shrink-0 text-[12px] font-semibold text-brand-700">
                {abrindo === m.id ? (
                  'abrindo…'
                ) : (
                  <Download
                    className="h-4 w-4 transition-transform group-hover:translate-y-0.5"
                    strokeWidth={2.25}
                  />
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
