import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react'
import LoginForm from '@/components/Auth/LoginForm'

export const metadata = {
  title: 'Entrar — Escola de Líderes IBAU',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-brand-50/50 via-white to-brand-50/30">
      {/* Brilhos decorativos de fundo */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-brand-200/25 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent-300/15 blur-3xl" />

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-brand-700 transition-colors mb-5"
          >
            <ArrowLeft
              className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
              strokeWidth={2.25}
            />
            Voltar para o início
          </Link>

          <div className="grid md:grid-cols-2 rounded-3xl overflow-hidden shadow-deep ring-1 ring-brand-900/5 bg-white animate-float-in">
            {/* ===== Lado da marca ===== */}
            <div className="relative hidden md:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 p-10">
              {/* Camadas de luz e textura */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.16),transparent_45%),radial-gradient(circle_at_80%_85%,rgba(0,0,0,0.25),transparent_55%)]" />
              <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -bottom-32 -left-8 h-96 w-96 rounded-full border border-white/[0.07]" />
              <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-accent-400/10 blur-3xl" />

              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-3.5 py-1.5 text-[12px] font-medium text-brand-50 ring-1 ring-white/20 mb-8">
                  <Sparkles className="h-3.5 w-3.5 text-accent-400" strokeWidth={2.25} />
                  Igreja Batista do Avivamento
                </span>

                <Image
                  src="/ibau-logo-transparent.png"
                  alt="Logo IBAU"
                  width={76}
                  height={76}
                  className="mb-7 drop-shadow-lg"
                  priority
                />

                <h1 className="text-[2rem] leading-tight font-bold text-white mb-4">
                  Escola de Líderes{' '}
                  <span className="bg-gradient-to-r from-white to-accent-300 bg-clip-text text-transparent">
                    IBAU
                  </span>
                </h1>
                <p className="text-brand-50/85 leading-relaxed max-w-xs">
                  Desenvolvendo líderes cristãos comprometidos com a visão de Deus.
                </p>
              </div>

              <div className="relative flex items-center gap-3 text-sm text-brand-50/85">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md ring-1 ring-white/20">
                  <ShieldCheck className="h-5 w-5 text-brand-200" strokeWidth={2} />
                </span>
                Ambiente seguro e exclusivo
                <br />
                para alunos e professores.
              </div>
            </div>

            {/* ===== Lado do formulário ===== */}
            <div className="p-7 sm:p-10 lg:p-12 flex flex-col justify-center">
              {/* Logo aparece aqui só no celular, onde o painel verde some */}
              <div className="md:hidden flex items-center gap-3 mb-7">
                <Image src="/ibau-logo-transparent.png" alt="Logo IBAU" width={40} height={40} />
                <span className="font-display font-bold text-gray-900 leading-tight">
                  Escola de Líderes
                  <span className="text-brand-600"> IBAU</span>
                </span>
              </div>

              <div className="mb-7">
                <h2 className="text-2xl font-bold text-gray-900 mb-1.5">Acesse sua conta</h2>
                <p className="text-gray-500 text-[15px]">
                  Escolha seu portal e entre com suas credenciais.
                </p>
              </div>

              <LoginForm />
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-7">
            © {new Date().getFullYear()} IBAU — Escola de Líderes
          </p>
        </div>
      </div>
    </div>
  )
}
