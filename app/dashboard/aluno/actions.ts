'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { PERCENTUAL_CONCLUSAO } from '@/lib/video'

/**
 * Registra quanto o aluno já assistiu de uma aula e marca como concluída
 * ao passar do limite.
 *
 * Usa o cliente de sessão (não o de administrador) de propósito: assim as
 * regras do banco garantem que ninguém consiga gravar progresso no nome de
 * outra pessoa, nem em aula de turma na qual não está matriculado.
 */
export async function registrarProgresso(aulaId: string, percentual: number) {
  const supabase = await createSessionClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autenticado.')

  const limitado = Math.max(0, Math.min(100, Math.round(percentual)))
  const concluida = limitado >= PERCENTUAL_CONCLUSAO

  // Confere se a aula é mesmo de uma turma onde a pessoa está matriculada.
  // A política do banco já bloquearia, mas errar cedo dá mensagem melhor.
  const { data: aula } = await supabase.from('aulas').select('id').eq('id', aulaId).single()
  if (!aula) throw new Error('Aula não encontrada ou indisponível para você.')

  // Busca o progresso atual para nunca regredir o percentual já alcançado
  // (se a pessoa reabrir o vídeo do início, não perde o que já assistiu).
  const { data: atual } = await supabase
    .from('aula_progresso')
    .select('percentual, concluida, concluida_em')
    .eq('aula_id', aulaId)
    .eq('aluno_id', user.id)
    .maybeSingle()

  const percentualFinal = Math.max(limitado, Number(atual?.percentual ?? 0))
  const jaConcluida = atual?.concluida === true
  const concluidaFinal = jaConcluida || concluida

  const { error } = await supabase.from('aula_progresso').upsert(
    {
      aula_id: aulaId,
      aluno_id: user.id,
      percentual: percentualFinal,
      concluida: concluidaFinal,
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
