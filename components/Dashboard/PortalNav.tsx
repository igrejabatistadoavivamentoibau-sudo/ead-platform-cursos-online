'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import * as Icones from 'lucide-react'
import { Menu, X, PanelLeftClose, PanelLeftOpen, ChevronRight } from 'lucide-react'
import LogoutButton from './LogoutButton'

export interface ItemNav {
  href: string
  label: string
  /** Nome do ícone no lucide-react (ex.: 'LayoutDashboard'). */
  icone: string
  exact?: boolean
  /** Seção do menu. Itens sem grupo aparecem primeiro, sem rótulo. */
  grupo?: string
}

const CHAVE_RECOLHIDA = 'ibau:sidebar-collapsed'
const CHAVE_GAVETAS = 'ibau:sidebar-gavetas'

const ACENTO = {
  brand: { texto: 'text-brand-300', barra: 'bg-brand-400', anel: 'ring-brand-400/40' },
  roxo: { texto: 'text-violet-300', barra: 'bg-violet-400', anel: 'ring-violet-400/40' },
  azul: { texto: 'text-sky-300', barra: 'bg-sky-400', anel: 'ring-sky-400/40' },
}

/**
 * Barra lateral dos três portais.
 *
 * DECISÕES DE DESIGN
 *
 * 1. Gavetas em vez de lista corrida.
 *    Cada seção é um botão que abre e fecha. Numa lista corrida o olho
 *    precisa varrer tudo para achar um item; com gavetas a pessoa lê três
 *    ou quatro títulos e abre só o que interessa. O estado de cada gaveta
 *    fica salvo, então o menu volta do jeito que a pessoa deixou.
 *
 * 2. Item ativo marcado por barra de acento, não por bloco preenchido.
 *    Bloco colorido vira um "tijolo" que domina a tela inteira. A barra
 *    fina marca a posição com a mesma clareza e deixa o menu calmo.
 *
 * 3. Hierarquia por espaço e peso, não por linhas divisórias.
 *    Interface cara separa com espaço em branco; interface amadora põe
 *    borda em tudo. Sobraram duas divisórias: topo e rodapé.
 *
 * 4. Rodapé com a pessoa, não um "sair" solto.
 *    Iniciais, nome e papel. Resolve a dúvida de "com qual conta eu estou?",
 *    frequente em quem é admin e professor ao mesmo tempo.
 */
