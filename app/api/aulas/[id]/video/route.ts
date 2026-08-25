import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { obterSessao } from '@/lib/auth'
import { quemChamaPorToken, tokenDoCabecalho } from '@/lib/nucleo/identidade'
import {
  podeVerOVideo,
  VALIDADE_DO_ENDERECO_EM_SEGUNDOS,
  type ContextoDoAluno,
  type QuemPede,
} from '@/lib/nucleo/acessoAoVideo'
import type { MatriculaNoModulo, SituacaoNaTurma } from '@/lib/modulosDoAluno'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/* ============================================================
   GET /api/aulas/[id]/video

   A porta única do arquivo de vídeo guardado na plataforma.

   ANTES: o arquivo morava numa área PÚBLICA do armazenamento. O endereço
   era difícil de adivinhar, mas quem o tivesse assistia para sempre, sem
   login, sem estar matriculado, sem prazo. Bastava alguém repassar o
   link uma vez.

   AGORA: a área é privada e ninguém alcança o arquivo direto. Quem pede
   o vídeo bate aqui; aqui se confere QUEM É, SE ESTÁ MATRICULADO, SE O
   MÓDULO ESTÁ ABERTO e SE O PRAZO DA AULA ESTÁ VALENDO — e só então o
   servidor assina um endereço temporário e manda o navegador para ele.

   POR QUE UM DESVIO, E NÃO O ARQUIVO POR AQUI DENTRO
   Vídeo não é baixado de uma vez: o navegador pede pedaços conforme a
   pessoa assiste e arrasta a barra. Passar todos esses pedaços por dentro
   do servidor da aplicação seria caro, lento e desnecessário — o
   armazenamento faz isso melhor. O desvio entrega ao navegador um
   endereço que já nasce com hora para morrer.

   ESTE ARQUIVO NÃO DECIDE NADA. A decisão está em
   `lib/nucleo/acessoAoVideo.ts`, testada caso a caso. Aqui só se buscam
   os fatos e se assina o endereço.

   E NÃO TOCA EM VÍDEO DE FORA. YouTube, Vimeo, Drive e OneDrive nunca
   passaram pelo armazenamento da plataforma; o link deles continua indo
   direto para o player, exatamente como antes.
   ============================================================ */

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    /* A identidade vem do cookie (site) ou do cabeçalho (aplicativo).
       As duas resolvem para a mesma coisa — ver lib/nucleo/identidade.ts. */
    const sessao = await obterSessao()
    const quem: QuemPede | null = sessao
      ? { id: sessao.id, role: sessao.role }
      : await (async () => {
          const porToken = await quemChamaPorToken(tokenDoCabecalho(req))
          return porToken ? { id: porToken.id, role: porToken.role } : null
        })()

    const admin = createAdminClient()

    const { data: aula } = await admin
      .from('aulas')
      .select('id, curso_id, modulo_id, publicada, video_path')
      .eq('id', id)
      .maybeSingle()

    const pedida = aula
      ? {
          id: aula.id as string,
          cursoId: (aula.curso_id as string) ?? null,
          moduloId: (aula.modulo_id as string) ?? null,
          publicada: Boolean(aula.publicada),
          temArquivo: Boolean(aula.video_path),
        }
      : null

    /* Os fatos que a decisão precisa. Só são buscados quando fazem falta:
       para a coordenação nada disso importa, e seria uma ida ao banco à
       toa em toda abertura de aula. */
    let doAluno: ContextoDoAluno | null = null
    let leciona = false

    if (quem && pedida?.cursoId) {
      if (quem.role === 'professor') {
        const { count } = await admin
          .from('turmas')
          .select('id', { count: 'exact', head: true })
          .eq('curso_id', pedida.cursoId)
          .eq('professor_id', quem.id)
        leciona = (count ?? 0) > 0
      }

      if (quem.role === 'aluno') {
        const [{ data: modulos }, { data: minhasTurmas }, { data: liberada }] = await Promise.all([
          admin
            .from('modulos')
            .select('id, nome, descricao, ordem')
            .eq('curso_id', pedida.cursoId)
            .order('ordem', { ascending: true }),
          admin
            .from('turma_alunos')
            .select('situacao, turmas!inner(curso_id, modulo_id)')
            .eq('aluno_id', quem.id),
          /* A janela de data da aula nesta turma: a MESMA função do banco
             que decide se ele pode marcar progresso. Uma regra, dois
             lugares que perguntam a ela. */
          admin.rpc('aula_liberada_para', { p_aula: id, p_aluno: quem.id }),
        ])

        const matriculas: MatriculaNoModulo[] = (minhasTurmas ?? [])
          .map((m) => {
            const t = m.turmas as unknown as {
              curso_id?: string
              modulo_id?: string | null
            } | null
            return {
              cursoId: t?.curso_id ?? null,
              moduloId: t?.modulo_id ?? null,
              situacao: ((m.situacao as SituacaoNaTurma) ?? 'cursando') as SituacaoNaTurma,
            }
          })
          .filter((m) => m.cursoId === pedida.cursoId && m.moduloId)
          .map((m) => ({ moduloId: m.moduloId as string, situacao: m.situacao }))

        doAluno = {
          modulos: (modulos ?? []).map((m) => ({
            id: m.id as string,
            nome: m.nome as string,
            descricao: (m.descricao as string) ?? null,
            ordem: Number(m.ordem),
          })),
          matriculas,
          liberadaPelaJanela: liberada === true,
        }
      }
    }

    const veredito = podeVerOVideo(quem, pedida, doAluno, leciona)

    if (!veredito.pode) {
      return NextResponse.json(
        { ok: false, erro: veredito.motivo },
        { status: veredito.status, headers: { 'cache-control': 'no-store, private' } }
      )
    }

    /* Assinado agora, com hora para morrer. `createSignedUrl` roda com a
       chave administrativa, que é a única coisa capaz de alcançar a área
       privada — e ela nunca sai do servidor. */
    const { data: assinado, error } = await admin.storage
      .from('aulas')
      .createSignedUrl(aula!.video_path as string, VALIDADE_DO_ENDERECO_EM_SEGUNDOS)

    if (error || !assinado?.signedUrl) {
      console.error('[video] falha ao assinar o endereço:', error)
      return NextResponse.json(
        { ok: false, erro: 'Não consegui abrir o vídeo agora. Tente de novo.' },
        { status: 500, headers: { 'cache-control': 'no-store, private' } }
      )
    }

    /* 302, e não 301: o endereço muda a cada pedido, e um desvio
       permanente ficaria guardado no navegador apontando para uma
       assinatura que vai vencer. */
    return NextResponse.redirect(assinado.signedUrl, {
      status: 302,
      headers: {
        /* Nenhum intermediário guarda isto. Uma resposta de "o vídeo da
           aula 7" guardada e servida a outra pessoa seria o mesmo
           vazamento por outro caminho. */
        'cache-control': 'no-store, private',
      },
    })
  } catch (e) {
    console.error('[video] falha não prevista:', e)
    return NextResponse.json(
      { ok: false, erro: 'Não consegui abrir o vídeo agora. Tente de novo.' },
      { status: 500, headers: { 'cache-control': 'no-store, private' } }
    )
  }
}
