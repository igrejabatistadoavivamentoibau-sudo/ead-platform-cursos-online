'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type UserRole = 'student' | 'teacher' | 'director'

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="m4 8 8 5 8-5" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

function EyeIcon({ visible }: { visible: boolean }) {
  if (!visible) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.4 9.4 0 0 1 12 4c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.15M6.6 6.6C3.5 8.5 2 11 2 11s3.5 7 10 7a9.6 9.6 0 0 0 5-1.4" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <path d="M2 2l20 20" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.61l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  )
}

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Login com Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      if (!data.user) throw new Error('Usuário não encontrado')

      // Buscar informações do usuário (role)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, name')
        .eq('id', data.user.id)
        .single()

      if (userError) throw userError

      // Redirecionar baseado no role
      const role = userData.role as UserRole
      if (role === 'student') {
        router.push('/dashboard/student')
      } else if (role === 'teacher' || role === 'director') {
        router.push('/dashboard/teacher')
      } else {
        throw new Error('Role de usuário inválido')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError(null)
    setIsGoogleLoading(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (oauthError) throw oauthError
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao entrar com Google'
      setError(errorMessage)
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            E-mail
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <MailIcon />
            </span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Senha
            </label>
            <Link href="#" className="text-sm text-green-600 hover:text-green-700 font-medium">
              Esqueceu sua senha?
            </Link>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <LockIcon />
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              disabled={isLoading}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              <EyeIcon visible={showPassword} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400 whitespace-nowrap">ou continue com</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isGoogleLoading}
        className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
      >
        <GoogleIcon />
        {isGoogleLoading ? 'Redirecionando...' : 'Entrar com Google'}
      </button>

      <div className="mt-6 flex items-start gap-3 bg-gray-50 rounded-xl p-4">
        <span className="mt-0.5 text-green-600 shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">Ainda não tem acesso?</span>
          <br />
          Fale com a liderança da sua célula.
        </p>
      </div>
    </div>
  )
}
