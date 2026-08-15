'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  Presentation,
  Users,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type UserRole = 'aluno' | 'professor' | 'admin'
type Portal = 'aluno' | 'professor'

const ROLE_LABEL: Record<UserRole, string> = {
  aluno: 'aluno',
  professor: 'professor',
  admin: 'administrador',
}

const DASHBOARD_POR_PAPEL: Record<UserRole, string> = {
  aluno: '/dashboard/aluno',
  professor: '/dashboard/professor',
  admin: '/dashboard/admin',
}

/**
 * Por qual portal cada papel entra. O administrador usa o portal do
 * professor — ele leciona e gerencia, mas não é aluno da escola. Isso
 * mantém a separação clara: quem entra pelo portal do aluno é aluno.
 */
const PORTAL_POR_PAPEL: Record<UserRole, Portal> = {
  aluno: 'aluno',
  professor: 'professor',
  admin: 'professor',
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.61l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  )
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
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        throw new Error(
          authError.message === 'Invalid login credentials'
            ? 'E-mail ou senha incorretos. Confira e tente de novo.'
            : authError.message
        )
      }
      if (!data.user) throw new Error('Não foi possível entrar. Tente novamente.')

      // O papel vem dentro do próprio token, gravado pelo banco. Antes
      // fazíamos uma segunda consulta ao banco aqui só para descobrir isso —
      // era uma ida e volta extra em toda tentativa de login.
      const role = data.user.app_metadata?.role as UserRole | undefined

      if (!role) {
        await supabase.auth.signOut()
        throw new Error('Sua conta ainda não foi liberada. Fale com a administração.')
      }

      // Cada conta tem UM portal de entrada. O administrador entra pelo
      // portal do professor (ele leciona e gerencia), nunca pelo do aluno —
      // administrador não é aluno da escola.
      const portalEsperado = PORTAL_POR_PAPEL[role]

      if (portalEsperado !== portal) {
        await supabase.auth.signOut()
        throw new Error(
          `Esta conta é de ${ROLE_LABEL[role]}. Entre pelo "Portal do ${
            portalEsperado === 'aluno' ? 'Aluno' : 'Professor'
          }".`
        )
      }

      router.push(DASHBOARD_POR_PAPEL[role])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError(null)
    setIsGoogleLoading(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (oauthError) throw oauthError
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar com Google')
      setIsGoogleLoading(false)
    }
  }

  const abas = [
    {
      valor: 'aluno' as Portal,
      rotulo: 'Aluno',
      icone: GraduationCap,
      descricao: 'Para quem estuda: assista às aulas e acompanhe seu avanço.',
      texto: 'text-sky-700',
      pastilha: 'bg-sky-50 ring-1 ring-sky-200',
      // Gradiente fechado, dentro do mesmo tom. O ciano claro da versão
      // anterior brigava com o verde da marca e dava ar de template pronto:
      // dois tons vizinhos do mesmo azul criam profundidade sem virar o
      // assunto principal da tela.
      faixa: 'from-sky-800 to-sky-600',
      aviso: 'bg-sky-50/70 ring-sky-200 text-sky-900',
      iconeCor: 'text-sky-600',
    },
    {
      valor: 'professor' as Portal,
      rotulo: 'Professor',
      icone: Presentation,
      descricao: 'Para quem ensina e coordena: turmas, chamada e vídeo aulas.',
      texto: 'text-violet-700',
      pastilha: 'bg-violet-50 ring-1 ring-violet-200',
      faixa: 'from-violet-800 to-violet-600',
      aviso: 'bg-violet-50/70 ring-violet-200 text-violet-900',
      iconeCor: 'text-violet-600',
    },
  ]

  const abaAtiva = abas.find((a) => a.valor === portal)!

  return (
    <div className="w-full">
      {/* ===== Seletor de portal =====
          Cada portal tem cor própria (azul para aluno, roxo para professor),
          as mesmas usadas dentro do sistema. Assim a pessoa reconhece de
          relance em qual área está entrando. */}
      <div className="mb-3">
        <span className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Entrar como
        </span>

        <div className="relative grid grid-cols-2 gap-1 p-1 bg-gray-100/80 rounded-2xl">
          {/* Pastilha que desliza entre as abas */}
          <span
            className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-xl shadow-card transition-all duration-300 ease-out ${abaAtiva.pastilha}`}
            style={{
              transform: portal === 'aluno' ? 'translateX(0)' : 'translateX(calc(100% + 0.25rem))',
            }}
            aria-hidden="true"
          />
          {abas.map((aba) => {
            const ativo = portal === aba.valor
            return (
              <button
                key={aba.valor}
                type="button"
                onClick={() => {
                  setPortal(aba.valor)
                  setError(null)
                }}
                aria-pressed={ativo}
                className={`relative z-10 flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] sm:text-sm font-bold whitespace-nowrap transition-colors duration-300 ${
                  ativo ? aba.texto : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <aba.icone
                  className={`h-4 w-4 shrink-0 ${ativo ? aba.iconeCor : ''}`}
                  strokeWidth={2.25}
                />
                <span>
                  <span className="hidden sm:inline">Portal do </span>
                  {aba.rotulo}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Explicação do portal escolhido — evita a pessoa entrar pela aba errada */}
      <div
        key={portal}
        className={`flex items-start gap-2.5 rounded-xl ring-1 px-3.5 py-2.5 mb-6 text-[13px] leading-snug animate-float-in ${abaAtiva.aviso}`}
      >
        <abaAtiva.icone className="h-4 w-4 shrink-0 mt-px" strokeWidth={2.25} />
        <span>{abaAtiva.descricao}</span>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
            E-mail
          </label>
          <div className="group relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400 transition-colors group-focus-within:text-brand-600">
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
              className="w-full pl-11 pr-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-[15px] transition-all duration-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 disabled:opacity-50"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
              Senha
            </label>
            <Link
              href="#"
              className="text-sm text-brand-700 hover:text-brand-800 font-medium transition-colors"
            >
              Esqueceu sua senha?
            </Link>
          </div>
          <div className="group relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400 transition-colors group-focus-within:text-brand-600">
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
              className="w-full pl-11 pr-11 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-[15px] transition-all duration-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 disabled:opacity-50"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-brand-600 transition-colors"
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
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm leading-snug animate-float-in"
          >
            <AlertCircle className="h-[18px] w-[18px] shrink-0 mt-px" strokeWidth={2.25} />
            <span>{error}</span>
          </div>
        )}

        {/* O botão assume a cor do portal escolhido — mais um reforço visual
            de que aluno e professor são entradas diferentes. */}
        <button
          type="submit"
          disabled={isLoading}
          className={`group w-full flex items-center justify-center gap-2 bg-gradient-to-br text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-float active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100 shadow-card ${abaAtiva.faixa}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.25} />
              Entrando...
            </>
          ) : (
            <>
              Entrar como {abaAtiva.rotulo}
              <ArrowRight
                className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2.25}
              />
            </>
          )}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200" />
        <span className="text-xs text-gray-400 whitespace-nowrap font-medium">ou continue com</span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200" />
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isGoogleLoading}
        className="w-full flex items-center justify-center gap-2.5 border border-gray-200 rounded-xl py-3 font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.99] disabled:opacity-50"
      >
        {isGoogleLoading ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin text-gray-400" strokeWidth={2.25} />
        ) : (
          <GoogleIcon />
        )}
        {isGoogleLoading ? 'Redirecionando...' : 'Entrar com Google'}
      </button>

      <div className="mt-7 flex items-start gap-3 bg-gradient-to-br from-brand-50/80 to-gray-50 rounded-xl p-4 ring-1 ring-brand-100">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-soft">
          <Users className="h-4 w-4" strokeWidth={2.25} />
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
