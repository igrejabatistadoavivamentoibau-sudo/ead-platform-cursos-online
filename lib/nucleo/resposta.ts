import { NextResponse } from 'next/server'

/* ============================================================
   O CONTRATO DA API

   Toda regra de negócio desta plataforma já devolve a mesma forma:

     { ok: true,  ...dados }
     { ok: false, erro: 'frase em português' }

   Este arquivo faz a ponte dela para HTTP. E a ponte não é decoração: um
   aplicativo nativo PRECISA do código de status para decidir o que fazer,
   e não dá para descobrir isso lendo uma frase em português.

     401  o token não vale mais      → o app manda a pessoa entrar de novo
     403  vale, mas não pode isso    → o app esconde o botão e explica
     422  a regra recusou            → o app mostra o motivo e deixa corrigir
     500  quebrou de verdade         → o app oferece tentar de novo

   Se tudo voltasse 200 com `ok:false`, o aplicativo teria de adivinhar
   pelo texto qual dos quatro casos aconteceu — e adivinharia errado na
   primeira vez que alguém mudasse uma frase.
   ============================================================ */

export type Resultado<T = unknown> =
  | ({ ok: true } & (T extends object ? T : object))
  | { ok: false; erro: string }

/** Cabeçalhos que valem para toda resposta da API. */
const CABECALHOS = {
  'content-type': 'application/json; charset=utf-8',
  /* Resposta de API nunca entra em cache de intermediário. Uma resposta de
     "meus pedidos" guardada e servida para outra pessoa é o pior tipo de
     vazamento: silencioso e intermitente. */
  'cache-control': 'no-store, private',
} as const

export const naoAutenticado = () =>
  NextResponse.json(
    { ok: false, erro: 'Sua sessão expirou. Entre de novo.' },
    { status: 401, headers: CABECALHOS }
  )

export const semPermissao = (erro = 'Você não tem permissão para isso.') =>
  NextResponse.json({ ok: false, erro }, { status: 403, headers: CABECALHOS })

export const corpoInvalido = (erro: string) =>
  NextResponse.json({ ok: false, erro }, { status: 400, headers: CABECALHOS })

export const conteudo = (dados: unknown, status = 200) =>
  NextResponse.json(dados, { status, headers: CABECALHOS })

/**
 * Converte um `Resultado` da regra de negócio em resposta HTTP.
 *
 * `statusDeSucesso` existe porque criar coisa devolve 201, e não 200 —
 * detalhe que faz diferença para quem escreve o cliente nativo.
 */
export function daRegra<T>(r: Resultado<T>, statusDeSucesso = 200) {
  return NextResponse.json(r, {
    status: r.ok ? statusDeSucesso : 422,
    headers: CABECALHOS,
  })
}

/**
 * Embrulha o corpo inteiro de uma rota.
 *
 * Sem isto, uma exceção não prevista vira a página de erro em HTML do
 * Next — e um aplicativo nativo que espera JSON quebra ao tentar ler
 * aquilo, com uma mensagem que não ajuda ninguém.
 */
export async function rota(corpo: () => Promise<Response>): Promise<Response> {
  try {
    return await corpo()
  } catch (e) {
    console.error('[api] falha não prevista:', e)
    return NextResponse.json(
      { ok: false, erro: 'Algo falhou aqui do nosso lado. Tente de novo.' },
      { status: 500, headers: CABECALHOS }
    )
  }
}
