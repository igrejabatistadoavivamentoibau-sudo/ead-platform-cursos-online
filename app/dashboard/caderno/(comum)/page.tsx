import Link from 'next/link'
import { NotebookPen, Plus, Video, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import NovaPagina from '@/components/Caderno/NovaPagina'

export const dynamic = 'force-dynamic'

function quando(iso: string) {
  const d = new Date(iso)
  const agora = new Date()
  const dias = Math.floor((agora.getTime() - d.getTime()) / 86400000)
  if (dias === 0) return `hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  if (dias === 1) return 'ontem'
  if (dias < 7) return `há ${dias} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

interface ItemCaderno {
  id: string
  titulo: string
  resumo: string
  aula: string | null
  atualizado: string
}

/* Fora do componente de propósito — componente criado dentro de outro é
   recriado a cada renderização, e o React remonta tudo em vez de atualizar. */
function Secao({
  icone: Icone,
  titulo,
  itens,
}: {
  icone: typeof Video
  titulo: string
  itens: ItemCaderno[]
}) {
  if (itens.length === 0) return null

  return (
    <div className="mt-7">
      <div className="mb-3.5 flex items-center gap-2.5">
        <Icone className="h-3.5 w-3.5 text-brand-700" strokeWidth={2} />
        <h2 className="micro-rotulo text-[11px] font-extrabold tracking-[0.14em] text-[#41514a]">
          {titulo}
        </h2>
        <span className="h-px flex-1 bg-gradient-to-r from-brand-950/[0.08] to-transparent" />
        <span className="text-[11px] text-gray-400">
          {itens.length} {itens.length === 1 ? 'página' : 'páginas'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {itens.map((p, i) => (
          <Link
            key={p.id}
            href={`/dashboard/caderno/${p.id}`}
            className="card-alive group block overflow-hidden p-5 animate-float-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent-500/50 via-accent-500/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {p.aula && (
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] text-brand-700">
                <Video className="h-3 w-3" strokeWidth={2.2} />
                {p.aula.toUpperCase()}
              </p>
            )}

            <p className="font-display text-[14.5px] font-bold leading-snug tracking-[-0.01em] text-gray-900">
              {p.titulo}
            </p>

            <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-gray-500">
              {p.resumo || 'Página em branco.'}
            </p>

            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
              <Clock className="h-3 w-3" strokeWidth={2} />
              {quando(p.atualizado)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default async function CadernoPage() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: paginas } = await supabase
    .from('caderno_paginas')
    .select('id, titulo, resumo, aula_id, updated_at, aulas(titulo)')
    .eq('user_id', sessao.id)
    .order('updated_at', { ascending: false })

  const lista = (paginas ?? []).map((p) => {
    const aula = p.aulas as unknown as { titulo?: string } | null
    return {
      id: p.id as string,
      titulo: p.titulo as string,
      resumo: (p.resumo as string | null) ?? '',
      aula: aula?.titulo ?? null,
      atualizado: p.updated_at as string,
    }
  })

  const deAula = lista.filter((p) => p.aula)
  const soltas = lista.filter((p) => !p.aula)

  return (
    <div className="p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-gray-900 sm:text-[26px]">
            Meu caderno
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-gray-500">
            Suas anotações de aula, de culto e de leitura. Ninguém além de você lê o que está
            aqui — nem os professores, nem a liderança.
          </p>
        </div>
        <NovaPagina />
      </div>

      {lista.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-brand-950/[0.07] bg-white px-6 py-14 text-center shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-brand-200 bg-brand-50 text-brand-700">
            <NotebookPen className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <p className="font-display text-[15px] font-bold text-gray-900">
            Seu caderno ainda está em branco
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-gray-500">
            Toda aula que você abrir já vem com uma folha pronta ao lado do vídeo. Ou comece uma
            página solta agora, para uma pregação ou uma leitura.
          </p>
          <div className="mt-5 flex justify-center">
            <NovaPagina rotulo="Começar uma página" />
          </div>
        </div>
      ) : (
        <>
          <Secao icone={Video} titulo="CADERNOS DE AULA" itens={deAula} />
          <Secao icone={Plus} titulo="PÁGINAS SOLTAS" itens={soltas} />
        </>
      )}
    </div>
  )
}
