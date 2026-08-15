import Link from 'next/link'
import Image from 'next/image'
import { Users } from 'lucide-react'

const linksRapidos = [
  { href: '/', label: 'Início' },
  { href: '/#sobre', label: 'Sobre' },
  { href: '/auth/login', label: 'Portal do Aluno' },
  { href: '/auth/login', label: 'Portal do Professor' },
]

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-brand-950 text-brand-50">
      {/* Linha de luz no topo do rodapé */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/50 to-transparent" />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 h-64 w-64 rounded-full bg-brand-600/10 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <Link href="/" className="group flex items-center gap-2.5 mb-4">
              <Image
                src="/ibau-marca-clara.png"
                alt="Logo IBAU"
                width={32}
                height={32}
                className="transition-transform duration-500 group-hover:scale-110"
              />
              <span className="font-display text-base font-bold">Escola de Líderes IBAU</span>
            </Link>
            <p className="text-brand-200/80 text-sm leading-relaxed max-w-xs">
              Desenvolvendo líderes cristãos comprometidos com a visão de Deus.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-300/70 mb-4">
              Links rápidos
            </h3>
            <ul className="text-brand-100/90 space-y-2.5 text-[15px]">
              {linksRapidos.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="inline-block transition-all duration-300 hover:text-white hover:translate-x-1"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-brand-300/70 mb-4">
              Contato
            </h3>
            <div className="flex items-start gap-3 text-[15px] text-brand-100/90">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-300">
                <Users className="h-4.5 w-4.5" strokeWidth={2} />
              </span>
              <p>
                Ainda não tem acesso?
                <br />
                Fale com a liderança da sua célula.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-8 text-center text-brand-300/60 text-sm">
          <p>© {new Date().getFullYear()} IBAU — Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
