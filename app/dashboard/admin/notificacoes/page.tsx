import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader } from '@/components/ui'
import Lista, { type NotificacaoItem } from '@/components/Notificacoes/Lista'

export const dynamic = 'force-dynamic'

export default async function NotificacoesPage() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data } = await supabase
    .from('notificacoes')
    .select('id, titulo, corpo, tipo, link, lida, created_at')
    .eq('user_id', sessao.id)
    .order('created_at', { ascending: false })
    .limit(60)

  // Abrir a página é dar ciência: o que estava por ler fica lido.
  // A lista desta visita ainda mostra o destaque, porque foi lida ANTES.
  await supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('user_id', sessao.id)
    .eq('lida', false)

  return (
    <div className="p-5 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <PageHeader
          titulo="Notificações"
          descricao="Tudo o que a plataforma avisou a você, do mais recente para o mais antigo."
        />
        <Lista notificacoes={(data ?? []) as NotificacaoItem[]} />
      </div>
    </div>
  )
}
