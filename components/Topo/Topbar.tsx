'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, MessagesSquare } from 'lucide-react'

/**
 * Barra superior da área logada — o ponto fixo de notificações e conversas.
 *
 * DECISÕES
 * - Vidro translúcido com desfoque: a barra pertence à página, não briga
 *   com ela. Fundo chapado criaria uma segunda "faixa de app" pesada.
 * - O sino e as conversas moram AQUI, não no menu lateral: aviso é algo que
 *   interrompe, e o canto superior direito é onde todo produto maduro
 *   coloca interrupções — o olho já sabe onde procurar.
 * - Os contadores vêm do servidor junto com a página. Sem consulta extra
 *   do navegador, sem piscar de "0" para o número real.
 * - Só desktop: no celular, a faixa do menu lateral já ocupa o topo, e
 *   duas barras empilhadas comeriam a tela.
 */
const TITULOS: [RegExp, string][] = [
  [/\/conversas/, 'Conversas'],
  [/\/notificacoes/, 'Notificações'],
  [/\/cursos\/.+/, 'Curso'],
  [/\/cursos/, 'Cursos'],
  [/\/atividades/, 'Atividades'],
  [/\/notas/, 'Notas'],
  [/\/presencas/, 'Presenças'],
  [/\/turmas/, 'Turmas'],
  [/\/usuarios/, 'Usuários'],
  [/\/inscricoes\/ficha/, 'Ficha de inscrição'],
  [/\/inscricoes/, 'Inscrições'],
  [/\/permissoes/, 'Permissões'],
  [/\/carrossel/, 'Fotos da capa'],
  [/\/lumi/, 'LUMI'],
  [/\/site/, 'Página inicial'],
  [/\/avanco/, 'Avanço da turma'],
  [/\/chamada/, 'Chamada'],
]

export default function Topbar({
  portal,
  nome,
  papel,
  notifHref,
  chatHref,
  naoLidas,
  conversasNovas,
}: {
  portal: string
  nome: string
  papel: string
  notifHref: string
  chatHref: string
  naoLidas: number
  conversasNovas: number
}) {
  const pathname = usePathname()
  const titulo = TITULOS.find(([re]) => re.test(pathname))?.[1] ?? 'Início'

  const iniciais =
    nome
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'

  const Badge = ({ n }: { n: number }) =>
    n > 0 ? (
      <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-white bg-red-600 px-1 text-[9px] font-bold leading-none text-white">
        {n > 9 ? '9+' : n}
      </span>
    ) : null

  return (
    <div className="sticky top-0 z-40 hidden items-center gap-2.5 border-b border-brand-950/[0.07] bg-white/70 px-7 py-2.5 backdrop-blur-xl md:flex">
      <div className="min-w-0">
        <p className="text-[10.5px] font-medium tracking-wide text-gray-400">{portal}</p>
        <p className="truncate font-display text-[14.5px] font-bold tracking-[-0.015em] text-gray-900">
          {titulo}
        </p>
      </div>

      <div className="ml-auto" />

      <Link
        href={notifHref}
        title="Notificações"
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-brand-950/[0.08] bg-white text-gray-600 shadow-[0_1px_2px_rgba(5,38,29,0.04)] transition-colors hover:border-brand-500/30 hover:text-brand-700"
      >
        <Bell className="h-[17px] w-[17px]" strokeWidth={1.9} />
        <Badge n={naoLidas} />
      </Link>

      <Link
        href={chatHref}
        title="Conversas"
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-brand-950/[0.08] bg-white text-gray-600 shadow-[0_1px_2px_rgba(5,38,29,0.04)] transition-colors hover:border-brand-500/30 hover:text-brand-700"
      >
        <MessagesSquare className="h-[17px] w-[17px]" strokeWidth={1.9} />
        <Badge n={conversasNovas} />
      </Link>

      <span className="mx-1.5 h-6 w-px bg-brand-950/[0.08]" />

      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 text-[11px] font-bold tracking-wide text-white">
          {iniciais}
        </span>
        <span className="leading-tight">
          <span className="block text-[12px] font-bold tracking-[-0.01em] text-gray-900">
            {nome}
          </span>
          <span className="block text-[10px] text-gray-400">{papel}</span>
        </span>
      </div>
    </div>
  )
}
