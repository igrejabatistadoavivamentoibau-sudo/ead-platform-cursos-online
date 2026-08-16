import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader, Card, CardTitulo } from '@/components/ui'
import EditorDeBlocos from '@/components/Site/EditorDeBlocos'
import type { BlocoSite } from '@/lib/blocos'

export const dynamic = 'force-dynamic'

export default async function SitePage() {
  await exigirSessao()
  const supabase = await createClient()

  const { data } = await supabase
    .from('blocos_site')
    .select('*')
    .order('ordem', { ascending: true })

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Página inicial"
        descricao="Escreva as seções que aparecem para quem visita o site — a história da igreja, a missão, o que mais quiser contar."
      />

      <Card className="mb-6">
        <CardTitulo icone="Info">Como funciona</CardTitulo>
        <ul className="-mt-2 space-y-2 text-[13px] leading-relaxed text-gray-600">
          <li>
            Cada seção tem <strong>título, chapéu, texto e foto</strong>, e você escolhe como ela se
            apresenta: texto ao lado da foto, foto ao lado do texto, só texto, ou foto grande com o
            texto por cima.
          </li>
          <li>
            <strong>Pule uma linha em branco</strong> entre os parágrafos. Eles aparecem separados
            no site, em vez de virar um bloco único de texto.
          </li>
          <li>
            A chave esconde a seção sem apagar — útil para escrever com calma e publicar depois.
          </li>
        </ul>
      </Card>

      <EditorDeBlocos blocos={(data ?? []) as BlocoSite[]} />
    </div>
  )
}
