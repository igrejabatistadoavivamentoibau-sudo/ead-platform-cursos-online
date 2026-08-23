import type { ItemNav } from '@/components/Dashboard/PortalNav'
import type { UserRole } from '@/lib/permissoes'

/* ============================================================
   O MENU DE CADA PORTAL, NUM LUGAR SÓ

   Antes cada layout carregava a própria lista de links. Funcionava — até
   aparecer uma tela que é dos TRÊS portais, como a Bíblia: ela precisa
   desenhar o menu certo para quem entrou, e não tem como saber qual é sem
   duplicar as três listas.

   Com tudo aqui, a Bíblia (e qualquer outra tela comum que venha depois)
   pergunta "qual é o menu deste papel?" e recebe pronto.
   ============================================================ */

export interface PerfilDePortal {
  titulo: string
  selo: string
  cor: 'brand' | 'azul' | 'roxo'
  portal: string
  notifHref: string
  chatHref: string
  links: ItemNav[]
}

const ALUNO: PerfilDePortal = {
  titulo: 'Portal do Aluno',
  selo: 'Aluno',
  cor: 'azul',
  portal: 'Portal do Aluno',
  notifHref: '/dashboard/aluno/notificacoes',
  chatHref: '/dashboard/aluno/conversas',
  links: [
    { href: '/dashboard/aluno', label: 'Início', icone: 'LayoutDashboard', exact: true },

    { href: '/dashboard/aluno/cursos', label: 'Meus cursos', icone: 'BookOpenText', grupo: 'Estudos' },
    { href: '/dashboard/biblia', label: 'Bíblia', icone: 'BookMarked', grupo: 'Estudos' },
    { href: '/dashboard/caderno', label: 'Meu caderno', icone: 'NotebookPen', grupo: 'Estudos' },
    { href: '/dashboard/aluno/conversas', label: 'Conversas', icone: 'MessagesSquare', grupo: 'Estudos' },
    { href: '/dashboard/aluno/atividades', label: 'Minhas atividades', icone: 'FileText', grupo: 'Estudos' },

    { href: '/dashboard/aluno/notas', label: 'Minhas notas', icone: 'GraduationCap', grupo: 'Desempenho' },
    { href: '/dashboard/aluno/presencas', label: 'Minhas presenças', icone: 'ClipboardCheck', grupo: 'Desempenho' },

    /* A loja fica num grupo próprio, e não junto dos estudos: comprar um
       livro não é estudar, e misturar as duas coisas faria o menu de quem
       só quer assistir aula ficar mais longo sem motivo. */
    { href: '/dashboard/aluno/loja', label: 'Loja IBAU', icone: 'ShoppingBag', grupo: 'Loja' },
    { href: '/dashboard/aluno/pedidos', label: 'Meus pedidos', icone: 'Receipt', grupo: 'Loja' },
  ],
}

const PROFESSOR: PerfilDePortal = {
  titulo: 'Portal do Professor',
  selo: 'Professor',
  cor: 'roxo',
  portal: 'Portal do Professor',
  notifHref: '/dashboard/professor/notificacoes',
  chatHref: '/dashboard/professor/conversas',
  links: [
    { href: '/dashboard/professor', label: 'Minhas turmas', icone: 'LayoutDashboard', exact: true },
    { href: '/dashboard/biblia', label: 'Bíblia', icone: 'BookMarked', grupo: 'Ensino' },
    { href: '/dashboard/caderno', label: 'Meu caderno', icone: 'NotebookPen', grupo: 'Ensino' },
    { href: '/dashboard/professor/conversas', label: 'Conversas', icone: 'MessagesSquare', grupo: 'Comunicação' },
    { href: '/dashboard/professor/notificacoes', label: 'Notificações', icone: 'Bell', grupo: 'Comunicação' },
  ],
}

const ADMIN: PerfilDePortal = {
  titulo: 'Painel Admin',
  selo: 'Administrador',
  cor: 'brand',
  portal: 'Painel Admin',
  notifHref: '/dashboard/admin/notificacoes',
  chatHref: '/dashboard/professor/conversas',
  links: [
    { href: '/dashboard/admin', label: 'Visão geral', icone: 'LayoutDashboard', exact: true },

    { href: '/dashboard/admin/cursos', label: 'Cursos', icone: 'BookOpenText', grupo: 'Ensino' },
    { href: '/dashboard/admin/turmas', label: 'Turmas', icone: 'GraduationCap', grupo: 'Ensino' },
    { href: '/dashboard/biblia', label: 'Bíblia', icone: 'BookMarked', grupo: 'Ensino' },
    { href: '/dashboard/caderno', label: 'Meu caderno', icone: 'NotebookPen', grupo: 'Ensino' },

    { href: '/dashboard/professor/conversas', label: 'Conversas', icone: 'MessagesSquare', grupo: 'Pessoas' },
    { href: '/dashboard/admin/notificacoes', label: 'Notificações', icone: 'Bell', grupo: 'Pessoas' },
    { href: '/dashboard/admin/inscricoes', label: 'Inscrições', icone: 'Inbox', grupo: 'Pessoas' },
    // Quem reprovou e está esperando a coordenação decidir em qual turma
    // refaz o módulo. Sem um lugar no menu, essa fila ficaria invisível.
    { href: '/dashboard/admin/repetentes', label: 'Repete o módulo', icone: 'RotateCcw', grupo: 'Pessoas' },
    { href: '/dashboard/admin/usuarios', label: 'Usuários', icone: 'Users2', grupo: 'Pessoas' },
    { href: '/dashboard/admin/permissoes', label: 'Permissões', icone: 'ShieldCheck', grupo: 'Pessoas' },

    { href: '/dashboard/admin/loja', label: 'Loja e pagamentos', icone: 'ShoppingBag', grupo: 'Loja' },
    { href: '/dashboard/admin/pedidos', label: 'Pedidos', icone: 'Receipt', grupo: 'Loja' },

    { href: '/dashboard/admin/site', label: 'Página inicial', icone: 'LayoutTemplate', grupo: 'Site' },
    { href: '/dashboard/admin/lumi', label: 'LUMI', icone: 'Sparkles', grupo: 'Site' },
    { href: '/dashboard/admin/carrossel', label: 'Fotos da capa', icone: 'Images', grupo: 'Site' },
    { href: '/dashboard/professor', label: 'Ver como professor', icone: 'Presentation', grupo: 'Site' },
  ],
}

export function portalDoPapel(papel: UserRole): PerfilDePortal {
  if (papel === 'admin') return ADMIN
  if (papel === 'professor') return PROFESSOR
  return ALUNO
}
