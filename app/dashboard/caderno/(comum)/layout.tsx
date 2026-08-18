import { exigirSessao } from '@/lib/auth'
import PortalNav from '@/components/Dashboard/PortalNav'
import Lumi from '@/components/Lumi'
import TopbarLigada from '@/components/Topo'
import { portalDoPapel } from '@/lib/navegacao'

/**
 * Como a Bíblia, o caderno é de quem estiver logado — aluno, professor ou
 * liderança. Todo mundo assiste aula e todo mundo anota.
 *
 * A JANELA SEPARADA
 * Quando o caderno é aberto na segunda tela (`?janela=1`), a moldura some:
 * nada de barra lateral nem barra de cima. Numa janela pequena, ao lado do
 * vídeo, cada pixel gasto com menu é uma linha a menos de anotação — e o
 * aluno não vai navegar por ali, ele vai escrever.
 */
export default async function CadernoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<Record<string, string>>
}) {
  void params
  const sessao = await exigirSessao()
  const portal = portalDoPapel(sessao.role)

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <PortalNav
        name={sessao.name}
        titulo={portal.titulo}
        selo={portal.selo}
        cor={portal.cor}
        links={portal.links}
      />
      <main className="flex-1 min-w-0">
        <TopbarLigada
          portal={portal.portal}
          nome={sessao.name}
          papel={portal.selo}
          userId={sessao.id}
          notifHref={portal.notifHref}
          chatHref={portal.chatHref}
        />
        {children}
      </main>
      <Lumi />
    </div>
  )
}
