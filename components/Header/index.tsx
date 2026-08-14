'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, ArrowRight } from 'lucide-react'

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
    /* Fixo (fora do fluxo) para o banner do topo ocupar a tela inteira e o
       cabeçalho flutuar por cima dele. Se fosse "sticky", ele reservaria
       uma faixa branca acima do banner — e o texto branco do logo sumiria. */
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/85 backdrop-blur-xl shadow-card ring-1 ring-brand-900/5'
          : 'bg-gradient-to-b from-brand-950/50 to-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        <Link href="/" className="group flex items-center gap-2.5">
          <Image
            src="/ibau-logo-transparent.png"
            alt="Logo IBAU"
            width={34}
            height={34}
            className="shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
          />
          <span
            className={`font-display text-lg font-bold tracking-tight transition-colors duration-500 ${
              scrolled ? 'text-gray-900' : 'text-white'
            }`}
          >
            Escola de Líderes{' '}
            <span className={scrolled ? 'text-brand-600' : 'text-brand-300'}>IBAU</span>
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex gap-8 items-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative text-[15px] font-medium transition-colors duration-300 after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-brand-500 after:transition-transform after:duration-300 hover:after:scale-x-100 ${
                scrolled ? 'text-gray-600 hover:text-brand-700' : 'text-white/85 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/auth/login"
            className="group inline-flex items-center gap-1.5 bg-brand-600 text-white px-5 py-2.5 rounded-xl text-[15px] font-semibold hover:bg-brand-700 active:scale-[0.97] transition-all duration-300 shadow-glow"
          >
            Acessar Plataforma
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
              strokeWidth={2.25}
            />
          </Link>
        </div>

        {/* Botão mobile */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={`md:hidden flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
            scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'
          }`}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Menu mobile */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-500 ease-out bg-white/95 backdrop-blur-xl ring-1 ring-brand-900/5 ${
          menuOpen ? 'max-h-80' : 'max-h-0'
        }`}
      >
        <div className="px-4 py-4 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl text-[15px] font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-800 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/auth/login"
            onClick={() => setMenuOpen(false)}
            className="mt-2 bg-brand-600 text-white text-center px-5 py-3 rounded-xl text-[15px] font-semibold hover:bg-brand-700 transition-colors shadow-glow"
          >
            Acessar Plataforma
          </Link>
        </div>
      </div>
    </header>
  )
}
