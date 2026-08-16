'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Phone, Mail, GraduationCap, MessageSquare } from 'lucide-react'
import { aprovarInscricao, recusarInscricao } from '@/app/dashboard/admin/actions'
import { Alerta, Selo, CAMPO } from '@/components/ui'

export interface InscricaoItem {
  id: string
  nome: string
  email: string
  telefone: string | null
  papel: 'aluno' | 'professor'
  turma: string | null
  mensagem: string | null
  respostas?: Record<string, { pergunta: string; resposta: string }>
  status: 'pendente' | 'aprovada' | 'recusada'
  motivo: string | null
  created_at: string
}

function quando(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function InscricaoRow({ inscricao }: { inscricao: InscricaoItem }) {
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const agir = (fn: () => Promise<void>) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao decidir.')
      }
    })
  }

  const pendente = inscricao.status === 'pendente'

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-gray-900">{inscricao.nome}</p>
            <Selo tom={inscricao.papel === 'professor' ? 'roxo' : 'azul'}>
              {inscricao.papel === 'professor' ? 'Professor' : 'Aluno'}
            </Selo>
            {inscricao.status === 'aprovada' && (
              <Selo tom="verde" icone="Check">
                Aprovada
              </Selo>
            )}
            {inscricao.status === 'recusada' && <Selo tom="vermelho">Recusada</Selo>}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" strokeWidth={2} />
              {inscricao.email}
            </span>
            {inscricao.telefone && (
              <a
                href={`https://wa.me/55${inscricao.telefone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                {inscricao.telefone}
              </a>
            )}
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" strokeWidth={2} />
              {inscricao.turma ?? 'Sem turma escolhida'}
            </span>
            <span className="text-gray-400">inscrito em {quando(inscricao.created_at)}</span>
          </div>

          {inscricao.mensagem && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[12.5px] leading-relaxed text-gray-600">
              <MessageSquare className="mt-px h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={2} />
              {inscricao.mensagem}
            </p>
          )}

          {/* Respostas das perguntas que a liderança adicionou à ficha */}
          {inscricao.respostas && Object.keys(inscricao.respostas).length > 0 && (
            <dl className="mt-2 grid gap-x-5 gap-y-1 sm:grid-cols-2">
              {Object.entries(inscricao.respostas).map(([id, r]) => (
                <div key={id} className="text-[12.5px]">
                  <dt className="inline font-semibold text-gray-600">{r.pergunta}: </dt>
                  <dd className="inline text-gray-700">{r.resposta}</dd>
                </div>
              ))}
            </dl>
          )}

          {inscricao.motivo && (
            <p className="mt-2 text-[12px] text-red-700">Motivo: {inscricao.motivo}</p>
          )}
        </div>

        {pendente && !recusando && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => agir(() => aprovarInscricao(inscricao.id))}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
            >
              <Check className="h-[15px] w-[15px]" strokeWidth={2.4} />
              {isPending ? 'Aprovando...' : 'Aprovar'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setRecusando(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
            >
              <X className="h-[15px] w-[15px]" strokeWidth={2.4} />
              Recusar
            </button>
          </div>
        )}
      </div>

      {recusando && (
        <div className="mt-3 rounded-xl bg-red-50/70 p-3.5 ring-1 ring-red-200">
          <p className="mb-2 text-[12.5px] leading-relaxed text-red-900">
            Ao recusar, a conta de acesso criada por {inscricao.nome.split(' ')[0]} é apagada — o
            e-mail fica livre para uma nova inscrição no futuro.
          </p>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional, fica registrado)"
            className={`${CAMPO} mb-2`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => agir(() => recusarInscricao(inscricao.id, motivo))}
              className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? 'Recusando...' : 'Confirmar recusa'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setRecusando(false)}
              className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-semibold text-gray-600 hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2">
          <Alerta>{error}</Alerta>
        </div>
      )}
    </li>
  )
}
