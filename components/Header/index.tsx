'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Início' },
  { href: '/#sobre', label: 'Sobre' },
  { href: '/#numeros', label: 'Números' },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm ring-1 ring-black/5'
          : 'bg-white/0'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/ibau-logo-transparent.png"
            alt="Logo IBAU"
            width={34}
            height={34}
            className="shrink-0"
          />
          <span className="text-lg font-bold tracking-tight text-gray-900">
            Escola de Líderes <span className="text-green-700">IBAU</span>
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex gap-8 items-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[15px] font-medium text-gray-600 hover:text-green-700 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/auth/login"
            className="bg-green-700 text-white px-5 py-2.5 rounded-xl text-[15px] font-semibold hover:bg-green-800 active:bg-green-900 transition-colors shadow-sm shadow-green-900/10"
          >
            Acessar Plataforma
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 bg-white ring-1 ring-black/5 ${
          menuOpen ? 'max-h-72' : 'max-h-0'
        }`}
      >
        <div className="px-4 py-4 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2.5 rounded-lg text-[15px] font-medium text-gray-700 hover:bg-gray-50"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/auth/login"
            onClick={() => setMenuOpen(false)}
            className="mt-2 bg-green-700 text-white text-center px-5 py-2.5 rounded-xl text-[15px] font-semibold hover:bg-green-800 transition-colors"
          >
            Acessar Plataforma
          </Link>
        </div>
      </div>
    </header>
  )
}
