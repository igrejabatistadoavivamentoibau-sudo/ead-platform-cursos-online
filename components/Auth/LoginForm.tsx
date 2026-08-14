'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, GraduationCap, Presentation, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type UserRole = 'aluno' | 'professor' | 'admin'
type Portal = 'aluno' | 'professor'

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

const ROLE_LABEL: Record<UserRole, string> = {
  aluno: 'aluno',
  professor: 'professor',
  admin: 'administrador',
}

const DASHBOARD_BY_ROLE: Record<UserRole, string> = {
  aluno: '/dashboard/student',
  professor: '/dashboard/teacher',
  admin: '/dashboard/admin',
}

export default function LoginForm() {
  const [portal, setPortal] = useState<Portal>('aluno')
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

      const role = userData.role as UserRole

      // Administrador entra por qualquer aba — não faz sentido a checagem
      // de portal para quem gerencia a plataforma inteira.
      if (role !== 'admin') {
        const expectedPortal: Portal = role === 'aluno' ? 'aluno' : 'professor'

        // Confere se a pessoa entrou pela aba certa (aluno x professor)
        if (expectedPortal !== portal) {
          await supabase.auth.signOut()
          throw new Error(
            `Essa conta é de ${ROLE_LABEL[role]}. Use a aba "Portal do ${
              expectedPortal === 'aluno' ? 'Aluno' : 'Professor'
            }" para entrar.`
          )
        }
      }

      router.push(DASHBOARD_BY_ROLE[role])
      router.refresh()
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
      {/* Seletor de portal */}
      <div className="grid grid-cols-2 gap-1 p-1 mb-6 bg-gray-100 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setPortal('aluno')
            setError(null)
          }}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg py-2.5 text-[13px] sm:text-sm font-semibold whitespace-nowrap transition-all ${
            portal === 'aluno'
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <GraduationCap className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          <span><span className="hidden sm:inline">Portal do </span>Aluno</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setPortal('professor')
            setError(null)
          }}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg py-2.5 text-[13px] sm:text-sm font-semibold whitespace-nowrap transition-all ${
            portal === 'professor'
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Presentation className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          <span><span className="hidden sm:inline">Portal do </span>Professor</span>
        </button>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            E-mail
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400">
              <Mail className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-colors disabled:opacity-50"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Senha
            </label>
            <Link href="#" className="text-sm text-brand-700 hover:text-brand-800 font-medium">
              Esqueceu sua senha?
            </Link>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400">
              <Lock className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              disabled={isLoading}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-colors disabled:opacity-50"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} />
              ) : (
                <Eye className="h-[18px] w-[18px]" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm leading-snug">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-brand-700 text-white py-2.5 rounded-xl font-semibold hover:bg-brand-800 active:bg-brand-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-brand-900/10"
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
        className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-xl py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <GoogleIcon />
        {isGoogleLoading ? 'Redirecionando...' : 'Entrar com Google'}
      </button>

      <div className="mt-6 flex items-start gap-3 bg-gray-50 rounded-xl p-4 ring-1 ring-gray-100">
        <span className="mt-0.5 text-brand-700 shrink-0">
          <Users className="h-5 w-5" strokeWidth={2} />
        </span>
        <p className="text-sm text-gray-600 leading-snug">
          <span className="font-semibold text-gray-800">Ainda não tem acesso?</span>
          <br />
          Fale com a liderança da sua célula.
        </p>
      </div>
    </div>
  )
}
