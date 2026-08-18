import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import EditorCaderno from '@/components/Caderno/EditorCaderno'

export const dynamic = 'force-dynamic'

/**
 * O caderno na segunda tela.
 *
 * É a mesma folha da página normal — de propósito. Escrever aqui e ler lá
 * têm que dar exatamente na mesma anotação, salva no mesmo lugar. O que
 * muda é só a moldura: aqui não há barra lateral, não há barra de cima e
 * não há botão de voltar, porque esta janela não é para navegar.
 */
export default async function CadernoNaJanela({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: pagina } = await supabase
    .from('caderno_paginas')
    .select('id, titulo, conteudo, aula_id, aulas(titulo)')
    .eq('id', id)
    .eq('user_id', sessao.id)
    .maybeSingle()

  if (!pagina) notFound()

  const aula = pagina.aulas as unknown as { titulo?: string } | null

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <Image
          src="/ibau-capelo.webp"
          alt="IBAU"
          width={720}
          height={756}
          className="h-7 w-auto"
        />
        <div className="min-w-0">
          <p className="truncate font-display text-[14px] font-bold tracking-[-0.015em] text-gray-900">
            {pagina.titulo as string}
          </p>
          {aula?.titulo && (
            <p className="flex items-center gap-1.5 truncate text-[11px] text-brand-700">
              <Video className="h-3 w-3 shrink-0" strokeWidth={2} />
              {aula.titulo}
            </p>
          )}
        </div>
      </div>

      <EditorCaderno
        paginaId={pagina.id as string}
        tituloInicial={pagina.titulo as string}
        conteudoInicial={pagina.conteudo}
        aulaId={(pagina.aula_id as string | null) ?? null}
        compacto
      />

      <p className="mt-3 text-center text-[10.5px] leading-relaxed text-gray-400">
        Esta janela é a mesma anotação da plataforma. Deixe-a numa tela e a aula na outra — o
        minuto do vídeo chega aqui sozinho.
      </p>
    </div>
  )
}
