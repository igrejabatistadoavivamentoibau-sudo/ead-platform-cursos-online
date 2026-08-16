'use server'

import { createClient } from '@/lib/supabase/server'

export interface NovidadeLumi {
  id: string
  titulo: string
  descricao: string | null
  tipo: 'novidade' | 'melhoria' | 'correcao' | 'aviso'
}

/**
 * O que a LUMI tem para contar hoje, para esta pessoa.
 *
 * Devolve nulo quando a pessoa já foi saudada hoje — a saudação é do
 * PRIMEIRO acesso do dia, e repetir a cada troca de tela transformaria um
 * carinho em incômodo.
 *
 * O registro do dia fica no banco, e não no navegador, de propósito: quem
 * entra pelo celular de manhã e pelo computador à tarde é a mesma pessoa e
 * já foi saudada. Marcador no navegador saudaria de novo em cada aparelho.
 */
export async function saudacaoDoDia(): Promise<{
  nome: string
  novidades: NovidadeLumi[]
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .maybeSingle()
  if (!perfil) return null

  const hoje = new Date().toISOString().slice(0, 10)

  const { data: leitura } = await supabase
    .from('lumi_leitura')
    .select('ultima_saudacao')
    .eq('user_id', user.id)
    .maybeSingle()

  if (leitura?.ultima_saudacao === hoje) return null

  // Novidades que interessam a este papel, das mais recentes para trás.
  const { data: todas } = await supabase
    .from('novidades')
    .select('id, titulo, descricao, tipo, publico, created_at')
    .eq('publicada', true)
    .order('created_at', { ascending: false })
    .limit(20)

  const novidades = (todas ?? [])
    .filter((n) => n.publico === 'todos' || n.publico === perfil.role)
    .slice(0, 4)
    .map((n) => ({
      id: n.id,
      titulo: n.titulo,
      descricao: n.descricao,
      tipo: n.tipo as NovidadeLumi['tipo'],
    }))

  await supabase
    .from('lumi_leitura')
    .upsert(
      { user_id: user.id, ultima_saudacao: hoje, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  return { nome: perfil.name ?? 'irmão(ã)', novidades }
}
