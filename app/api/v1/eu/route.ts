import { quemChamaPorToken, tokenDoCabecalho } from '@/lib/nucleo/identidade'
import { conteudo, naoAutenticado, rota } from '@/lib/nucleo/resposta'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/* ============================================================
   GET /api/v1/eu

   A primeira chamada que qualquer aplicativo faz depois do login: "quem
   sou eu aqui dentro, e o que eu posso?".

   O aplicativo entra no Supabase Auth pelas bibliotecas oficiais
   (supabase-swift, supabase-kt), recebe o mesmo JWT que o navegador
   receberia e o manda aqui. A resposta é a que decide QUAIS TELAS montar:
   um aluno não desenha o menu de coordenação, e essa decisão não pode
   ficar a cargo do aplicativo.

   Repare no que NÃO vai na resposta: nada de token, nada de senha, nada de
   outra pessoa. Só a própria identidade e as próprias permissões.
   ============================================================ */

export async function GET(req: Request) {
  return rota(async () => {
    const quem = await quemChamaPorToken(tokenDoCabecalho(req))
    if (!quem) return naoAutenticado()

    return conteudo({
      ok: true,
      eu: {
        id: quem.id,
        nome: quem.name,
        email: quem.email,
        papel: quem.role,
        permissoes: quem.permissoes,
      },
    })
  })
}
