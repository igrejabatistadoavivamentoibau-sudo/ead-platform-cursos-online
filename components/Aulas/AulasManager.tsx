'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Plus,
  X,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Check,
  Video,
  Clock,
  PlayCircle,
  AlertCircle,
} from 'lucide-react'
import {
  criarAula,
  atualizarAula,
  publicarAula,
  moverAula,
  removerAula,
} from '@/app/dashboard/admin/actions'
import { analisarVideo, miniaturaDoVideo } from '@/lib/video'

export interface AulaItem {
  id: string
  numero: number
  titulo: string
  descricao: string | null
  video_url: string | null
  duracao_minutos: number | null
  publicada: boolean
  concluidas?: number
}

const CAMPO =
  'w-full px-3.5 py-2.5 bg-gray-50/60 border border-gray-200 rounded-xl text-[15px] transition-all focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500'

export default function AulasManager({
  cursoId,
  aulas,
  totalAlunos,
}: {
  cursoId: string
  aulas: AulaItem[]
  totalAlunos: number
}) {
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [form, setForm] = useState({ titulo: '', descricao: '', video_url: '', duracao: '' })

  const resetForm = () => setForm({ titulo: '', descricao: '', video_url: '', duracao: '' })

  const acao = (fn: () => Promise<void>, aoTerminar?: () => void) => {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        aoTerminar?.()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar.')
      }
    })
  }

  const handleCriar = (e: React.FormEvent) => {
    e.preventDefault()
    acao(
      () =>
        criarAula({
          curso_id: cursoId,
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          video_url: form.video_url || undefined,
          duracao_minutos: form.duracao ? Number(form.duracao) : undefined,
        }),
      () => {
        resetForm()
        setCriando(false)
      }
    )
  }

  const handleSalvarEdicao = (aulaId: string) => {
    acao(
      () =>
        atualizarAula(aulaId, cursoId, {
          titulo: form.titulo,
          descricao: form.descricao,
          video_url: form.video_url,
          duracao_minutos: form.duracao ? Number(form.duracao) : undefined,
        }),
      () => {
        resetForm()
        setEditando(null)
      }
    )
  }

  const abrirEdicao = (aula: AulaItem) => {
    setEditando(aula.id)
    setCriando(false)
    setForm({
      titulo: aula.titulo,
      descricao: aula.descricao ?? '',
      video_url: aula.video_url ?? '',
      duracao: aula.duracao_minutos ? String(aula.duracao_minutos) : '',
    })
  }

  const previewVideo = analisarVideo(form.video_url)

  return (
    <div className="space-y-5">
      {/* ===== Botão / formulário de nova aula ===== */}
      {!criando ? (
        <button
          type="button"
          onClick={() => {
            setCriando(true)
            setEditando(null)
            resetForm()
          }}
          className="group inline-flex items-center gap-2 bg-gradient-to-br from-brand-600 to-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-glow active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 transition-transform group-hover:rotate-90 duration-300" strokeWidth={2.5} />
          Adicionar aula
        </button>
      ) : (
        <form onSubmit={handleCriar} className="card-alive p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">
              Nova aula <span className="text-gray-400 font-normal">(Aula {aulas.length + 1})</span>
            </h2>
            <button
              type="button"
              onClick={() => setCriando(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Nome da aula
              </label>
              <input
                type="text"
                required
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex: Fundamentos da Liderança Cristã"
                className={CAMPO}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Link do vídeo
              </label>
              <input
                type="url"
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="Cole o link do YouTube, Google Drive, Vimeo ou do arquivo"
                className={CAMPO}
              />
              {form.video_url ? (
                <p
                  className={`mt-1.5 text-xs font-medium ${
                    previewVideo.tipo === 'desconhecido' ? 'text-amber-600' : 'text-brand-700'
                  }`}
                >
                  {previewVideo.tipo === 'youtube' &&
                    'YouTube reconhecido — o vídeo abre aqui dentro e a conclusão é automática.'}
                  {previewVideo.tipo === 'drive' &&
                    'Google Drive reconhecido — o vídeo abre aqui dentro. Deixe o arquivo como "qualquer pessoa com o link".'}
                  {previewVideo.tipo === 'onedrive' &&
                    'OneDrive reconhecido — o vídeo abre aqui dentro e a conclusão é automática. Deixe o arquivo compartilhado como "qualquer pessoa com o link".'}
                  {previewVideo.tipo === 'vimeo' && 'Vimeo reconhecido — o vídeo abre aqui dentro.'}
                  {previewVideo.tipo === 'arquivo' &&
                    'Arquivo de vídeo — abre aqui dentro e a conclusão é automática.'}
                  {previewVideo.tipo === 'desconhecido' &&
                    'Link não reconhecido. Use YouTube, Google Drive, OneDrive, Vimeo ou link direto de vídeo.'}
                </p>
              ) : (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-gray-500">
                  Para vídeo grande, o link é o melhor caminho: não passa pelo limite de envio da
                  plataforma. Em qualquer um dos casos o vídeo toca dentro da plataforma — o aluno
                  nunca é mandado para fora.
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Descrição (opcional)
              </label>
              <input
                type="text"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Um resumo curto do conteúdo da aula"
                className={CAMPO}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Duração em minutos (opcional)
              </label>
              <input
                type="number"
                min={1}
                value={form.duracao}
                onChange={(e) => setForm({ ...form, duracao: e.target.value })}
                placeholder="45"
                className={CAMPO}
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              <AlertCircle className="h-[18px] w-[18px] shrink-0 mt-px" strokeWidth={2.25} />
              {error}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="bg-gradient-to-br from-brand-600 to-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-glow transition-all disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : 'Criar aula'}
            </button>
            <button
              type="button"
              onClick={() => setCriando(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && !criando && !editando && (
        <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          <AlertCircle className="h-[18px] w-[18px] shrink-0 mt-px" strokeWidth={2.25} />
          {error}
        </div>
      )}

      {/* ===== Lista de aulas ===== */}
      {aulas.length > 0 ? (
        <div className="space-y-3">
          {aulas.map((aula, i) => {
            const miniatura = miniaturaDoVideo(aula.video_url)
            const emEdicao = editando === aula.id

            return (
              <div key={aula.id} className={`card-alive overflow-hidden ${aula.publicada ? '' : 'opacity-75'}`}>
                {emEdicao ? (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900">Editando Aula {aula.numero}</h3>
                      <button
                        type="button"
                        onClick={() => setEditando(null)}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Cancelar edição"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome da aula</label>
                        <input
                          type="text"
                          value={form.titulo}
                          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                          className={CAMPO}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Link do vídeo</label>
                        <input
                          type="url"
                          value={form.video_url}
                          onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                          className={CAMPO}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Descrição</label>
                        <input
                          type="text"
                          value={form.descricao}
                          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                          className={CAMPO}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Duração (min)</label>
                        <input
                          type="number"
                          min={1}
                          value={form.duracao}
                          onChange={(e) => setForm({ ...form, duracao: e.target.value })}
                          className={CAMPO}
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="mt-4 flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                        <AlertCircle className="h-[18px] w-[18px] shrink-0 mt-px" strokeWidth={2.25} />
                        {error}
                      </div>
                    )}
                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSalvarEdicao(aula.id)}
                        className="inline-flex items-center gap-2 bg-gradient-to-br from-brand-600 to-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-glow transition-all disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                        {isPending ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditando(null)}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row">
                    {/* Miniatura */}
                    <div className="relative sm:w-52 shrink-0 aspect-video sm:aspect-auto sm:h-auto bg-brand-950 overflow-hidden">
                      {miniatura ? (
                        <Image
                          src={miniatura}
                          alt={aula.titulo}
                          fill
                          sizes="208px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-800 to-brand-600 text-white/40">
                          <Video className="h-8 w-8" strokeWidth={1.5} />
                        </div>
                      )}
                      <span className="absolute top-2 left-2 rounded-lg bg-white/90 backdrop-blur-sm px-2 py-0.5 text-[11px] font-bold text-brand-800 shadow-soft">
                        Aula {aula.numero}
                      </span>
                      {aula.video_url && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <PlayCircle className="h-9 w-9 text-white/85 drop-shadow" strokeWidth={1.5} />
                        </span>
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3 className="font-bold text-gray-900 leading-snug">{aula.titulo}</h3>
                        <span
                          className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${
                            aula.publicada
                              ? 'bg-brand-50 text-brand-700 ring-brand-200'
                              : 'bg-gray-100 text-gray-500 ring-gray-200'
                          }`}
                        >
                          {aula.publicada ? 'Publicada' : 'Rascunho'}
                        </span>
                      </div>

                      {aula.descricao && (
                        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{aula.descricao}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 mb-4">
                        {aula.duracao_minutos && (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                            {aula.duracao_minutos} min
                          </span>
                        )}
                        {!aula.video_url && (
                          <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                            <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
                            Sem vídeo cadastrado
                          </span>
                        )}
                        {totalAlunos > 0 && (
                          <span className="inline-flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-brand-600" strokeWidth={2.5} />
                            <span className="font-semibold text-gray-700">
                              {aula.concluidas ?? 0}/{totalAlunos}
                            </span>
                            concluíram
                          </span>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => acao(() => publicarAula(aula.id, cursoId, !aula.publicada))}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-brand-700 px-2.5 py-1.5 rounded-lg hover:bg-brand-50 transition-colors disabled:opacity-40"
                        >
                          {aula.publicada ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" strokeWidth={2.25} />
                              Despublicar
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" strokeWidth={2.25} />
                              Publicar
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => abrirEdicao(aula)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-brand-700 px-2.5 py-1.5 rounded-lg hover:bg-brand-50 transition-colors disabled:opacity-40"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                          Editar
                        </button>

                        <span className="mx-1 h-4 w-px bg-gray-200" />

                        <button
                          type="button"
                          disabled={isPending || i === 0}
                          onClick={() => acao(() => moverAula(aula.id, cursoId, 'cima'))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-25 disabled:hover:bg-transparent"
                          aria-label="Mover aula para cima"
                          title="Mover para cima"
                        >
                          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          disabled={isPending || i === aulas.length - 1}
                          onClick={() => acao(() => moverAula(aula.id, cursoId, 'baixo'))}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-25 disabled:hover:bg-transparent"
                          aria-label="Mover aula para baixo"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>

                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => acao(() => removerAula(aula.id, cursoId))}
                          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                          aria-label="Remover aula"
                          title="Remover aula"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        !criando && (
          <div className="card-alive p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
              <Video className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <p className="text-gray-700 font-medium">Nenhuma aula cadastrada nesta turma.</p>
            <p className="text-sm text-gray-500 mt-1">
              Clique em &quot;Adicionar aula&quot; para criar a Aula 1.
            </p>
          </div>
        )
      )}
    </div>
  )
}
