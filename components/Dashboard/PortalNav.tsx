'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import * as Icones from 'lucide-react'
import { Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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

const STORAGE_KEY = 'ibau:sidebar-collapsed'

const ACENTO = {
  brand: { texto: 'text-brand-300', ponto: 'bg-brand-400', selo: 'text-brand-300/90' },
  roxo: { texto: 'text-violet-300', ponto: 'bg-violet-400', selo: 'text-violet-300/90' },
  azul: { texto: 'text-sky-300', ponto: 'bg-sky-400', selo: 'text-sky-300/90' },
}

/**
 * Barra lateral dos três portais.
 *
 * Decisões de design:
 * - 232px em vez de 256px, e linhas mais baixas: ocupa menos e pesa menos.
 * - Itens agrupados por seção com rótulos micro — é o que dá leitura rápida
 *   num menu com muitos itens, em vez de uma lista corrida.
 * - Estado ativo por barra de acento + texto claro, não por bloco preenchido:
 *   marca a posição sem criar um "tijolo" visual.
 * - Superfície com gradiente sutil e borda de 1px, em vez de cor chapada.
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
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === '1')
    setHydrated(true)
  }, [])

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      localStorage.setItem(STORAGE_KEY, v ? '0' : '1')
      return !v
    })

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const acento = ACENTO[cor]

  // Agrupa preservando a ordem de entrada
  const grupos: { nome: string | null; itens: ItemNav[] }[] = []
  for (const link of links) {
    const chave = link.grupo ?? null
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.nome === chave) ultimo.itens.push(link)
    else grupos.push({ nome: chave, itens: [link] })
  }

  const Icone = ({ nome, className }: { nome: string; className: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C = (Icones as any)[nome] ?? Icones.Circle
    return <C className={className} strokeWidth={1.9} />
  }

  /** Um item do menu, usado no desktop e no celular. */
  const ItemLink = ({ link, aoClicar }: { link: ItemNav; aoClicar?: () => void }) => {
    const active = isActive(link.href, link.exact)
    return (
      <Link
        href={link.href}
        onClick={aoClicar}
        title={collapsed ? link.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex items-center rounded-lg text-[13px] font-medium transition-colors duration-200 ${
          collapsed ? 'justify-center h-9 w-9 mx-auto' : 'gap-2.5 px-2.5 py-[7px]'
        } ${
          active
            ? 'bg-white/[0.07] text-white'
            : 'text-white/55 hover:text-white/90 hover:bg-white/[0.04]'
        }`}
      >
        {/* Barra de acento marca o item ativo sem encher o fundo */}
        {active && !collapsed && (
          <span
            className={`absolute -left-2.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full ${acento.ponto}`}
          />
        )}
        {active && collapsed && (
          <span
            className={`absolute -left-1.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full ${acento.ponto}`}
          />
        )}

        <Icone
          nome={link.icone}
          className={`h-4 w-4 shrink-0 transition-colors ${active ? acento.texto : ''}`}
        />
        {!collapsed && <span className="truncate">{link.label}</span>}

        {collapsed && (
          <span className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-md bg-brand-950 px-2 py-1 text-[12px] font-medium text-white opacity-0 shadow-float ring-1 ring-white/10 transition-opacity duration-200 group-hover:opacity-100">
            {link.label}
          </span>
        )}
      </Link>
    )
  }

  return (
    <>
      {/* ===================== CELULAR ===================== */}
      <div className="md:hidden sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/10 bg-brand-950 px-4">
        <Link href={links[0]?.href ?? '/'} className="flex items-center gap-2.5">
          <Image src="/ibau-capelo.png" alt="Escola de Líderes IBAU" width={24} height={26} />
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
        className={`md:hidden fixed inset-0 z-40 transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div
          className="absolute inset-0 bg-brand-950/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
        <nav
          className={`absolute bottom-0 left-0 top-14 w-64 overflow-y-auto border-r border-white/10 bg-brand-950 px-3 py-4 transition-transform duration-300 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <span
            className={`mb-4 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${acento.selo}`}
          >
            <span className={`h-1 w-1 rounded-full ${acento.ponto}`} />
            {selo}
          </span>

          {grupos.map((g, i) => (
            <div key={g.nome ?? `g${i}`} className={i > 0 ? 'mt-5' : ''}>
              {g.nome && (
                <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.13em] text-white/30">
                  {g.nome}
                </p>
              )}
              <div className="space-y-0.5">
                {g.itens.map((link) => (
                  <ItemLink key={link.href} link={link} aoClicar={() => setMobileOpen(false)} />
                ))}
              </div>
            </div>
          ))}

          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="mb-2 truncate text-[13px] font-medium text-white/90">{name}</p>
            <LogoutButton className="!text-[13px] !text-white/50 hover:!text-white" />
          </div>
        </nav>
      </div>

      {/* ===================== DESKTOP ===================== */}
      <aside
        className={`sticky top-0 hidden min-h-screen shrink-0 flex-col border-r border-white/[0.07] bg-gradient-to-b from-brand-900 via-brand-950 to-brand-950 transition-[width] duration-300 ease-out md:flex ${
          collapsed ? 'w-16' : 'w-[232px]'
        } ${hydrated ? '' : 'md:opacity-0'}`}
      >
        {/* --- Topo: marca --- */}
        <div
          className={`flex h-14 items-center border-b border-white/[0.07] ${
            collapsed ? 'justify-center px-2' : 'justify-between pl-4 pr-2.5'
          }`}
        >
          {collapsed ? (
            <Link href={links[0]?.href ?? '/'} title="Início" className="flex items-center">
              <Image src="/ibau-capelo.png" alt="Escola de Líderes IBAU" width={24} height={26} />
            </Link>
          ) : (
            <Link href={links[0]?.href ?? '/'} className="flex min-w-0 items-center gap-2.5">
              <Image
                src="/ibau-capelo.png"
                alt=""
                width={26}
                height={28}
                className="h-[26px] w-auto shrink-0"
              />
              {/* Duas linhas: em 232px de largura o nome inteiro numa linha
                  só era cortado no meio da palavra. */}
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
            </Link>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Recolher menu"
              aria-expanded
              title="Recolher menu"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white/80"
            >
              <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </button>
          )}
        </div>

        {/* --- Selo do portal --- */}
        {!collapsed && (
          <div className="px-4 pb-1 pt-3.5">
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${acento.selo}`}
            >
              <span className={`h-1 w-1 rounded-full ${acento.ponto}`} />
              {selo}
            </span>
          </div>
        )}

        {/* --- Botão de expandir, quando recolhido --- */}
        {collapsed && (
          <div className="flex justify-center pt-3">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expandir menu"
              aria-expanded={false}
              title="Expandir menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white/80"
            >
              <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </button>
          </div>
        )}

        {/* --- Navegação --- */}
        <nav className={`flex-1 py-3 ${collapsed ? 'px-2' : 'px-4'}`}>
          {grupos.map((g, i) => (
            <div key={g.nome ?? `g${i}`} className={i > 0 ? (collapsed ? 'mt-3' : 'mt-5') : ''}>
              {g.nome &&
                (collapsed ? (
                  <div className="mx-auto mb-2 h-px w-5 bg-white/10" />
                ) : (
                  <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.13em] text-white/30">
                    {g.nome}
                  </p>
                ))}
              <div className="space-y-0.5">
                {g.itens.map((link) => (
                  <ItemLink key={link.href} link={link} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* --- Rodapé: usuário --- */}
        <div className={`border-t border-white/[0.07] ${collapsed ? 'px-2 py-3' : 'p-3'}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <span
                title={name}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-white/90 ring-1 ring-white/10"
              >
                {name.charAt(0).toUpperCase()}
              </span>
              <LogoutButton className="!text-white/40 hover:!text-white" iconOnly />
            </div>
          ) : (
            <div className="rounded-lg bg-white/[0.04] p-2.5">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-white/90 ring-1 ring-white/10">
                  {name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium leading-tight text-white/90">
                    {name}
                  </p>
                  <p className="text-[11px] leading-tight text-white/35">{titulo}</p>
                </div>
              </div>
              <LogoutButton className="!text-[12px] !text-white/45 hover:!text-white" />
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
