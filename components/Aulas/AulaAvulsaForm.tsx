'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, Film } from 'lucide-react'
import { criarAulaComVideo } from '@/app/dashboard/professor/actions'
import { Botao, Card, Alerta, CAMPO, Campo } from '@/components/ui'

/**
 * Envio de uma aula gravada direto para a plataforma.
 *
 * Pensado para o curso presencial: o professor grava o encontro e
 * disponibiliza para quem faltou ou quer rever, sem depender do YouTube.
 */
export default function AulaAvulsaForm({ cursoId }: { cursoId: string }) {
  const [aberto, setAberto] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [progresso, setProgresso] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const dados = new FormData(e.currentTarget)
    dados.set('curso_id', cursoId)
    if (arquivo) dados.set('video', arquivo)

    setProgresso(true)
    startTransition(async () => {
      try {
        await criarAulaComVideo(dados)
        formRef.current?.reset()
        setArquivo(null)
        setAberto(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao enviar a aula.')
      } finally {
        setProgresso(false)
      }
    })
  }

  if (!aberto) {
    return (
      <Botao variante="secundario" icone="Film" onClick={() => setAberto(true)}>
        Enviar aula gravada
      </Botao>
    )
  }

  return (
    <Card>
      <form ref={formRef} onSubmit={enviar}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-[15px] font-bold text-gray-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Film className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            Aula gravada
          </h3>
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <p className="mb-4 text-[13px] leading-relaxed text-gray-500">
          Grave o encontro e envie aqui para quem faltou poder assistir. O arquivo fica hospedado
          na própria plataforma.
        </p>

        <div className="space-y-4">
          <Campo label="Nome da aula">
            <input
              name="titulo"
              type="text"
              required
              placeholder="Ex: Encontro de 12/03 — Caráter do líder"
              className={CAMPO}
            />
          </Campo>

          <Campo label="Descrição (opcional)">
            <input
              name="descricao"
              type="text"
              placeholder="Um resumo curto do que foi tratado"
              className={CAMPO}
            />
          </Campo>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 px-4 py-4 transition-colors hover:border-brand-400 hover:bg-brand-50/40">
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Upload className="h-4.5 w-4.5" strokeWidth={1.9} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-gray-800">
                {arquivo ? arquivo.name : 'Escolher arquivo de vídeo'}
              </span>
              <span className="block text-[11.5px] text-gray-500">
                {arquivo
                  ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB`
                  : 'MP4, WEBM ou MOV — até 200 MB'}
              </span>
            </span>
          </label>

          {error && <Alerta>{error}</Alerta>}

          {progresso && (
            <Alerta tom="info">
              Enviando o vídeo. Em arquivos grandes isso pode levar alguns minutos — não feche a
              página.
            </Alerta>
          )}

          <div className="flex gap-2">
            <Botao type="submit" icone="Upload" disabled={isPending || !arquivo}>
              {isPending ? 'Enviando...' : 'Enviar aula'}
            </Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
          </div>
        </div>
      </form>
    </Card>
  )
}
