'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
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
  CornerUpRight,
} from 'lucide-react'
import {
  atualizarAula,
  publicarAula,
  moverAula,
  removerAula,
  moverAulaDeModulo,
} from '@/app/dashboard/admin/actions'
import { analisarVideo, miniaturaDoVideo } from '@/lib/video'
import GerenciarMateriais from '@/components/Materiais/GerenciarMateriais'
import type { MaterialNaTela } from '@/components/Materiais/MateriaisDaAula'
import { Alerta } from '@/components/ui'

export interface AulaItem {
  id: string
  numero: number
  titulo: string
  descricao: string | null
  video_url: string | null
  duracao_minutos: number | null
  publicada: boolean
  concluidas?: number
  modulo_id?: string | null
  /** Material de apoio já anexado a esta aula. */
  materiais?: MaterialNaTela[]
}

/* A receita do campo mora em app/globals.css, numa definição só. Existiam
   seis cópias quase iguais espalhadas pelo projeto, cada uma com um raio ou
   um anel de foco levemente diferente — ninguém aponta a diferença olhando
   uma tela por vez, e é justamente isso que dá a sensação de "feito à mão"
   no conjunto. */
const CAMPO = 'campo'

/* ============================================================
   UMA AULA, COM TUDO QUE É DELA NO MESMO LUGAR

   Vídeo, dados, publicação, ordem e MATERIAL DE APOIO. Antes o material
   estava aqui e a organização por módulo estava em outra lista, na mesma
   página — duas listas mostrando as mesmas aulas. Era literalmente "fica
   tudo misturado": a pessoa não sabia em qual das duas anexar.

   Cada linha tem seu próprio estado de envio. Não é detalhe estético:
   com um estado só para a página inteira, publicar a Aula 3 desabilitava
   os botões da Aula 1 à 12 enquanto o servidor respondia.
   ============================================================ */

