import { redirect } from 'next/navigation'
import { exigirSessao } from '@/lib/auth'
import PortalNav from '@/components/Dashboard/PortalNav'
import Lumi from '@/components/Lumi'
import TopbarLigada from '@/components/Topo'
import { portalDoPapel } from '@/lib/navegacao'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao()
  const portal = portalDoPapel(sessao.role)

  // Segunda camada de proteção: o middleware já barra, mas confirmar aqui
  // garante que nenhuma rota nova entre sem querer nessa área.
  if (sessao.role !== 'admin') redirect('/dashboard/professor')

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
