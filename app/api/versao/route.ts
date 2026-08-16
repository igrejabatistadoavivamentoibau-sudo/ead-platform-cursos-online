import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
