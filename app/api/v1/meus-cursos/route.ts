import { quemChamaPorToken, tokenDoCabecalho } from '@/lib/nucleo/identidade'
import { conteudo, naoAutenticado, rota, semPermissao } from '@/lib/nucleo/resposta'
import { cursosDoAluno } from '@/lib/nucleo/cursosDoAluno'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/* ============================================================
   GET /api/v1/meus-cursos

   A tela inicial de um aplicativo de aluno.

   Devolve os cursos em que a pessoa está matriculada com o CADEADO JÁ
   RESOLVIDO: quais módulos estão abertos, quais estão trancados, e o
   motivo escrito em português, pronto para ser mostrado.

   É de propósito que a regra de pré-requisito não venha crua. Se a API
   devolvesse "estes são os módulos" e "estas são as matrículas", o
   aplicativo teria de decidir sozinho quem pode abrir o quê — em Swift, e
   de novo em Kotlin. Três cópias da mesma regra, que divergem na primeira
   correção feita em uma só. E a que divergisse liberaria conteúdo para
   quem não passou.

   Aqui a regra roda uma vez, no servidor, e é a mesma de `lib/modulosDoAluno.ts`
   que a tela do site já usa.
   ============================================================ */

export async function GET(req: Request) {
  return rota(async () => {
    const quem = await quemChamaPorToken(tokenDoCabecalho(req))
    if (!quem) return naoAutenticado()

    /* Professor e coordenação têm outras telas; esta é a do aluno. Deixar
       passar devolveria uma lista vazia e pareceria defeito. */
    if (quem.role !== 'aluno') {
      return semPermissao('Esta lista é do portal do aluno.')
    }

    return conteudo({ ok: true, cursos: await cursosDoAluno(quem) })
  })
}
