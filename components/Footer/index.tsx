import Link from 'next/link'
import Image from 'next/image'
import { Users } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-green-950 text-green-50 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <Image src="/ibau-logo-transparent.png" alt="Logo IBAU" width={32} height={32} />
              <span className="text-base font-bold">Escola de Líderes IBAU</span>
            </Link>
            <p className="text-green-200/80 text-sm leading-relaxed max-w-xs">
              Desenvolvendo líderes cristãos comprometidos com a visão de Deus.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-green-200/60 mb-4">
              Links rápidos
            </h3>
            <ul className="text-green-100/90 space-y-2.5 text-[15px]">
              <li><Link href="/" className="hover:text-white transition-colors">Início</Link></li>
              <li><Link href="/#sobre" className="hover:text-white transition-colors">Sobre</Link></li>
              <li><Link href="/auth/login" className="hover:text-white transition-colors">Portal do Aluno</Link></li>
              <li><Link href="/auth/login" className="hover:text-white transition-colors">Portal do Professor</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-green-200/60 mb-4">
              Contato
            </h3>
            <div className="flex items-start gap-3 text-[15px] text-green-100/90">
              <Users className="h-5 w-5 mt-0.5 shrink-0 text-green-300" strokeWidth={2} />
              <p>Ainda não tem acesso?<br />Fale com a liderança da sua célula.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-8 text-center text-green-200/60 text-sm">
          <p>© {new Date().getFullYear()} IBAU — Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
