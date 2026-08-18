import { exigirSessao } from '@/lib/auth'
import PortalNav from '@/components/Dashboard/PortalNav'
import Lumi from '@/components/Lumi'
import TopbarLigada from '@/components/Topo'
import { portalDoPapel } from '@/lib/navegacao'

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao()
  const portal = portalDoPapel('professor')

  // Admin visitando a área de professor tem um caminho de volta explícito —
  // sem isso ele entra aqui e fica sem saída visível para o painel dele.
  const ehAdmin = sessao.role === 'admin'
  const links = ehAdmin
    ? [
        ...portal.links,
        {
          href: '/dashboard/admin',
          label: 'Painel admin',
          icone: 'ShieldCheck',
          grupo: 'Administração',
        },
      ]
    : portal.links

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <PortalNav
        name={sessao.name}
        titulo={portal.titulo}
        selo={ehAdmin ? 'Admin · Professor' : portal.selo}
        cor={portal.cor}
        links={links}
      />
      <main className="flex-1 min-w-0">
        <TopbarLigada
          portal={portal.portal}
          nome={sessao.name}
          papel={ehAdmin ? 'Administrador' : 'Professor'}
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
