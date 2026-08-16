import { redirect } from 'next/navigation'
import { exigirSessao } from '@/lib/auth'
import PortalNav, { type ItemNav } from '@/components/Dashboard/PortalNav'
import Lumi from '@/components/Lumi'
import TopbarLigada from '@/components/Topo'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao()

  // Segunda camada de proteção: o middleware já barra, mas confirmar aqui
  // garante que nenhuma rota nova entre sem querer nessa área.
  if (sessao.role !== 'admin') redirect('/dashboard/professor')

  const links: ItemNav[] = [
    { href: '/dashboard/admin', label: 'Visão geral', icone: 'LayoutDashboard', exact: true },

    { href: '/dashboard/admin/cursos', label: 'Cursos', icone: 'BookOpenText', grupo: 'Ensino' },
    { href: '/dashboard/admin/turmas', label: 'Turmas', icone: 'GraduationCap', grupo: 'Ensino' },

    { href: '/dashboard/professor/conversas', label: 'Conversas', icone: 'MessagesSquare', grupo: 'Pessoas' },
    { href: '/dashboard/admin/notificacoes', label: 'Notificações', icone: 'Bell', grupo: 'Pessoas' },
    { href: '/dashboard/admin/inscricoes', label: 'Inscrições', icone: 'Inbox', grupo: 'Pessoas' },
    { href: '/dashboard/admin/usuarios', label: 'Usuários', icone: 'Users2', grupo: 'Pessoas' },
    { href: '/dashboard/admin/permissoes', label: 'Permissões', icone: 'ShieldCheck', grupo: 'Pessoas' },

    { href: '/dashboard/admin/site', label: 'Página inicial', icone: 'LayoutTemplate', grupo: 'Site' },
    { href: '/dashboard/admin/lumi', label: 'LUMI', icone: 'Sparkles', grupo: 'Site' },
    { href: '/dashboard/admin/carrossel', label: 'Fotos da capa', icone: 'Images', grupo: 'Site' },
    { href: '/dashboard/professor', label: 'Ver como professor', icone: 'Presentation', grupo: 'Site' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <PortalNav
        name={sessao.name}
        titulo="Painel Admin"
        selo="Administrador"
        cor="brand"
        links={links}
      />
      <main className="flex-1 min-w-0">
        <TopbarLigada
          portal="Painel Admin"
          nome={sessao.name}
          papel="Administrador"
          userId={sessao.id}
          notifHref="/dashboard/admin/notificacoes"
          chatHref="/dashboard/professor/conversas"
        />
        {children}
      </main>
      <Lumi />
    </div>
  )
}
