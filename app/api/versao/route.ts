import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/* Roda na borda, e não numa função comum.
   A resposta é uma linha de texto que já está pronta em memória — não toca
   no banco nem em arquivo nenhum. Numa função comum, a primeira chamada
   depois de um tempo parado paga a "partida a frio": o servidor precisa
   subir o ambiente inteiro antes de responder isso. Na borda a partida é
   praticamente instantânea, e esta é a rota mais chamada da plataforma. */
export const runtime = 'edge'

/**
 * Identidade da versão que está no ar.
 *
 * A Vercel injeta o identificador do commit publicado. É o dado mais
 * confiável que existe para responder "a plataforma mudou?": muda sozinho
 * a cada publicação, sem ninguém precisar lembrar de atualizar um número.
 *
 * Fora da Vercel (desenvolvimento) devolvemos um valor fixo, para a LUMI
 * não ficar avisando de atualização a cada recarregamento local.
 */
export function GET() {
  const versao =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    'desenvolvimento'

  return NextResponse.json(
    {
      versao: versao.slice(0, 12),
      publicadoEm: process.env.VERCEL_DEPLOYMENT_ID ? null : null,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
