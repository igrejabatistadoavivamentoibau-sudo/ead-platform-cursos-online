'use server'

import { createClient } from '@/lib/supabase/server'
import { portalDoPapel } from '@/lib/navegacao'

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

/* ============================================================
   OS RECADOS DA LUMI

   Ela NÃO tem uma fonte própria de avisos. Lê a mesma tabela
   `notificacoes` que o sino do topo e a central de notificações leem —
   a que existe desde a migração 015 e que os cinco gatilhos da 028
   alimentam. Se a LUMI sumisse amanhã, nenhum aviso se perderia.

   O que ela acrescenta é a VOZ (ver lib/nucleo/recadoDaLumi.ts) e o
   momento: o sino espera a pessoa clicar; a LUMI fala na hora.
   ============================================================ */

export interface RecadosPendentes {
  /** Para a assinatura do canal de tempo real, e nada mais. */
  userId: string
  papel: string
  /** Para onde levam os "+N avisos": cada portal tem a sua central. */
  centralDeAvisos: string
  avisos: {
    id: string
    titulo: string
    corpo: string | null
    tipo: string
    link: string | null
    created_at: string
  }[]
}

/**
 * Os avisos ainda não lidos desta pessoa, do mais novo para o mais velho.
 *
 * Devolve TUDO o que não foi lido, sem filtrar por tipo: quem decide o
 * que a LUMI anuncia é a regra pura, que é testada. Filtrar aqui também
 * significaria manter a mesma lista em dois lugares.
 *
 * O teto de 20 é generoso de propósito — a LUMI mostra um de cada vez e
 * só precisa saber quantos sobraram para dizer "+3".
 */
export async function recadosPendentes(): Promise<RecadosPendentes | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!perfil) return null

  /* A regra do banco (RLS) já limita a `user_id = auth.uid()`. O filtro
     abaixo é explícito mesmo assim: consulta que depende só da regra do
     banco para não vazar é consulta que vaza no dia em que alguém mexer
     na regra. */
  const { data } = await supabase
    .from('notificacoes')
    .select('id, titulo, corpo, tipo, link, created_at')
    .eq('user_id', user.id)
    .eq('lida', false)
    .order('created_at', { ascending: false })
    .limit(20)

  const papel = perfil.role ?? 'aluno'
  return {
    userId: user.id,
    papel,
    centralDeAvisos: portalDoPapel(papel as Parameters<typeof portalDoPapel>[0]).notifHref,
    avisos: data ?? [],
  }
}

/**
 * Marca UM aviso como lido.
 *
 * Chamado quando a pessoa clica na ação — clicar é ler. Fechar no X não
 * chama isto de propósito: o aviso continua no sino esperando, e quem
 * some é só a LUMI. Fechar um recado não pode apagar a informação.
 */
export async function marcarRecadoLido(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('notificacoes').update({ lida: true }).eq('id', id).eq('user_id', user.id)
}
