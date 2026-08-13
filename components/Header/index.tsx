'use client'

import Link from 'next/link'

export default function Header() {
  return (
    <header className="bg-white shadow">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          Escola de Líderes
        </Link>
        
        <div className="flex gap-6 items-center">
          <Link href="/" className="text-gray-700 hover:text-blue-600">
            Início
          </Link>
          <a href="#sobre" className="text-gray-700 hover:text-blue-600">
            Sobre
          </a>
          <Link
            href="/auth/login"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Acessar
          </Link>
        </div>
      </nav>
    </header>
  )
}
