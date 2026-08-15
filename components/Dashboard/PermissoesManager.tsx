'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Check, AlertCircle, RotateCcw, Search } from 'lucide-react'
import { atualizarPermissoes } from '@/app/dashboard/admin/actions'
import {
  CHAVES_PERMISSAO,
  ROTULO_PERMISSAO,
  permissoesPadrao,
  resolverPermissoes,
  type ChavePermissao,
  type Permissoes,
  type UserRole,
} from '@/lib/permissoes'

export interface UsuarioPermissao {
  id: string
  name: string
  email: string
  role: UserRole
  permissoes: Partial<Permissoes> | null
}

const ROLE_LABEL: Record<UserRole, string> = {
  aluno: 'Aluno',
  professor: 'Professor',
  admin: 'Administrador',
}

const ROLE_STYLE: Record<UserRole, string> = {
  aluno: 'bg-sky-50 text-sky-700 ring-sky-200',
  professor: 'bg-purple-50 text-purple-700 ring-purple-200',
  admin: 'bg-brand-50 text-brand-700 ring-brand-200',
}

export default function PermissoesManager({ usuarios }: { usuarios: UsuarioPermissao[] }) {
  const [busca, setBusca] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Só faz sentido personalizar quem não é admin (admin tem acesso total
  // por definição) e quem não é aluno (aluno não acessa área de gestão).
  const gerenciaveis = usuarios.filter((u) => u.role === 'professor')
  const filtrados = gerenciaveis.filter(
    (u) =>
      u.name.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase())
  )

  const alternar = (usuario: UsuarioPermissao, chave: ChavePermissao, atual: Permissoes) => {
    setError(null)
    const novas: Partial<Permissoes> = { ...atual, [chave]: !atual[chave] }

    startTransition(async () => {
      try {
        await atualizarPermissoes(usuario.id, novas)
        setSalvoEm(usuario.id)
        setTimeout(() => setSalvoEm(null), 2000)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar permissões.')
      }
    })
  }

  const restaurarPadrao = (usuario: UsuarioPermissao) => {
    setError(null)
    startTransition(async () => {
      try {
        await atualizarPermissoes(usuario.id, permissoesPadrao(usuario.role))
        setSalvoEm(usuario.id)
        setTimeout(() => setSalvoEm(null), 2000)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao restaurar padrão.')
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Nota explicativa sobre os administradores */}
      <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-brand-50/80 to-gray-50 ring-1 ring-brand-100 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-soft">
          <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.25} />
        </span>
        <p className="text-sm text-gray-600 leading-relaxed">
          <span className="font-semibold text-gray-800">Administradores têm acesso total</span> e
          por isso não aparecem nesta lista — se fosse possível limitá-los, alguém poderia se
          trancar para fora do sistema. Alunos também não aparecem: eles só acessam o portal do
          aluno. Aqui você ajusta o que cada <strong>professor</strong> pode ver e editar.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          <AlertCircle className="h-[18px] w-[18px] shrink-0 mt-px" strokeWidth={2.25} />
          {error}
        </div>
      )}

      {gerenciaveis.length > 3 && (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">
            <Search className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar professor por nome ou e-mail"
            className="w-full pl-11 pr-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-[15px] transition-all focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500"
          />
        </div>
      )}

      {filtrados.length > 0 ? (
        <div className="space-y-4">
          {filtrados.map((usuario) => {
            const efetivas = resolverPermissoes(usuario.role, usuario.permissoes)
            const salvo = salvoEm === usuario.id

            return (
              <div key={usuario.id} className="card-alive p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-bold text-gray-900">{usuario.name}</h3>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${ROLE_STYLE[usuario.role]}`}
                      >
                        {ROLE_LABEL[usuario.role]}
                      </span>
                      {salvo && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 animate-float-in">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                          salvo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{usuario.email}</p>
                  </div>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => restaurarPadrao(usuario)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-brand-700 px-2.5 py-1.5 rounded-lg hover:bg-brand-50 transition-colors disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Restaurar padrão
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-2.5">
                  {CHAVES_PERMISSAO.map((chave) => {
                    const ligado = efetivas[chave]
                    const sensivel = chave === 'gerenciar_usuarios'

                    return (
                      <button
                        key={chave}
                        type="button"
                        role="switch"
                        aria-checked={ligado}
                        disabled={isPending}
                        onClick={() => alternar(usuario, chave, efetivas)}
                        className={`group flex items-start gap-3 rounded-xl p-3.5 text-left transition-all duration-200 ring-1 disabled:opacity-60 ${
                          ligado
                            ? 'bg-brand-50/70 ring-brand-200 hover:ring-brand-300'
                            : 'bg-gray-50/70 ring-gray-200 hover:ring-gray-300'
                        }`}
                      >
                        {/* Chave liga/desliga */}
                        <span
                          className={`mt-0.5 relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-300 ${
                            ligado ? 'bg-brand-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`absolute h-4 w-4 rounded-full bg-white shadow-soft transition-transform duration-300 ${
                              ligado ? 'translate-x-[1.15rem]' : 'translate-x-0.5'
                            }`}
                          />
                        </span>

                        <span className="min-w-0">
                          <span
                            className={`block text-sm font-semibold ${
                              ligado ? 'text-brand-900' : 'text-gray-700'
                            }`}
                          >
                            {ROTULO_PERMISSAO[chave].titulo}
                            {sensivel && ligado && (
                              <span className="ml-1.5 text-[10px] font-bold text-amber-600 uppercase tracking-wide">
                                sensível
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-gray-500 mt-0.5 leading-snug">
                            {ROTULO_PERMISSAO[chave].descricao}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card-alive p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <ShieldCheck className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="text-gray-700 font-medium">
            {gerenciaveis.length === 0
              ? 'Nenhum professor cadastrado ainda.'
              : 'Nenhum professor encontrado com esse termo.'}
          </p>
          {gerenciaveis.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Crie contas de professor na aba Usuários para ajustar permissões aqui.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
