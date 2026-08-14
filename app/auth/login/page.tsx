import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import LoginForm from '@/components/Auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Blobs decorativos de fundo */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-green-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-green-50 blur-3xl" />

      {/* Voltar para o início */}
      <div className="relative w-full max-w-4xl mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-green-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          Voltar para o início
        </Link>
      </div>

      <div className="relative w-full max-w-4xl bg-white rounded-[28px] shadow-[0_20px_60px_-15px_rgba(15,60,35,0.25)] ring-1 ring-black/5 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Painel esquerdo - identidade visual IBAU */}
        <div className="relative bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 text-white p-10 flex flex-col justify-between overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(255,255,255,0.14),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(0,0,0,0.18),transparent_50%)]" />
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-6 -bottom-28 h-64 w-64 rounded-full border border-white/10" />

          <div className="relative">
            <Image
              src="/ibau-logo-transparent.png"
              alt="Logo IBAU"
              width={128}
              height={128}
              className="mb-8 drop-shadow-sm"
              priority
            />
            <h1 className="text-[2rem] font-bold leading-tight mb-4 tracking-tight">
              Escola de Líderes IBAU
            </h1>
            <p className="text-green-50/90 text-base leading-relaxed max-w-xs">
              Desenvolvendo líderes cristãos comprometidos com a visão de Deus.
            </p>
          </div>

          <div className="relative flex items-center gap-3 text-sm text-green-50/90">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
              <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </span>
            <span>Ambiente seguro e exclusivo para alunos</span>
          </div>
        </div>

        {/* Painel direito - formulário */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-1.5 tracking-tight">Acesse sua conta</h2>
          <p className="text-gray-500 mb-7 text-[15px]">
            Entre com suas credenciais para acessar a plataforma.
          </p>

          <LoginForm />
        </div>
      </div>

      <p className="relative mt-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} IBAU — Todos os direitos reservados.
        <br />
        <span className="text-green-700 font-medium">Escola de Líderes IBAU</span>
      </p>
    </div>
  )
}
