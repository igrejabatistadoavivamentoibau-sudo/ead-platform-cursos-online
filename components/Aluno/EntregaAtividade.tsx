'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip, Check, MessageSquare, Upload, X } from 'lucide-react'
import { entregarAtividade } from '@/app/dashboard/aluno/actions'
import { Botao, Alerta, Selo, CAMPO } from '@/components/ui'

export interface AtividadeAluno {
  id: string
  titulo: string
  descricao: string | null
  prazo: string | null
  nota_maxima: number
  turma: string
  entrega: {
    texto: string | null
    arquivo_nome: string | null
    nota: number | null
    feedback: string | null
    entregue_em: string
  } | null
}

function formatarData(d: string) {
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

export default function EntregaAtividade({ atividade }: { atividade: AtividadeAluno }) {
  const jaEntregue = !!atividade.entrega
  const corrigida = atividade.entrega?.nota !== null && atividade.entrega?.nota !== undefined

  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState(atividade.entrega?.texto ?? '')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Prazo vencido é comparado por data (sem hora), como a pessoa entende
  const atrasada =
    atividade.prazo && !jaEntregue ? atividade.prazo < new Date().toISOString().slice(0, 10) : false

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const dados = new FormData()
    dados.set('atividade_id', atividade.id)
    dados.set('texto', texto)
    if (arquivo) dados.set('arquivo', arquivo)

    startTransition(async () => {
      try {
        await entregarAtividade(dados)
        setSalvo(true)
        setAberto(false)
        setArquivo(null)
        if (inputRef.current) inputRef.current.value = ''
        setTimeout(() => setSalvo(false), 3000)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao entregar.')
      }
    })
  }

  return (
    <div className="rounded-xl bg-white ring-1 ring-brand-950/[0.07]">
      <div className="p-4">
        <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-display text-[15px] font-bold text-gray-900">{atividade.titulo}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {corrigida ? (
              <Selo tom="verde" icone="Check">
                Nota {Number(atividade.entrega!.nota)} / {Number(atividade.nota_maxima)}
              </Selo>
            ) : jaEntregue ? (
              <Selo tom="azul">Entregue — aguardando correção</Selo>
            ) : atrasada ? (
              <Selo tom="vermelho">Prazo vencido</Selo>
            ) : (
              <Selo tom="ambar">A entregar</Selo>
            )}
          </div>
        </div>

        <p className="mb-2 text-[12px] text-gray-500">
          {atividade.turma}
          {atividade.prazo && ` · prazo ${formatarData(atividade.prazo)}`}
          {` · vale até ${Number(atividade.nota_maxima)}`}
        </p>

        {atividade.descricao && (
          <p className="mb-3 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-600">
            {atividade.descricao}
          </p>
        )}

        {/* Entrega já feita */}
        {jaEntregue && !aberto && (
          <div className="rounded-lg bg-gray-50 p-3.5">
            {atividade.entrega?.texto && (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
                {atividade.entrega.texto}
              </p>
            )}
            {atividade.entrega?.arquivo_nome && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-700">
                <Paperclip className="h-3.5 w-3.5" strokeWidth={2} />
                {atividade.entrega.arquivo_nome}
              </p>
            )}
          </div>
        )}

        {atividade.entrega?.feedback && (
          <div className="mt-3 rounded-lg bg-brand-50/70 p-3.5 ring-1 ring-brand-200">
            <p className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-brand-800">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.2} />
              Comentário do professor
            </p>
            <p className="text-[13px] leading-relaxed text-brand-900/90">
              {atividade.entrega.feedback}
            </p>
          </div>
        )}

        {salvo && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Entrega enviada
          </p>
        )}

        {/* Formulário de entrega */}
        {aberto ? (
          <form onSubmit={enviar} className="mt-3 space-y-2.5">
            <textarea
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva sua resposta aqui"
              className={`${CAMPO} resize-y leading-relaxed`}
            />

            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border-2 border-dashed border-gray-200 px-3.5 py-2.5 transition-colors hover:border-brand-400 hover:bg-brand-50/40">
              <input
                ref={inputRef}
                type="file"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
              <Upload className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
              <span className="min-w-0 truncate text-[12.5px] text-gray-600">
                {arquivo ? arquivo.name : 'Anexar arquivo (opcional) — até 20 MB'}
              </span>
              {arquivo && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault()
                    setArquivo(null)
                    if (inputRef.current) inputRef.current.value = ''
                  }}
                  className="ml-auto text-gray-400 hover:text-red-600"
                  aria-label="Remover arquivo"
                >
                  <X className="h-4 w-4" />
                </span>
              )}
            </label>

            {error && <Alerta>{error}</Alerta>}

            <div className="flex gap-2">
              <Botao type="submit" icone="Send" disabled={isPending}>
                {isPending ? 'Enviando...' : jaEntregue ? 'Reenviar' : 'Entregar'}
              </Botao>
              <Botao type="button" variante="fantasma" onClick={() => setAberto(false)}>
                Cancelar
              </Botao>
            </div>
          </form>
        ) : (
          <div className="mt-3">
            <Botao
              variante={jaEntregue ? 'secundario' : 'primario'}
              icone={jaEntregue ? 'PenLine' : 'Upload'}
              onClick={() => setAberto(true)}
            >
              {jaEntregue ? 'Editar entrega' : 'Fazer entrega'}
            </Botao>
          </div>
        )}
      </div>
    </div>
  )
}