export default function PortalNav({
  name,
  titulo,
  selo,
  cor,
  links,
}: {
  name: string
  titulo: string
  selo: string
  cor: 'brand' | 'roxo' | 'azul'
  links: ItemNav[]
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [fechadas, setFechadas] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  const acento = ACENTO[cor]

  const grupos = useMemo(() => {
    const saida: { nome: string | null; itens: ItemNav[] }[] = []
    for (const link of links) {
      const chave = link.grupo ?? null
      const ultimo = saida[saida.length - 1]
      if (ultimo && ultimo.nome === chave) ultimo.itens.push(link)
      else saida.push({ nome: chave, itens: [link] })
    }
    return saida
  }, [links])

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  useEffect(() => {
    setCollapsed(localStorage.getItem(CHAVE_RECOLHIDA) === '1')
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_GAVETAS) ?? '[]')
      if (Array.isArray(salvo)) setFechadas(salvo)
    } catch {
      setFechadas([])
    }
    setHydrated(true)
  }, [])

  const alternarRecolhida = () =>
    setCollapsed((v) => {
      localStorage.setItem(CHAVE_RECOLHIDA, v ? '0' : '1')
      return !v
    })

  // Navegou para uma página que está dentro de uma gaveta fechada? Abre.
  // Acontece só na troca de página — depois disso, quem manda é o clique.
  useEffect(() => {
    const doGrupoAtual = grupos.find(
      (g) => g.nome && g.itens.some((l) => isActive(l.href, l.exact))
    )
    if (!doGrupoAtual?.nome) return
    setFechadas((atual) => {
      if (!atual.includes(doGrupoAtual.nome as string)) return atual
      const proximo = atual.filter((n) => n !== doGrupoAtual.nome)
      localStorage.setItem(CHAVE_GAVETAS, JSON.stringify(proximo))
      return proximo
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const alternarGaveta = (nome: string) =>
    setFechadas((atual) => {
      const proximo = atual.includes(nome) ? atual.filter((n) => n !== nome) : [...atual, nome]
      localStorage.setItem(CHAVE_GAVETAS, JSON.stringify(proximo))
      return proximo
    })

  const Icone = ({ nome, className }: { nome: string; className: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C = (Icones as any)[nome] ?? Icones.Circle
    return <C className={className} strokeWidth={1.9} />
  }

  const iniciais =
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'

  const ItemLink = ({
    link,
    aoClicar,
    recolhido = false,
  }: {
    link: ItemNav
    aoClicar?: () => void
    recolhido?: boolean
  }) => {
    const active = isActive(link.href, link.exact)
    return (
      <Link
        href={link.href}
        onClick={aoClicar}
        title={recolhido ? link.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex items-center rounded-lg text-[13px] transition-all duration-200 ${
          recolhido ? 'mx-auto h-9 w-9 justify-center' : 'gap-2.5 py-[7px] pl-2.5 pr-2'
        } ${
          active
            ? 'bg-white/[0.08] font-semibold text-white'
            : 'font-medium text-white/50 hover:bg-white/[0.05] hover:text-white/90'
        }`}
      >
        {active && (
          <span
            className={`absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full ${acento.barra} ${
              recolhido ? '-left-1.5' : '-left-2'
            }`}
          />
        )}

        <Icone
          nome={link.icone}
          className={`h-[17px] w-[17px] shrink-0 transition-colors ${
            active ? acento.texto : 'text-white/45 group-hover:text-white/75'
          }`}
        />
        {!recolhido && <span className="truncate">{link.label}</span>}

        {recolhido && (
          <span className="pointer-events-none absolute left-full z-50 ml-2.5 whitespace-nowrap rounded-md bg-brand-950 px-2.5 py-1.5 text-[12px] font-medium text-white opacity-0 shadow-float ring-1 ring-white/10 transition-opacity duration-200 group-hover:opacity-100">
            {link.label}
          </span>
        )}
      </Link>
    )
  }

  /**
   * Uma gaveta.
   *
   * A animação usa grid-template-rows de 0fr para 1fr — é o único jeito de
   * animar altura automática em CSS puro, sem medir o conteúdo com
   * JavaScript toda vez que abre.
   */
  const Gaveta = ({
    grupo,
    aoClicar,
  }: {
    grupo: { nome: string | null; itens: ItemNav[] }
    aoClicar?: () => void
  }) => {
    // Itens sem seção ficam sempre à vista, no topo.
    if (!grupo.nome) {
      return (
        <div className="space-y-0.5">
          {grupo.itens.map((l) => (
            <ItemLink key={l.href} link={l} aoClicar={aoClicar} />
          ))}
        </div>
      )
    }

    const temAtivo = grupo.itens.some((l) => isActive(l.href, l.exact))
    // A gaveta SEMPRE obedece ao clique.
    //
    // A versão anterior forçava a gaveta da página atual a ficar aberta, com
    // a intenção de nunca esconder onde a pessoa está. Na prática isso fazia
    // o clique não surtir efeito: como sempre se está dentro de alguma seção,
    // aquela seção simplesmente não fechava. Parecia menu quebrado.
    // A abertura automática agora acontece na navegação (ver useEffect), que
    // atende a mesma intenção sem tirar o controle de quem clica.
    const aberta = !fechadas.includes(grupo.nome)

    return (
      <div>
        {/* Cabeçalho da gaveta.
            A versão anterior era um rótulo minúsculo e apagado, sem fundo:
            ninguém percebia que dava para clicar. Agora tem altura de botão,
            fundo próprio no repouso, seta em caixa visível e contador sempre
            presente — o conjunto diz "isto abre e fecha" antes do primeiro
            clique, que é o trabalho da affordance. */}
        <button
          type="button"
          onClick={() => alternarGaveta(grupo.nome as string)}
          aria-expanded={aberta}
          className={`group/g flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[10.5px] font-bold uppercase tracking-[0.12em] transition-colors ${
            aberta
              ? 'bg-white/[0.04] text-white/60 hover:bg-white/[0.07] hover:text-white/85'
              : 'bg-white/[0.02] text-white/45 hover:bg-white/[0.06] hover:text-white/75'
          }`}
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
              aberta ? 'bg-white/10' : 'bg-white/[0.06] group-hover/g:bg-white/12'
            }`}
          >
            <ChevronRight
              className={`h-3 w-3 transition-transform duration-300 ${aberta ? 'rotate-90' : ''}`}
              strokeWidth={2.8}
            />
          </span>

          <span className="truncate">{grupo.nome}</span>

          {/* Ponto discreto quando a página aberta está dentro desta gaveta,
              mesmo com ela fechada: a pessoa não perde a referência de onde
              está só porque recolheu a seção. */}
          {!aberta && temAtivo && (
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${acento.barra}`} />
          )}

          <span
            className={`ml-auto rounded px-1.5 py-px text-[10px] font-bold tabular-nums transition-all duration-300 ${
              aberta ? 'text-white/25' : 'bg-white/10 text-white/60'
            }`}
          >
            {grupo.itens.length}
          </span>
        </button>

        {/* A abertura anima três coisas ao mesmo tempo: altura, opacidade e
            um leve deslocamento vertical. Só a altura fica seco — o conteúdo
            "aparece do nada" no fim. Com opacidade e deslize o conjunto tem
            a sensação de material desdobrando, que é o que se espera de uma
            gaveta. A curva é de saída suave, e a opacidade tem um atraso
            pequeno na abertura para o conteúdo não surgir antes de haver
            espaço para ele. */}
        <div
          className={`grid transition-[grid-template-rows] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            aberta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <div
              className={`ml-2 space-y-0.5 border-l pl-2 pt-1 transition-all duration-300 ease-out ${
                aberta
                  ? 'translate-y-0 border-white/[0.09] opacity-100 delay-[80ms]'
                  : '-translate-y-1 border-transparent opacity-0'
              }`}
            >
              {grupo.itens.map((l) => (
                <ItemLink key={l.href} link={l} aoClicar={aoClicar} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const Rodape = ({ aoClicar }: { aoClicar?: () => void }) => (
    <div className="flex items-center gap-2.5 px-1">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-bold text-white ring-1 ${acento.anel}`}
      >
        {iniciais}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[12.5px] font-semibold text-white/90">{name}</span>
        <span className="block truncate text-[10.5px] text-white/40">{selo}</span>
      </span>
      <span onClick={aoClicar}>
        <LogoutButton
          iconOnly
          className="!p-1.5 !text-white/35 hover:!text-white hover:!bg-white/10 rounded-lg"
        />
      </span>
    </div>
  )

  return (
    <>
      {/* ===================== CELULAR ===================== */}
      <div className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/[0.07] bg-brand-950 px-4 md:hidden">
        <Link href={links[0]?.href ?? '/'} className="flex items-center gap-2.5">
          <Image src="/ibau-marca-clara.png" alt="" width={30} height={26} className="h-6 w-auto" />
          <span className="text-[13px] font-semibold text-white">{titulo}</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileOpen}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 md:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div
          className="absolute inset-0 bg-brand-950/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
        <nav
          className={`absolute bottom-0 left-0 top-14 flex w-[266px] flex-col bg-brand-950 transition-transform duration-300 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {grupos.map((g, i) => (
              <Gaveta key={g.nome ?? `g${i}`} grupo={g} aoClicar={() => setMobileOpen(false)} />
            ))}
          </div>
          <div className="border-t border-white/[0.07] p-3">
            <Rodape aoClicar={() => setMobileOpen(false)} />
          </div>
        </nav>
      </div>

      {/* ===================== DESKTOP ===================== */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-gradient-to-b from-brand-900 via-brand-950 to-brand-950 transition-[width] duration-300 ease-out md:flex ${
          collapsed ? 'w-[62px]' : 'w-[236px]'
        } ${hydrated ? '' : 'md:opacity-0'}`}
      >
        {/* Fio de luz na borda direita: separa do conteúdo sem virar uma
            linha dura de 1px cinza atravessando a tela inteira. */}
        <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/[0.14] via-white/[0.06] to-transparent" />

        {/* --- Topo: marca --- */}
        <div
          className={`flex h-14 shrink-0 items-center border-b border-white/[0.06] ${
            collapsed ? 'justify-center px-2' : 'justify-between pl-3.5 pr-2'
          }`}
        >
          <Link
            href={links[0]?.href ?? '/'}
            title={collapsed ? 'Início' : undefined}
            className="flex min-w-0 items-center gap-2.5"
          >
            <Image
              src="/ibau-marca-clara.png"
              alt=""
              width={34}
              height={29}
              className="h-[26px] w-auto shrink-0"
            />
            {!collapsed && (
              <span className="min-w-0 leading-none">
                <span className="block truncate font-display text-[12.5px] font-bold tracking-[-0.01em] text-white">
                  Escola de Líderes
                </span>
                <span
                  className={`mt-[3px] block text-[9.5px] font-bold uppercase tracking-[0.2em] ${acento.texto}`}
                >
                  IBAU
                </span>
              </span>
            )}
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={alternarRecolhida}
              aria-label="Recolher menu"
              title="Recolher menu"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.07] hover:text-white/80"
            >
              <PanelLeftClose className="h-[17px] w-[17px]" strokeWidth={1.9} />
            </button>
          )}
        </div>

        {/* --- Navegação --- */}
        <nav
          className={`flex-1 overflow-y-auto py-3 ${
            collapsed ? 'space-y-1 px-2.5' : 'space-y-3 px-3'
          }`}
        >
          {collapsed
            ? // Recolhida, gaveta não faz sentido em 62px: viram só ícones,
              // com um fio curto separando os grupos.
              grupos.map((g, i) => (
                <div key={g.nome ?? `g${i}`} className="space-y-1">
                  {i > 0 && <span className="mx-auto my-2 block h-px w-5 bg-white/10" />}
                  {g.itens.map((l) => (
                    <ItemLink key={l.href} link={l} recolhido />
                  ))}
                </div>
              ))
            : grupos.map((g, i) => <Gaveta key={g.nome ?? `g${i}`} grupo={g} />)}
        </nav>

        {/* --- Rodapé: quem está logado --- */}
        <div className={`shrink-0 border-t border-white/[0.06] ${collapsed ? 'p-2' : 'p-3'}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <span
                title={`${name} — ${selo}`}
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-bold text-white ring-1 ${acento.anel}`}
              >
                {iniciais}
              </span>
              <button
                type="button"
                onClick={alternarRecolhida}
                aria-label="Expandir menu"
                title="Expandir menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.07] hover:text-white/80"
              >
                <PanelLeftOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </button>
            </div>
          ) : (
            <Rodape />
          )}
        </div>
      </aside>
    </>
  )
}
