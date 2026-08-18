'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type CorGrifo = 'amarelo' | 'verde' | 'azul' | 'rosa' | 'roxo'

export interface Marcacao {
  livro: number
  capitulo: number
  versiculo: number
  cor: CorGrifo | null
  nota: string | null
}

/**
 * Grifa (ou desgrifa) um versículo.
 *
 * Passar a mesma cor que já está lá apaga o grifo — é como funciona um
 * marca-texto de verdade na mão da pessoa: passar de novo por cima do que
 * já está marcado é o gesto de desmarcar.
 *
 * A linha só é apagada do banco quando não sobra nem cor nem nota. Se
 * houver uma anotação escrita, tirar o grifo não pode levar o texto junto.
 */
export async function grifarVersiculo(
  livro: number,
  capitulo: number,
  versiculo: number,
  cor: CorGrifo | null
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const { data: atual } = await supabase
    .from('biblia_marcacoes')
    .select('id, cor, nota')
    .eq('user_id', user.id)
    .eq('livro', livro)
    .eq('capitulo', capitulo)
    .eq('versiculo', versiculo)
    .maybeSingle()

  const novaCor = atual?.cor === cor ? null : cor

  if (!novaCor && !atual?.nota) {
    if (atual?.id) {
      const { error } = await supabase.from('biblia_marcacoes').delete().eq('id', atual.id)
      if (error) throw new Error(error.message)
    }
    revalidatePath('/dashboard/biblia')
    return { cor: null as CorGrifo | null }
  }

  const { error } = await supabase.from('biblia_marcacoes').upsert(
    {
      user_id: user.id,
      livro,
      capitulo,
      versiculo,
      cor: novaCor,
      nota: atual?.nota ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,livro,capitulo,versiculo' }
  )
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/biblia')
  return { cor: novaCor }
}

/** Escreve, altera ou apaga a anotação de um versículo. */
export async function anotarVersiculo(
  livro: number,
  capitulo: number,
  versiculo: number,
  nota: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const limpo = nota.trim()
  if (limpo.length > 4000) throw new Error('A anotação passou de 4000 caracteres.')

  const { data: atual } = await supabase
    .from('biblia_marcacoes')
    .select('id, cor')
    .eq('user_id', user.id)
    .eq('livro', livro)
    .eq('capitulo', capitulo)
    .eq('versiculo', versiculo)
    .maybeSingle()

  // Anotação apagada e sem grifo: a linha some. Deixar linhas vazias no
  // banco encheria a tela de marcações com versículos sem nada.
  if (!limpo && !atual?.cor) {
    if (atual?.id) {
      const { error } = await supabase.from('biblia_marcacoes').delete().eq('id', atual.id)
      if (error) throw new Error(error.message)
    }
    revalidatePath('/dashboard/biblia')
    return { nota: '' }
  }

  const { error } = await supabase.from('biblia_marcacoes').upsert(
    {
      user_id: user.id,
      livro,
      capitulo,
      versiculo,
      cor: atual?.cor ?? null,
      nota: limpo || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,livro,capitulo,versiculo' }
  )
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/biblia')
  return { nota: limpo }
}
