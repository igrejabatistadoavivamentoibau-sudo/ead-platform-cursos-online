'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { criarUsuario } from '@/app/dashboard/admin/actions'

const ROLE_OPTIONS = [
  { value: 'aluno', label: 'Aluno' },
  { value: 'professor', label: 'Professor' },
  { value: 'admin', label: 'Administrador' },
] as const

function gerarSenha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let senha = ''
  for (let i = 0; i < 10; i++) senha += chars[Math.floor(Math.random() * chars.length)]
  return senha
}

export default function CriarUsuarioForm() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'aluno' | 'professor' | 'admin'>('aluno')
  const [password, setPassword] = useState(gerarSenha)
  const [error, setError] = useState<string | null>(null)
  const [criado, setCriado] = useState<{ email: string; password: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await criarUsuario({ name, email, password, role })
        setCriado({ email, password })
        setName('')
        setEmail('')
        setPassword(gerarSenha())
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao criar usuário.')
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setCriado(null)
        }}
        className="inline-flex items-center gap-2 bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors shadow-sm"
      >
        <UserPlus className="h-4 w-4" strokeWidth={2.5} />
        Criar usuário
      </button>
    )
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5 sm:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Nova conta</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {criado ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 mb-2">Conta criada com sucesso!</p>
          <p className="text-sm text-green-700">
            Anote e repasse essas credenciais para a pessoa — a senha não fica salva em nenhum
            outro lugar:
          </p>
          <div className="mt-2 bg-white rounded-lg p-3 font-mono text-sm text-gray-700 space-y-1">
            <p>E-mail: {criado.email}</p>
            <p>Senha: {criado.password}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 text-sm font-semibold text-green-700 hover:text-green-800"
          >
            Fechar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Papel</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500 bg-white"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha inicial</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl text-[15px] font-mono focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
                />
                <button
                  type="button"
                  onClick={() => setPassword(gerarSenha())}
                  className="px-3 py-2.5 rounded-xl text-xs font-semibold text-green-700 hover:bg-green-50 ring-1 ring-green-200 whitespace-nowrap"
                >
                  Gerar nova
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Criando...' : 'Criar conta'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
