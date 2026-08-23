'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip, Plus, X, Trash2, FileText, Link2, Upload, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  autorizarEnvioDeMaterial,
  registrarMaterial,
  removerMaterial,
} from '@/app/dashboard/professor/materiais/actions'
import {
  tipoAceito,
  rotuloDoTipo,
  tamanhoLegivel,
  TAMANHO_MAXIMO_MATERIAL,
} from '@/lib/materiais'
import { Campo, CAMPO, Botao } from '@/components/ui'
import type { MaterialNaTela } from './MateriaisDaAula'

/* ============================================================
   O MATERIAL DE APOIO, DO LADO DE QUEM DÁ AULA

   Duas formas de anexar, porque a escola usa as duas: o ARQUIVO (a
   apostila em PDF, os slides) e o LINK (um artigo, um vídeo no YouTube,
   uma pasta compartilhada). Obrigar tudo a virar arquivo faria o professor
   baixar e subir de novo o que já está publicado em algum lugar.

   O arquivo vai DIRETO do navegador para o armazenamento, com barra de
   progresso. O servidor só autoriza antes e registra depois — ver o
   comentário em `actions.ts`.
   ============================================================ */

export default function GerenciarMateriais({
  aulaId,
  materiais,
}: {
  aulaId: string
  materiais: MaterialNaTela[]
}) {
  const [aberto, setAberto] = useState(false)
  const [modo, setModo] = useState<'arquivo' | 'link'>('arquivo')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [url, setUrl] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [pct, setPct] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const enviando = pct !== null

  const limpar = () => {
    setTitulo('')
    setDescricao('')
    setUrl('')
    setArquivo(null)
    setErro(null)
    setAberto(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  /** XHR e não fetch: só ele informa o progresso do envio. */
  const subir = (endereco: string, token: string, file: File) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', endereco, true)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('x-upsert', 'false')
      if (file.type) xhr.setRequestHeader('Content-Type', file.type)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Falha no envio (código ${xhr.status}).`))
      xhr.onerror = () => reject(new Error('A conexão caiu durante o envio.'))
      xhr.send(file)
    })

  const salvar = async () => {
    setErro(null)

    if (!titulo.trim()) return setErro('Dê um nome ao material.')

    if (modo === 'link') {
      startTransition(async () => {
        const r = await registrarMaterial({ aulaId, titulo, descricao, url })
        if (!r.ok) return setErro(r.erro)
        limpar()
        router.refresh()
      })
      return
    }

    if (!arquivo) return setErro('Escolha o arquivo.')
    if (!tipoAceito(arquivo.type)) {
      return setErro('Formato não aceito. Envie PDF, imagem, Word, slides ou áudio.')
    }
    if (arquivo.size > TAMANHO_MAXIMO_MATERIAL) {
      return setErro(
        `Este arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB e o limite é 25 MB. Para algo maior, use a aba "Link".`
      )
    }

    setPct(0)
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Sua sessão expirou. Entre de novo.')

      const autorizacao = await autorizarEnvioDeMaterial(aulaId, arquivo.type, arquivo.size)
      if (!autorizacao.ok) throw new Error(autorizacao.erro)

      await subir(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/materiais/${autorizacao.path}`,
        session.access_token,
        arquivo
      )

      const r = await registrarMaterial({
        aulaId,
        titulo,
        descricao,
        path: autorizacao.path,
        tamanho: arquivo.size,
        formato: arquivo.type,
      })
      if (!r.ok) throw new Error(r.erro)

      limpar()
      router.refresh()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar o material.')
    } finally {
      setPct(null)
    }
  }

  const apagar = (id: string) => {
    setErro(null)
    startTransition(async () => {
      const r = await removerMaterial(id)
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl bg-gray-50/70 p-4 ring-1 ring-brand-950/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-[13.5px] font-bold text-gray-800">
          <Paperclip className="h-4 w-4 text-brand-600" strokeWidth={2.25} />
          Material de apoio
          {materiais.length > 0 && (
            <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-700">
              {materiais.length}
            </span>
          )}
        </h4>

        {!aberto && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Anexar
          </button>
        )}
      </div>

      {materiais.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {materiais.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2.5 rounded-lg bg-white px-3 py-2 ring-1 ring-brand-950/[0.05]"
            >
              {m.tipo === 'link' ? (
                <Link2 className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-gray-800">
                  {m.titulo}
                </span>
                <span className="block text-[11px] text-gray-500">
                  {m.tipo === 'link' ? 'Link' : rotuloDoTipo(m.formato)}
                  {m.tamanho ? ` · ${tamanhoLegivel(m.tamanho)}` : ''}
                </span>
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => apagar(m.id)}
                aria-label={`Tirar ${m.titulo}`}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <div className="mt-3 rounded-xl bg-white p-3.5 ring-1 ring-brand-950/[0.06]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              {(['arquivo', 'link'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  className={`rounded-md px-3 py-1 text-[12.5px] font-semibold transition-colors ${
                    modo === m ? 'bg-white text-brand-800 shadow-soft' : 'text-gray-500'
                  }`}
                >
                  {m === 'arquivo' ? 'Arquivo' : 'Link'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={limpar}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <Campo label="Nome do material">
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                disabled={enviando}
                placeholder="Ex: Apostila da Aula 3"
                className={CAMPO}
              />
            </Campo>

            {modo === 'link' ? (
              <Campo label="Endereço">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className={CAMPO}
                />
              </Campo>
            ) : (
              <label
                className={`flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors ${
                  enviando
                    ? 'cursor-not-allowed border-gray-200 opacity-60'
                    : 'cursor-pointer border-gray-200 hover:border-brand-400 hover:bg-brand-50/40'
                }`}
              >
                <Upload className="h-5 w-5 shrink-0 text-brand-600" strokeWidth={2} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-gray-700">
                    {arquivo ? arquivo.name : 'Escolher arquivo'}
                  </span>
                  <span className="block text-[11.5px] text-gray-500">
                    PDF, imagem, Word, slides ou áudio — até 25 MB
                  </span>
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  disabled={enviando}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setArquivo(f)
                    setErro(null)
                    if (f && !titulo.trim()) setTitulo(f.name.replace(/\.[^.]+$/, ''))
                  }}
                  className="hidden"
                />
              </label>
            )}

            <Campo label="Observação (opcional)">
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={enviando}
                placeholder="Ex: leia antes do encontro"
                className={CAMPO}
              />
            </Campo>

            {enviando && (
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[11.5px] text-gray-500">Enviando… {pct}%</p>
              </div>
            )}

            {erro && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[12.5px] text-red-800 ring-1 ring-red-200">
                <AlertCircle className="mt-px h-4 w-4 shrink-0" strokeWidth={2.25} />
                {erro}
              </div>
            )}

            <div className="flex gap-2">
              <Botao onClick={salvar} disabled={enviando || isPending}>
                {enviando ? 'Enviando...' : 'Anexar à aula'}
              </Botao>
              <Botao variante="secundario" onClick={limpar}>
                Cancelar
              </Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
