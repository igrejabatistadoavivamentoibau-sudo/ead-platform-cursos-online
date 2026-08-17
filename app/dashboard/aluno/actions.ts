'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { PERCENTUAL_CONCLUSAO, COBERTURA_MINIMA } from '@/lib/video'

/** O que o player mediu de verdade nesta aula. */
export interface MedicaoDoVideo {
  /** Segundos distintos do vídeo que passaram pela tela. Pular não conta. */
  segundosAssistidos: number
  /** Duração total do vídeo, lida pelo player. */
  duracao: number
}

/**
 * Registra quanto o aluno já assistiu de uma aula e marca como concluída
 * ao passar do limite.
 *
 * A REGRA QUE MUDOU
 * Antes bastava o percentual, e o percentual vinha de "onde está a agulha
 * ÷ duração". Arrastar a barrinha até o fim dava aula concluída e presença
 * sem a pessoa ter assistido nada. Agora quem manda é o TEMPO ASSISTIDO:
 * os segundos do vídeo que realmente passaram pela tela.
 *
 * E há duas conferências aqui no servidor, para o caso de alguém tentar
 * falar direto com ele em vez de usar o player:
 *
 *   1. tempo assistido precisa cobrir 90% da duração;
 *   2. precisa ter passado tempo de relógio suficiente desde a primeira
 *      vez que a aula foi aberta — pelo menos metade da duração do vídeo.
 *      Ninguém assiste 40 minutos em 30 segundos.
 *
 * A duração fica gravada na primeira medição e nunca diminui depois, então
 * também não adianta declarar um vídeo curtinho para baixar a régua.
 *
 * Usa o cliente de sessão (não o de administrador) de propósito: assim as
 * regras do banco garantem que ninguém consiga gravar progresso no nome de
 * outra pessoa, nem em aula de turma na qual não está matriculado.
 */
export async function registrarProgresso(
  aulaId: string,
  percentual: number,
  medicao?: MedicaoDoVideo
) {
  const supabase = await createSessionClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autenticado.')

  const limitado = Math.max(0, Math.min(100, Math.round(percentual)))

  // Confere se a aula é mesmo de uma turma onde a pessoa está matriculada.
  // A política do banco já bloquearia, mas errar cedo dá mensagem melhor.
  const { data: aula } = await supabase.from('aulas').select('id').eq('id', aulaId).single()
  if (!aula) throw new Error('Aula não encontrada ou indisponível para você.')

  // Busca o progresso atual para nunca regredir o percentual já alcançado
  // (se a pessoa reabrir o vídeo do início, não perde o que já assistiu).
  const { data: atual } = await supabase
    .from('aula_progresso')
    .select('percentual, concluida, concluida_em, segundos_assistidos, duracao_segundos, iniciado_em')
    .eq('aula_id', aulaId)
    .eq('aluno_id', user.id)
    .maybeSingle()

  const percentualFinal = Math.max(limitado, Number(atual?.percentual ?? 0))
  const jaConcluida = atual?.concluida === true

  const segundosFinal = Math.max(
    Math.round(medicao?.segundosAssistidos ?? 0),
    Number(atual?.segundos_assistidos ?? 0)
  )
  // A duração vale a maior já vista: assim uma medição menor (falsa ou de
  // um carregamento incompleto) não afrouxa a régua de conclusão.
  const duracaoFinal = Math.max(
    Math.round(medicao?.duracao ?? 0),
    Number(atual?.duracao_segundos ?? 0)
  )
  const iniciadoEm = atual?.iniciado_em ?? new Date().toISOString()

  const concluidaFinal = jaConcluida || podeConcluir(percentualFinal, segundosFinal, duracaoFinal, iniciadoEm)

  const { error } = await supabase.from('aula_progresso').upsert(
    {
      aula_id: aulaId,
      aluno_id: user.id,
      percentual: percentualFinal,
      concluida: concluidaFinal,
      segundos_assistidos: segundosFinal,
      duracao_segundos: duracaoFinal > 0 ? duracaoFinal : null,
      iniciado_em: iniciadoEm,
      concluida_em: concluidaFinal
        ? (atual?.concluida_em ?? new Date().toISOString())
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'aula_id,aluno_id' }
  )

  if (error) throw new Error(error.message)

  // Só revalida quando algo visível muda (o selo de concluída), para não
  // recarregar a página a cada poucos segundos de vídeo assistido.
  if (concluidaFinal && !jaConcluida) {
    revalidatePath('/dashboard/aluno')
    revalidatePath('/dashboard/aluno/cursos')
  }

  return { concluida: concluidaFinal, percentual: percentualFinal }
}

