import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Video, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import EditorCaderno from '@/components/Caderno/EditorCaderno'
import TituloDaPagina from '@/components/Caderno/TituloDaPagina'
import AbrirEmOutraJanela from '@/components/Caderno/AbrirEmOutraJanela'

export const dynamic = 'force-dynamic'

export default async function PaginaDoCaderno({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: pagina } = await supabase
    .from('caderno_paginas')
    .select('id, titulo, conteudo, aula_id, curso_id, aulas(titulo)')
    .eq('id', id)
    .eq('user_id', sessao.id)
    .maybeSingle()

  if (!pagina) notFound()

  const aula = pagina.aulas as unknown as { titulo?: string } | null

  return (
    <div className="p-5 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/caderno"
          className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-500 transition-colors hover:text-brand-700"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
            strokeWidth={2.2}
          />
          Meu caderno
        </Link>

        {aula?.titulo && (
          <>
            <span className="h-4 w-px bg-brand-950/[0.1]" />
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700">
              <Video className="h-3.5 w-3.5" strokeWidth={2} />
              {aula.titulo}
            </span>
          </>
        )}

        <span className="ml-auto flex items-center gap-2">
          {pagina.curso_id && (
            <Link
              href={`/dashboard/aluno/cursos/${pagina.curso_id}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-950/[0.08] bg-white px-3 text-[12px] font-semibold text-gray-600 transition-colors hover:border-brand-500/40 hover:text-brand-800"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              Abrir a aula
            </Link>
          )}
          <AbrirEmOutraJanela paginaId={pagina.id as string} />
        </span>
      </div>

      <div className="mb-4">
        <TituloDaPagina paginaId={pagina.id as string} titulo={pagina.titulo as string} />
      </div>

      <EditorCaderno
        paginaId={pagina.id as string}
        tituloInicial={pagina.titulo as string}
        conteudoInicial={pagina.conteudo}
        aulaId={(pagina.aula_id as string | null) ?? null}
      />
    </div>
  )
}
