'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { enviarInscricao } from '@/app/inscricao/actions'
import { Botao, Alerta, CAMPO, Campo } from '@/components/ui'
import CamposPersonalizados from '@/components/Inscricao/CamposPersonalizados'
import type { CampoInscricao } from '@/lib/campos'

export interface TurmaAberta {
  id: string
  nome: string
  curso: string | null
  modalidade: string
  valor: number | null
}

export default function FormInscricao({
  papel,
  turmas,
  campos = [],
}: {
  papel: 'aluno' | 'professor'
  turmas: TurmaAberta[]
  campos?: CampoInscricao[]
}) {
  const [enviada, setEnviada] = useState(false)
  const [verSenha, setVerSenha] = useState(false)
  const [turmaId, setTurmaId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const f = new FormData(e.currentTarget)

    // As perguntas criadas pela liderança chegam como "campo:<id>".
    const respostas: Record<string, string> = {}
    for (const [chave, valor] of f.entries()) {
      if (chave.startsWith('campo:') && typeof valor === 'string' && valor.trim()) {
        respostas[chave.slice(6)] = valor.trim()
      }
    }

    startTransition(async () => {
      try {
        await enviarInscricao({
          respostas,
          nome: f.get('nome') as string,
          email: f.get('email') as string,
          telefone: (f.get('telefone') as string) || undefined,
          senha: f.get('senha') as string,
          papel,
          turmaId: turmaId || undefined,
          mensagem: (f.get('mensagem') as string) || undefined,
        })
        setEnviada(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não consegui enviar sua inscrição.')
      }
    })
  }

  if (enviada) {
    return (
      <div className="rounded-2xl bg-white p-7 text-center ring-1 ring-brand-950/[0.07]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <CheckCircle2 className="h-7 w-7" strokeWidth={1.9} />
        </div>
        <h2 className="font-display text-[18px] font-bold text-gray-900">Inscrição enviada!</h2>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-gray-500">
          A liderança vai analisar seu cadastro. Assim que for aprovado, você entra na plataforma
          com o e-mail e a senha que acabou de escolher — não precisa cadastrar de novo.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-brand-700 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800"
        >
          Voltar ao início
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="rounded-2xl bg-white p-6 ring-1 ring-brand-950/[0.07]">
      <div className="space-y-4">
        <Campo label="Nome completo">
          <input name="nome" type="text" required placeholder="Como você quer ser chamado" className={CAMPO} />
        </Campo>

        <Campo label="E-mail" dica="Será o seu login na plataforma.">
          <input name="email" type="email" required placeholder="seu@email.com" className={CAMPO} />
        </Campo>

        <Campo label="WhatsApp (opcional)">
          <input name="telefone" type="tel" placeholder="(00) 00000-0000" className={CAMPO} />
        </Campo>

        <Campo label="Crie sua senha" dica="Mínimo de 6 caracteres. Só você conhece esta senha.">
          <div className="relative">
            <input
              name="senha"
              type={verSenha ? 'text' : 'password'}
              required
              minLength={6}
              placeholder="Escolha uma senha"
              className={`${CAMPO} pr-11`}
            />
            <button
              type="button"
              onClick={() => setVerSenha((v) => !v)}
              aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Campo>

        {papel === 'aluno' && turmas.length > 0 && (
          <Campo label="Qual turma você quer cursar?">
            <div className="space-y-2">
              {turmas.map((t) => {
                const ativa = turmaId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTurmaId(ativa ? '' : t.id)}
                    aria-pressed={ativa}
                    className={`flex w-full items-start gap-3 rounded-xl p-3.5 text-left ring-1 transition-all ${
                      ativa ? 'bg-brand-50/70 ring-brand-300' : 'bg-gray-50/60 ring-gray-200 hover:ring-gray-300'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-2 ${
                        ativa ? 'bg-brand-600 ring-brand-600' : 'bg-white ring-gray-300'
                      }`}
                    >
                      {ativa && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-bold text-gray-900">{t.nome}</span>
                      <span className="mt-0.5 block text-[12px] text-gray-500">
                        {t.curso ?? 'Curso a definir'} · {t.modalidade === 'presencial' ? 'Presencial' : 'EAD'}
                        {t.valor ? ` · R$ ${Number(t.valor).toFixed(2).replace('.', ',')}` : ''}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Campo>
        )}

        {papel === 'aluno' && turmas.length === 0 && (
          <Alerta tom="info">
            Nenhuma turma está com inscrição aberta no momento. Você pode se inscrever mesmo assim —
            a liderança entra em contato quando abrir a próxima.
          </Alerta>
        )}

        <CamposPersonalizados campos={campos} />

        <Campo label={papel === 'professor' ? 'Conte sobre sua experiência' : 'Quer dizer algo? (opcional)'}>
          <textarea
            name="mensagem"
            rows={3}
            placeholder={
              papel === 'professor'
                ? 'Onde você já ensinou, qual área tem mais afinidade...'
                : 'Alguma informação que ajude a liderança'
            }
            className={`${CAMPO} resize-y leading-relaxed`}
          />
        </Campo>

        {error && <Alerta>{error}</Alerta>}

        <Botao type="submit" tamanho="lg" icone="Send" disabled={isPending} className="w-full">
          {isPending ? 'Enviando...' : 'Enviar inscrição'}
        </Botao>

        <p className="text-center text-[11.5px] leading-relaxed text-gray-400">
          Sua inscrição passa por aprovação da liderança antes de liberar o acesso.
        </p>
      </div>
    </form>
  )
}
