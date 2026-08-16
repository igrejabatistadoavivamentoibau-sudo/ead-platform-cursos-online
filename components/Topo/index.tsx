import { createClient } from '@/lib/supabase/server'
import Topbar from './Topbar'

/**
 * Versão "ligada" da barra superior: busca os contadores e entrega o
 * componente pronto para os três layouts.
 *
 * O QUE CADA NÚMERO SIGNIFICA
 * - Sino: notificações ainda não lidas — dado exato.
 * - Conversas: mensagens das últimas 24h nas turmas da pessoa, tirando as
 *   dela mesma. Não há marcador de leitura por mensagem (seria uma tabela
 *   inteira só para isso), então o número diz "houve movimento recente",
 *   que é o que um badge de chat precisa comunicar.
 *
 * As permissões do banco (RLS) escopam as duas contagens sozinhas: a
 * consulta de mensagens só enxerga turmas das quais a pessoa participa.
 */
export default async function TopbarLigada({
  portal,
  nome,
  papel,
  userId,
  notifHref,
  chatHref,
}: {
  portal: string
  nome: string
  papel: string
  userId: string
  notifHref: string
  chatHref: string
}) {
  const supabase = await createClient()
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ count: naoLidas }, { count: conversasNovas }] = await Promise.all([
    supabase
      .from('notificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('lida', false),
    supabase
      .from('mensagens')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', ontem)
      .neq('autor_id', userId),
  ])

  return (
    <Topbar
      portal={portal}
      nome={nome}
      papel={papel}
      notifHref={notifHref}
      chatHref={chatHref}
      naoLidas={naoLidas ?? 0}
      conversasNovas={conversasNovas ?? 0}
    />
  )
}
