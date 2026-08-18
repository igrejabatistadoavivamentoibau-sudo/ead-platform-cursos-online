import { exigirSessao } from '@/lib/auth'
import PortalNav from '@/components/Dashboard/PortalNav'
import Lumi from '@/components/Lumi'
import TopbarLigada from '@/components/Topo'
import { portalDoPapel } from '@/lib/navegacao'

/**
 * A Bíblia é a única tela da plataforma que pertence aos três portais.
 *
 * Em vez de existir uma cópia dela dentro de cada um — três telas para
 * manter, três chances de divergirem —, ela mora aqui fora e monta o menu
 * de quem entrou. O aluno vê a barra do aluno, o professor a dele, o admin
 * a dele. A Palavra é a mesma; a moldura é a da casa de cada um.
 */
export default async function BibliaLayout({ children }: { children: React.ReactNode }) {
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
