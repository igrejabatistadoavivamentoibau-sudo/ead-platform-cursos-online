import { exigirSessao } from '@/lib/auth'
import PortalNav, { type ItemNav } from '@/components/Dashboard/PortalNav'

const links: ItemNav[] = [
  { href: '/dashboard/aluno', label: 'Início', icone: 'LayoutDashboard', exact: true },
  { href: '/dashboard/aluno/cursos', label: 'Meus cursos', icone: 'BookOpenText', grupo: 'Estudos' },
]

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao()

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <PortalNav
        name={sessao.name}
        titulo="Portal do Aluno"
        selo="Aluno"
        cor="azul"
        links={links}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
