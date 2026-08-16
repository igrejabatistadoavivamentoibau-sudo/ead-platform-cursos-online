import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader, Card, CardTitulo, BotaoLink } from '@/components/ui'
import EditorDaFicha from '@/components/Dashboard/EditorDaFicha'
import type { CampoInscricao } from '@/lib/campos'

export const dynamic = 'force-dynamic'

export default async function FichaPage() {
  await exigirSessao()
  const supabase = await createClient()

  const { data } = await supabase
    .from('campos_inscricao')
    .select('*')
    .order('ordem', { ascending: true })

  const campos = (data ?? []) as CampoInscricao[]

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Ficha de inscrição"
        descricao="Monte as perguntas que aparecem para quem se inscreve. O que você criar aqui entra na ficha na hora — não precisa pedir alteração de sistema para ninguém."
        voltar={{ href: '/dashboard/admin/inscricoes', label: 'Inscrições' }}
        acoes={
          <>
            <BotaoLink
              href="/inscricao/aluno"
              target="_blank"
              variante="secundario"
              icone="ExternalLink"
            >
              Ver ficha do aluno
            </BotaoLink>
            <BotaoLink
              href="/inscricao/professor"
              target="_blank"
              variante="secundario"
              icone="ExternalLink"
            >
              Ver ficha do professor
            </BotaoLink>
          </>
        }
      />

      <Card className="mb-6">
        <CardTitulo icone="Info">O que já vem na ficha</CardTitulo>
        <p className="-mt-2 text-[13px] leading-relaxed text-gray-500">
          Nome, e-mail, WhatsApp e senha são fixos e não podem ser removidos — sem eles a conta não
          existe. Para o aluno, a escolha da turma aparece sozinha quando há turma aberta. Tudo o
          que você adicionar abaixo entra depois desses campos.
        </p>
      </Card>

      <EditorDaFicha campos={campos} />
    </div>
  )
}
