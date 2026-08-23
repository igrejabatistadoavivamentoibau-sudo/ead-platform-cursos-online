'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, AlertCircle } from 'lucide-react'
import { criarAula } from '@/app/dashboard/admin/actions'
import { analisarVideo } from '@/lib/video'

const CAMPO =
  'w-full px-3.5 py-2.5 bg-gray-50/60 border border-gray-200 rounded-xl text-[15px] transition-all focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500'

const VAZIO = { titulo: '', descricao: '', video_url: '', duracao: '' }

/* ============================================================
   NOVA AULA — DENTRO DE UM MÓDULO

   O módulo não é um campo aqui. Ele é o LUGAR: este formulário abre
   dentro da seção do módulo, e a aula nasce nele. É a diferença entre
   "adicionar aula e depois lembrar de escolher o módulo certo num select"
   e "adicionar aula AQUI".

   Aula sem módulo é aula que o aluno nunca vê — o aluno entra por uma
   turma, a turma pertence a um módulo, e o que ele enxerga são as aulas
   daquele módulo. Por isso a escolha some da tela: ela já foi feita pelo
   botão que abriu este formulário.
   ============================================================ */

export default function NovaAula({
  cursoId,
  moduloId,
  moduloNome,
  proximoNumero,
}: {
  cursoId: string
  moduloId: string
  moduloNome: string
  proximoNumero: number
}) {
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const previewVideo = analisarVideo(form.video_url)

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    startTransition(async () => {
      const r = await criarAula({
        curso_id: cursoId,
        modulo_id: moduloId,
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        video_url: form.video_url || undefined,
        duracao_minutos: form.duracao ? Number(form.duracao) : undefined,
      })
      if (!r.ok) return setErro(r.erro)
      setForm(VAZIO)
      setAberto(false)
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setForm(VAZIO)
          setAberto(true)
        }}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-[13px] font-semibold text-gray-500 transition-all hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700"
      >
        <Plus
          className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90"
          strokeWidth={2.5}
        />
        Adicionar aula em {moduloNome}
      </button>
    )
  }

  return (
    <form onSubmit={enviar} className="card-alive p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-gray-900">
          Nova aula{' '}
          <span className="font-normal text-gray-400">
            {/* A contagem é por MÓDULO: cada módulo tem a "Aula 1" dele, e
                não continua a numeração do anterior. */}
            (será a aula {proximoNumero} de {moduloNome})
          </span>
        </h3>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Nome da aula</label>
          <input
            type="text"
            required
            autoFocus
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex: Fundamentos da liderança cristã"
            className={CAMPO}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Link do vídeo</label>
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
                'Google Drive reconhecido — deixe o arquivo como "qualquer pessoa com o link".'}
              {previewVideo.tipo === 'onedrive' &&
                !previewVideo.iframe &&
                'O OneDrive exige login da Microsoft para exibir vídeo, então o link não abre para os alunos. Suba no YouTube como "não listado".'}
              {previewVideo.tipo === 'onedrive' &&
                previewVideo.iframe &&
                'Código de incorporação do OneDrive reconhecido — o vídeo abre aqui dentro.'}
              {previewVideo.tipo === 'vimeo' && 'Vimeo reconhecido — o vídeo abre aqui dentro.'}
              {previewVideo.tipo === 'arquivo' &&
                'Arquivo de vídeo — abre aqui dentro e a conclusão é automática.'}
              {previewVideo.tipo === 'desconhecido' &&
                'Link não reconhecido. Use YouTube, Google Drive, OneDrive, Vimeo ou link direto de vídeo.'}
            </p>
          ) : (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-gray-500">
              Pode ficar em branco agora e ser colado depois. Para gravação de aula, o melhor
              caminho é o <strong>YouTube como &ldquo;não listado&rdquo;</strong>: é grátis, aceita
              qualquer tamanho, não aparece em buscas, e o vídeo toca dentro da plataforma — o
              aluno nunca é mandado para fora.
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
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
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
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

      {erro && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-px h-[18px] w-[18px] shrink-0" strokeWidth={2.25} />
          {erro}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-glow disabled:opacity-50"
        >
          {isPending ? 'Salvando...' : 'Criar aula'}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
