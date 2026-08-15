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
    revalidatePath('/dashboard/aluno/aulas')
  }

  return { concluida: concluidaFinal, percentual: percentualFinal }
}
