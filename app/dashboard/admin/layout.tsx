import { redirect } from 'next/navigation'
import { exigirSessao } from '@/lib/auth'
import PortalNav, { type ItemNav } from '@/components/Dashboard/PortalNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao()

  // Segunda camada de proteção: o middleware já barra, mas confirmar aqui
  // garante que nenhuma rota nova entre sem querer nessa área.
  if (sessao.role !== 'admin') redirect('/dashboard/professor')

  const links: ItemNav[] = [
    { href: '/dashboard/admin', label: 'Visão geral', icone: 'LayoutDashboard', exact: true },
    { href: '/dashboard/admin/cursos', label: 'Cursos', icone: 'BookOpenText' },
    { href: '/dashboard/admin/turmas', label: 'Turmas', icone: 'GraduationCap' },
    { href: '/dashboard/admin/usuarios', label: 'Usuários', icone: 'Users2' },
    { href: '/dashboard/admin/permissoes', label: 'Permissões', icone: 'ShieldCheck' },
    { href: '/dashboard/admin/carrossel', label: 'Fotos da capa', icone: 'Images' },
    { href: '/dashboard/professor', label: 'Ver como professor', icone: 'Presentation' },
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
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
