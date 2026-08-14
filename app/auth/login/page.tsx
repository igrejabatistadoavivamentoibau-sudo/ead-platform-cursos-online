import Image from 'next/image'
import LoginForm from '@/components/Auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Blobs decorativos de fundo */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-green-100 blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-green-50 blur-3xl opacity-70" />

      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Painel esquerdo - identidade visual IBAU */}
        <div className="relative bg-gradient-to-br from-green-600 to-green-500 text-white p-10 flex flex-col justify-between overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%),radial-gradient(circle_at_80%_75%,rgba(0,0,0,0.15),transparent_50%)]" />

          <div className="relative">
            <Image
              src="/ibau-logo-transparent.png"
              alt="Logo IBAU"
              width={140}
              height={140}
              className="mb-8"
              priority
            />
            <h1 className="text-3xl font-bold leading-tight mb-4">
              Escola de Líderes IBAU
            </h1>
            <p className="text-green-50/90 text-base leading-relaxed max-w-xs">
              Desenvolvendo líderes cristãos comprometidos com a visão de Deus.
            </p>
          </div>

          <div className="relative flex items-center gap-3 text-sm text-green-50/90">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <span>Ambiente seguro e exclusivo para alunos</span>
          </div>
        </div>

        {/* Painel direito - formulário */}
        <div className="p-10 flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesse sua conta</h2>
          <p className="text-gray-500 mb-8">
            Entre com suas credenciais para acessar a plataforma.
          </p>

          <LoginForm />
        </div>
      </div>

      <p className="relative mt-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} IBAU - Todos os direitos reservados.
        <br />
        <span className="text-green-600 font-medium">Escola de Líderes IBAU</span>
      </p>
    </div>
  )
}
