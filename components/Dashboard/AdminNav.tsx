'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  Users2,
  GraduationCap,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react'
import LogoutButton from './LogoutButton'

const links = [
  { href: '/dashboard/admin', label: 'Visão geral', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/admin/turmas', label: 'Turmas', icon: GraduationCap, exact: false },
  { href: '/dashboard/admin/usuarios', label: 'Usuários', icon: Users2, exact: false },
]

export default function AdminNav({ name }: { name: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* Top bar mobile */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-green-950 text-white px-4 h-14">
        <Link href="/dashboard/admin" className="flex items-center gap-2">
          <Image src="/ibau-logo-transparent.png" alt="Logo IBAU" width={24} height={24} />
          <span className="font-semibold text-sm">Painel Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-green-950 text-white px-4 pb-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href, link.exact)
                    ? 'bg-white/15 text-white'
                    : 'text-green-100/80 hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {link.label}
              </Link>
            )
          })}
          <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-green-200/70 truncate">{name}</span>
            <LogoutButton className="!text-green-100/80 hover:!text-white" />
          </div>
        </div>
      )}

      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 bg-green-950 text-white min-h-screen sticky top-0">
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-white/10">
          <Image src="/ibau-logo-transparent.png" alt="Logo IBAU" width={28} height={28} />
          <div className="leading-tight">
            <div className="text-sm font-bold">Escola de Líderes</div>
            <div className="text-[11px] text-green-300 font-medium">IBAU</div>
          </div>
        </div>

        <div className="px-4 pt-2 pb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-green-200 uppercase tracking-wide">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
            Administrador
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href, link.exact)
                    ? 'bg-white/15 text-white'
                    : 'text-green-100/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-sm font-medium text-white truncate mb-2">{name}</p>
          <LogoutButton className="!text-green-100/70 hover:!text-white" />
        </div>
      </aside>
    </>
  )
}
