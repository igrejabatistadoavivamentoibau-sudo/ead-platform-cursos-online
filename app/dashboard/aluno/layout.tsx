import { exigirSessao } from '@/lib/auth'
import PortalNav, { type ItemNav } from '@/components/Dashboard/PortalNav'
import Lumi from '@/components/Lumi'

const links: ItemNav[] = [
  { href: '/dashboard/aluno', label: 'Início', icone: 'LayoutDashboard', exact: true },

  { href: '/dashboard/aluno/cursos', label: 'Meus cursos', icone: 'BookOpenText', grupo: 'Estudos' },
  { href: '/dashboard/aluno/conversas', label: 'Conversas', icone: 'MessagesSquare', grupo: 'Estudos' },
  { href: '/dashboard/aluno/atividades', label: 'Minhas atividades', icone: 'FileText', grupo: 'Estudos' },

  { href: '/dashboard/aluno/notas', label: 'Minhas notas', icone: 'GraduationCap', grupo: 'Desempenho' },
  { href: '/dashboard/aluno/presencas', label: 'Minhas presenças', icone: 'ClipboardCheck', grupo: 'Desempenho' },
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
      <Lumi />
    </div>
  )
}
