import { exigirSessao } from '@/lib/auth'
import PortalNav, { type ItemNav } from '@/components/Dashboard/PortalNav'
import Lumi from '@/components/Lumi'

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao()

  // O menu mostra só o que esta pessoa realmente pode acessar.
  const links: ItemNav[] = [
    { href: '/dashboard/professor', label: 'Minhas turmas', icone: 'LayoutDashboard', exact: true },
    { href: '/dashboard/professor/conversas', label: 'Conversas', icone: 'MessagesSquare', grupo: 'Comunicação' },
    { href: '/dashboard/professor/notificacoes', label: 'Notificações', icone: 'Bell', grupo: 'Comunicação' },
  ]

  // Admin visitando a área de professor tem um caminho de volta explícito.
  if (sessao.role === 'admin') {
    links.push({
      href: '/dashboard/admin',
      label: 'Painel admin',
      icone: 'ShieldCheck',
      grupo: 'Administração',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <PortalNav
        name={sessao.name}
        titulo="Portal do Professor"
        selo={sessao.role === 'admin' ? 'Admin · Professor' : 'Professor'}
        cor="roxo"
        links={links}
      />
      <main className="flex-1 min-w-0">{children}</main>
      <Lumi />
    </div>
  )
}
