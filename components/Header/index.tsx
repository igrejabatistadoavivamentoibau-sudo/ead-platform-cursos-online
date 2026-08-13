'use client'

import Link from 'next/link'

export default function Header() {
  return (
    <header className="bg-white shadow">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          EAD Cursos
        </Link>
        
        <div className="flex gap-6">
          <Link href="/" className="text-gray-700 hover:text-blue-600">
            Início
          </Link>
          <Link href="/courses" className="text-gray-700 hover:text-blue-600">
            Cursos
          </Link>
          <Link href="/auth/login" className="text-gray-700 hover:text-blue-600">
            Login
          </Link>
        </div>
      </nav>
    </header>
  )
}