export default function LinhaDaAula({
  aula,
  cursoId,
  totalAlunos,
  podeSubir,
  podeDescer,
  outrosModulos = [],
  destacar = '',
}: {
  aula: AulaItem
  cursoId: string
  totalAlunos: number
  podeSubir: boolean
  podeDescer: boolean
  /** Para onde esta aula pode ser movida. Vazio: a opção some. */
  outrosModulos?: { id: string; nome: string }[]
  /** Termo buscado, para pintar o trecho encontrado. */
  destacar?: string
}) {
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [form, setForm] = useState({
    titulo: aula.titulo,
    descricao: aula.descricao ?? '',
    video_url: aula.video_url ?? '',
    duracao: aula.duracao_minutos ? String(aula.duracao_minutos) : '',
  })

  /* As ações do servidor DEVOLVEM o motivo em vez de lançá-lo: exceção o
     Next apaga em produção, e a frase escrita aqui viraria um parágrafo em
     inglês na cara da coordenação. */
  const acao = (
    fn: () => Promise<{ ok: true } | { ok: false; erro: string }>,
    aoTerminar?: () => void
  ) => {
    setErro(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) return setErro(r.erro)
      aoTerminar?.()
      router.refresh()
    })
  }

  const miniatura = miniaturaDoVideo(aula.video_url)
  const previewVideo = analisarVideo(form.video_url)

  /* Pinta o trecho buscado. Sem isso, numa aula com título longo a pessoa
     encontra a linha mas ainda precisa procurar a palavra dentro dela. */
  const titulo = (() => {
    const termo = destacar.trim()
    if (!termo) return aula.titulo
    const i = aula.titulo.toLowerCase().indexOf(termo.toLowerCase())
    if (i < 0) return aula.titulo
    return (
      <>
        {aula.titulo.slice(0, i)}
        <mark className="rounded bg-amber-100 px-0.5 text-gray-900">
          {aula.titulo.slice(i, i + termo.length)}
        </mark>
        {aula.titulo.slice(i + termo.length)}
      </>
    )
  })()

  return (
    <div className={`card-alive overflow-hidden ${aula.publicada ? '' : 'opacity-75'}`}>
      {editando ? (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Editando a aula {aula.numero}</h3>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Cancelar edição"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Nome da aula
              </label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className={CAMPO}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Link do vídeo
              </label>
              <input
                type="url"
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="Cole o link do YouTube, Google Drive, Vimeo ou do arquivo"
                className={CAMPO}
              />
              {form.video_url && (
                <p
                  className={`mt-1.5 text-xs font-medium ${
                    previewVideo.tipo === 'desconhecido' ? 'text-amber-600' : 'text-brand-700'
                  }`}
                >
                  {previewVideo.tipo === 'desconhecido'
                    ? 'Link não reconhecido. Use YouTube, Google Drive, OneDrive, Vimeo ou link direto de vídeo.'
                    : 'Link reconhecido — o vídeo abre aqui dentro da plataforma.'}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Descrição</label>
              <input
                type="text"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className={CAMPO}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Duração (min)
              </label>
              <input
                type="number"
                min={1}
                value={form.duracao}
                onChange={(e) => setForm({ ...form, duracao: e.target.value })}
                className={CAMPO}
              />
            </div>
          </div>

          {erro && (
            <div className="mt-4">
            <Alerta>{erro}</Alerta>
          </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                acao(
                  () =>
                    atualizarAula(aula.id, cursoId, {
                      titulo: form.titulo,
                      descricao: form.descricao,
                      video_url: form.video_url,
                      duracao_minutos: form.duracao ? Number(form.duracao) : undefined,
                    }),
                  () => setEditando(false)
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 active:bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white transition-all shadow-sm disabled:opacity-50"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row">
          {/* Miniatura */}
          <div className="relative aspect-video shrink-0 overflow-hidden bg-brand-950 sm:h-auto sm:w-52 sm:aspect-auto">
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
            <span className="absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-0.5 text-[11px] font-bold text-brand-800 shadow-soft backdrop-blur-sm">
              Aula {aula.numero}
            </span>
            {aula.video_url && (
              <span className="absolute inset-0 flex items-center justify-center">
                <PlayCircle className="h-9 w-9 text-white/85 drop-shadow" strokeWidth={1.5} />
              </span>
            )}
          </div>

          {/* Conteúdo */}
          <div className="min-w-0 flex-1 p-4 sm:p-5">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h3 className="font-bold leading-snug text-gray-900">{titulo}</h3>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                  aula.publicada
                    ? 'bg-brand-50 text-brand-700 ring-brand-200'
                    : 'bg-gray-100 text-gray-500 ring-gray-200'
                }`}
              >
                {aula.publicada ? 'Publicada' : 'Rascunho'}
              </span>
            </div>

            {aula.descricao && (
              <p className="mb-3 line-clamp-2 text-sm text-gray-500">{aula.descricao}</p>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
              {aula.duracao_minutos && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                  {aula.duracao_minutos} min
                </span>
              )}
              {!aula.video_url && (
                <span className="inline-flex items-center gap-1.5 font-medium text-amber-600">
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

            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                disabled={isPending}
                onClick={() => acao(() => publicarAula(aula.id, cursoId, !aula.publicada))}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
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
                onClick={() => setEditando(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                Editar
              </button>

              <span className="mx-1 h-4 w-px bg-gray-200" />

              <button
                type="button"
                disabled={isPending || !podeSubir}
                onClick={() => acao(() => moverAula(aula.id, cursoId, 'cima'))}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-25 disabled:hover:bg-transparent"
                aria-label="Mover aula para cima"
                title="Mover para cima"
              >
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                disabled={isPending || !podeDescer}
                onClick={() => acao(() => moverAula(aula.id, cursoId, 'baixo'))}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-25 disabled:hover:bg-transparent"
                aria-label="Mover aula para baixo"
                title="Mover para baixo"
              >
                <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>

              {/* Mudar de módulo é a operação que estava escondida numa
                  segunda lista. Agora ela mora na própria aula, e a aula
                  visivelmente muda de seção quando a pessoa escolhe. */}
              {outrosModulos.length > 0 && (
                <label className="ml-1 inline-flex items-center gap-1.5">
                  <CornerUpRight className="h-3.5 w-3.5 text-gray-400" strokeWidth={2.25} />
                  <select
                    value=""
                    disabled={isPending}
                    onChange={(e) => {
                      if (!e.target.value) return
                      acao(() => moverAulaDeModulo(aula.id, cursoId, e.target.value))
                    }}
                    className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11.5px] font-medium text-gray-600 disabled:opacity-40"
                    aria-label={`Mover ${aula.titulo} para outro módulo`}
                  >
                    <option value="">mover para o módulo…</option>
                    {outrosModulos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {confirmando ? (
                <span className="ml-auto flex items-center gap-1">
                  <span className="text-[11.5px] text-gray-500">Apagar a aula?</span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => acao(() => removerAula(aula.id, cursoId))}
                    className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Apagar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    className="rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-gray-500 hover:bg-gray-100"
                  >
                    Não
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setConfirmando(true)}
                  className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  aria-label="Remover aula"
                  title="Remover aula"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              )}
            </div>

            {erro && (
              <div className="mt-3">
            <Alerta>{erro}</Alerta>
          </div>
            )}
          </div>
        </div>
      )}

      {/* O material de apoio fica DENTRO da linha da aula, e não numa tela
          à parte: é conteúdo daquela aula, e separar as duas coisas faria o
          professor abrir dois lugares para montar uma aula só. */}
      {!editando && (
        <div className="border-t border-gray-100 p-4 sm:p-5">
          <GerenciarMateriais aulaId={aula.id} materiais={aula.materiais ?? []} />
        </div>
      )}
    </div>
  )
}
