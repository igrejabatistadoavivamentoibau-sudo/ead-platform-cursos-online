import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader, Card, CardTitulo } from '@/components/ui'
import GerenciadorLumi, { type NovidadeItem } from '@/components/Dashboard/GerenciadorLumi'

export const dynamic = 'force-dynamic'

export default async function LumiPage() {
  await exigirSessao()
  const supabase = await createClient()

  const { data } = await supabase
    .from('novidades')
    .select('id, titulo, descricao, tipo, publico, publicada, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="LUMI"
        descricao="A LUMI avisa quando a plataforma é atualizada e saúda cada pessoa no primeiro acesso do dia. Aqui você escreve o que ela vai contar."
      />

      <Card className="mb-6">
        <CardTitulo icone="Sparkles">Como ela trabalha</CardTitulo>
        <ul className="-mt-2 space-y-2 text-[13px] leading-relaxed text-gray-600">
          <li>
            <strong>Aviso de atualização:</strong> quando você publica uma versão nova, quem estiver
            com a tela aberta recebe um convite para atualizar, com botão. Ninguém fica preso na
            versão antiga sem saber.
          </li>
          <li>
            <strong>Saudação do dia:</strong> no primeiro acesso de cada dia, ela cumprimenta pelo
            nome e conta as novidades abaixo. Uma vez por dia por pessoa — não por aparelho.
          </li>
          <li>
            <strong>Escreveu depois que o pessoal já entrou?</strong> Use &ldquo;Reenviar saudação
            de hoje&rdquo; e todos recebem de novo no próximo carregamento.
          </li>
        </ul>
      </Card>

      <GerenciadorLumi novidades={(data ?? []) as NovidadeItem[]} />
    </div>
  )
}
