import Link from 'next/link'
import LoginForm from '@/components/Auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Escola de Líderes</h1>
          <p className="text-blue-100">Igreja Batista da Avivamento - IBAU</p>
        </div>

        {/* Card de Login */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Acesso à Plataforma</h2>

          <LoginForm />

          {/* Links */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-gray-600 text-sm">
              Problemas para acessar?{' '}
              <Link href="#" className="text-blue-600 hover:text-blue-700 font-semibold">
                Contate um administrador
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-blue-100 text-sm">
          <p>© 2026 Escola de Líderes IBAU. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  )
}
