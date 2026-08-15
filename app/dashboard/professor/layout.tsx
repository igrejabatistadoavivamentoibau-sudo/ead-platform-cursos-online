import { exigirSessao } from '@/lib/auth'
import PortalNav, { type ItemNav } from '@/components/Dashboard/PortalNav'

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao()

  // O menu mostra só o que esta pessoa realmente pode acessar.
  const links: ItemNav[] = [
    { href: '/dashboard/professor', label: 'Minhas turmas', icone: 'LayoutDashboard', exact: true },
  ]

  // Admin visitando a área de professor tem um caminho de volta explícito.
  if (sessao.role === 'admin') {
    links.push({ href: '/dashboard/admin', label: 'Voltar ao painel admin', icone: 'ShieldCheck' })
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
    </div>
  )
}