/**
 * A decisão de dar (ou não) a aula por concluída.
 *
 * Separada em função própria porque é a regra mais delicada da plataforma:
 * dela sai a presença do aluno, e presença é documento.
 *
 * Vídeos que a plataforma não consegue medir (Google Drive, Vimeo) chegam
 * aqui sem duração. Nesses casos a conclusão continua sendo declarada pelo
 * próprio aluno, pelo botão — não há como conferir, e fingir que há seria
 * pior do que assumir.
 */
function podeConcluir(
  percentual: number,
  segundosAssistidos: number,
  duracao: number,
  iniciadoEm: string
): boolean {
  if (duracao <= 0) {
    // Sem medição possível: vale a declaração do aluno.
    return percentual >= PERCENTUAL_CONCLUSAO
  }

  const cobriuOVideo = segundosAssistidos >= duracao * (COBERTURA_MINIMA / 100)
  if (!cobriuOVideo) return false

  // Tempo de relógio: assistir 40 minutos leva, no mínimo, uns 20 (dá para
  // acelerar o vídeo, não dá para dobrar o tempo).
  const decorrido = (Date.now() - new Date(iniciadoEm).getTime()) / 1000
  return decorrido >= duracao * 0.5
}

// ==================== RESUMO DA AULA ====================

/**
 * O aluno escreve o que entendeu da aula. É uma forma simples e eficaz de
 * fixação — e dá ao professor um sinal de quem está realmente acompanhando,
 * além do "assistiu o vídeo".
 */
export async function salvarResumo(aulaId: string, texto: string) {
  const supabase = await createSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const limpo = texto.trim()
  if (limpo.length < 10) throw new Error('Escreva um resumo com pelo menos 10 caracteres.')
  if (limpo.length > 5000) throw new Error('O resumo passou de 5000 caracteres.')

  const { error } = await supabase.from('resumos_aula').upsert(
    {
      aula_id: aulaId,
      aluno_id: user.id,
      texto: limpo,
      enviado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'aula_id,aluno_id' }
  )
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/aluno/cursos')
  return { ok: true }
}

// ==================== ENTREGA DE ATIVIDADE ====================

const TAMANHO_MAXIMO_ENTREGA = 20 * 1024 * 1024 // 20 MB

export async function entregarAtividade(formData: FormData) {
  const supabase = await createSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const atividadeId = formData.get('atividade_id') as string
  const texto = ((formData.get('texto') as string) ?? '').trim()
  const file = formData.get('arquivo')

  if (!atividadeId) throw new Error('Atividade não informada.')

  let arquivoPath: string | null = null
  let arquivoNome: string | null = null

  if (file instanceof File && file.size > 0) {
    if (file.size > TAMANHO_MAXIMO_ENTREGA) {
      throw new Error('O arquivo passa de 20 MB. Reduza o tamanho e tente de novo.')
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    // Guardado na pasta do próprio aluno — as regras do bucket são privadas
    arquivoPath = `${user.id}/${atividadeId}-${crypto.randomUUID()}.${ext}`
    arquivoNome = file.name

    const { error: upErr } = await supabase.storage
      .from('entregas')
      .upload(arquivoPath, file, { contentType: file.type || undefined, upsert: false })
    if (upErr) throw new Error(`Falha ao enviar o arquivo: ${upErr.message}`)
  }

  if (!texto && !arquivoPath) {
    throw new Error('Escreva uma resposta ou anexe um arquivo.')
  }

  const { error } = await supabase.from('entregas').upsert(
    {
      atividade_id: atividadeId,
      aluno_id: user.id,
      texto: texto || null,
      ...(arquivoPath ? { arquivo_path: arquivoPath, arquivo_nome: arquivoNome } : {}),
      entregue_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'atividade_id,aluno_id' }
  )
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/aluno/atividades')
  return { ok: true }
}
