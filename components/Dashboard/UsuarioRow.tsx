'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Check, X, GraduationCap, Copy } from 'lucide-react'
import { trocarSenha, atualizarPapel } from '@/app/dashboard/admin/actions'
import { Selecao } from '@/components/ui'

const ROLE_LABEL: Record<string, string> = {
  aluno: 'Aluno',
  professor: 'Professor',
  admin: 'Administrador',
}

const ROLE_STYLE: Record<string, string> = {
  aluno: 'bg-blue-50 text-blue-700 ring-blue-200',
  professor: 'bg-purple-50 text-purple-700 ring-purple-200',
  admin: 'bg-brand-50 text-brand-700 ring-brand-200',
}

function gerarSenha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let senha = ''
  for (let i = 0; i < 10; i++) senha += chars[Math.floor(Math.random() * chars.length)]
  return senha
}

export default function UsuarioRow({
  id,
  name,
  email,
  role,
  turmas = [],
}: {
  id: string
  name: string
  email: string
  role: 'aluno' | 'professor' | 'admin'
  turmas?: string[]
}) {
  const [trocando, setTrocando] = useState(false)
  const [novaSenha, setNovaSenha] = useState(gerarSenha)
  const [resultado, setResultado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleTrocarSenha = () => {
    setError(null)
    startTransition(async () => {
      try {
        await trocarSenha(id, novaSenha)
        setResultado(novaSenha)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao trocar senha.')
      }
    })
  }

  const handleMudarPapel = (novoPapel: string) => {
    setError(null)
    startTransition(async () => {
      try {
        await atualizarPapel(id, novoPapel as 'aluno' | 'professor' | 'admin')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar papel.')
      }
    })
  }

  return (
    <li className="py-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">{name}</p>
          <p className="text-xs text-gray-500">{email}</p>

          {/* Onde a pessoa está. Antes o painel dizia só nome e papel, e
              descobrir isso exigia abrir turma por turma. */}
          {turmas.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {turmas.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-brand-200"
                >
                  <GraduationCap className="h-3 w-3" strokeWidth={2} />
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-amber-700">Sem turma ainda</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="w-[150px]">
            <Selecao
              valorInicial={role}
              aoMudar={handleMudarPapel}
              disabled={isPending}
              opcoes={Object.entries(ROLE_LABEL).map(([valor, rotulo]) => ({ valor, rotulo }))}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setTrocando((v) => !v)
              setResultado(null)
              setError(null)
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-brand-700 px-2.5 py-1.5 rounded-full hover:bg-brand-50"
          >
            <KeyRound className="h-3.5 w-3.5" strokeWidth={2.25} />
            Trocar senha
          </button>
        </div>
      </div>

      {trocando && (
        <div className="mt-3 bg-gray-50 rounded-xl p-3.5">
          {resultado ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />
                <span className="text-gray-700">Nova senha de {name.split(' ')[0]}:</span>
                <span className="rounded-md bg-white px-2 py-1 font-mono text-[13px] font-bold text-gray-900 ring-1 ring-gray-200">
                  {resultado}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(resultado)
                    setCopiado(true)
                    setTimeout(() => setCopiado(false), 2000)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-gray-600 transition-colors hover:bg-white hover:text-brand-700"
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                  {copiado ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              {/* Aviso necessário: depois que esta caixa fecha, a senha some
                  para sempre. O banco guarda só um resumo irreversível dela —
                  por isso o painel oferece redefinir, e nunca "ver a senha". */}
              <p className="text-[11.5px] leading-relaxed text-amber-700">
                Copie agora: esta senha não aparece de novo. Ninguém consegue consultá-la depois —
                se perder, é só redefinir outra aqui.
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setNovaSenha(gerarSenha())}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 ring-1 ring-gray-200 whitespace-nowrap"
              >
                Gerar nova
              </button>
              <button
                type="button"
                onClick={handleTrocarSenha}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50 whitespace-nowrap"
              >
                {isPending ? 'Salvando...' : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={() => setTrocando(false)}
                className="px-2 py-2 rounded-lg text-gray-400 hover:text-gray-600"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      )}
    </li>
  )
}
