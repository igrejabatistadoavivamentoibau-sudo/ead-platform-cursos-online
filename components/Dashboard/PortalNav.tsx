'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import * as Icones from 'lucide-react'
import { Menu, X, PanelLeftClose } from 'lucide-react'
import LogoutButton from './LogoutButton'

export interface ItemNav {
  href: string
  label: string
  /** Nome do ícone no lucide-react (ex.: 'LayoutDashboard'). */
  icone: string
  exact?: boolean
}

const STORAGE_KEY = 'ibau:sidebar-collapsed'

/**
 * Barra lateral retrátil compartilhada pelos três portais (admin, professor
 * e aluno). O selo muda de cor conforme o papel, deixando visualmente claro
 * em qual área a pessoa está.
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

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      localStorage.setItem(STORAGE_KEY, v ? '0' : '1')
      return !v
    })
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const CORES = {
    brand: 'bg-white/10 text-brand-200',
    roxo: 'bg-purple-400/15 text-purple-200',
    azul: 'bg-sky-400/15 text-sky-200',
  }[cor]

  const Icone = ({ nome, className }: { nome: string; className: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const C = (Icones as any)[nome] ?? Icones.Circle
    return <C className={className} strokeWidth={2} />
  }

  return (
    <>
      {/* ===== Topo no celular ===== */}
      <div className="md:hidden sticky top-0 z-50 flex items-center justify-between bg-brand-950 text-white px-4 h-14 shadow-float">
        <Link href={links[0]?.href ?? '/'} className="flex items-center gap-2.5">
          <Image src="/ibau-logo-transparent.png" alt="Logo IBAU" width={26} height={26} />
          <span className="font-semibold text-sm">{titulo}</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileOpen}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Gaveta no celular */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div
          className="absolute inset-0 bg-brand-950/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
        <nav
          className={`absolute left-0 top-14 bottom-0 w-72 bg-brand-950 text-white p-4 overflow-y-auto transition-transform duration-300 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider mb-4 ${CORES}`}
          >
            {selo}
          </span>

          <div className="space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(link.href, link.exact)
                    ? 'bg-brand-500/25 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                    : 'text-brand-100/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icone nome={link.icone} className="h-[18px] w-[18px] shrink-0" />
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-sm font-medium text-white truncate mb-2">{name}</p>
            <LogoutButton className="!text-brand-100/70 hover:!text-white" />
          </div>
        </nav>
      </div>

      {/* ===== Sidebar no desktop ===== */}
      <aside
        className={`hidden md:flex md:flex-col shrink-0 bg-brand-950 text-white min-h-screen sticky top-0 transition-[width] duration-300 ease-out ${
          collapsed ? 'w-[76px]' : 'w-64'
        } ${hydrated ? '' : 'md:opacity-0'}`}
      >
        <div
          className={`flex items-center h-16 border-b border-white/10 ${
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          {!collapsed && (
            <Link href={links[0]?.href ?? '/'} className="flex items-center gap-2.5 min-w-0">
              <Image
                src="/ibau-logo-transparent.png"
                alt="Logo IBAU"
                width={28}
                height={28}
                className="shrink-0"
              />
              <div className="leading-tight min-w-0">
                <div className="text-sm font-bold truncate">Escola de Líderes</div>
                <div className="text-[11px] text-brand-300 font-semibold tracking-wide">IBAU</div>
              </div>
            </Link>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-100/70 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            {collapsed ? (
              <Menu className="h-5 w-5" strokeWidth={2.25} />
            ) : (
              <PanelLeftClose className="h-5 w-5" strokeWidth={2} />
            )}
          </button>
        </div>

        <div className={`pt-3 pb-1 ${collapsed ? 'px-2 flex justify-center' : 'px-4'}`}>
          {collapsed ? (
            <span
              title={selo}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold ${CORES}`}
            >
              {selo.charAt(0)}
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${CORES}`}
            >
              {selo}
            </span>
          )}
        </div>

        <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {links.map((link) => {
            const active = isActive(link.href, link.exact)
            return (
              <Link
                key={link.href}
                href={link.href}
                title={collapsed ? link.label : undefined}
                className={`group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                  collapsed ? 'justify-center h-11 w-11 mx-auto' : 'gap-3 px-3 py-2.5'
                } ${
                  active
                    ? 'bg-brand-500/25 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                    : 'text-brand-100/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                {active && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-brand-300" />
                )}
                <Icone nome={link.icone} className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{link.label}</span>}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-brand-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-float transition-opacity duration-200 group-hover:opacity-100 z-50">
                    {link.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className={`py-4 border-t border-white/10 ${collapsed ? 'px-2' : 'px-4'}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <span
                title={name}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/30 text-sm font-bold text-white"
              >
                {name.charAt(0).toUpperCase()}
              </span>
              <LogoutButton className="!text-brand-100/70 hover:!text-white" iconOnly />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/30 text-sm font-bold text-white">
                  {name.charAt(0).toUpperCase()}
                </span>
                <p className="text-sm font-medium text-white truncate">{name}</p>
              </div>
              <LogoutButton className="!text-brand-100/70 hover:!text-white" />
            </>
          )}
        </div>
      </aside>
    </>
  )
}
