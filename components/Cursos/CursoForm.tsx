'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, X, Check, AlertCircle, Plus } from 'lucide-react'
import { criarCurso, atualizarCurso } from '@/app/dashboard/admin/actions'
import { CORES_CURSO, NIVEL_LABEL, urlDaCapa, type Curso, type CorCurso } from '@/lib/cursos'

const CAMPO =
  'w-full px-3.5 py-2.5 bg-gray-50/60 border border-gray-200 rounded-xl text-[15px] transition-all focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500'

export default function CursoForm({ curso }: { curso?: Curso }) {
  const editando = !!curso
  const [aberto, setAberto] = useState(editando)
  const [cor, setCor] = useState<CorCurso>((curso?.cor as CorCurso) ?? 'esmeralda')
  const [previa, setPrevia] = useState<string | null>(urlDaCapa(curso?.capa_path) ?? null)
  const [arrastando, setArrastando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  const escolherCapa = (file: File | null) => {
    setError(null)
    if (previa?.startsWith('blob:')) URL.revokeObjectURL(previa)
    setPrevia(file ? URL.createObjectURL(file) : (urlDaCapa(curso?.capa_path) ?? null))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const dados = new FormData(e.currentTarget)
    dados.set('cor', cor)

    startTransition(async () => {
      try {
        if (editando) {
          await atualizarCurso(curso.id, dados)
        } else {
          await criarCurso(dados)
          formRef.current?.reset()
          setPrevia(null)
          setAberto(false)
        }
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar o curso.')
      }
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="group inline-flex items-center gap-2 bg-gradient-to-br from-brand-600 to-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-glow active:scale-[0.98]"
      >
        <Plus
          className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90"
          strokeWidth={2.5}
        />
        Novo curso
      </button>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="card-alive p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-gray-900">{editando ? 'Editar curso' : 'Novo curso'}</h2>
        {!editando && (
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        {/* ---------- Capa ---------- */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Capa do curso</label>
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastando(false)
              const f = e.dataTransfer.files?.[0]
              if (f && inputRef.current) {
                const dt = new DataTransfer()
                dt.items.add(f)
                inputRef.current.files = dt.files
                escolherCapa(f)
              }
            }}
            className={`group relative flex aspect-[16/10] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed transition-all ${
              arrastando
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-200 hover:border-brand-400 hover:bg-brand-50/40'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              name="capa"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(e) => escolherCapa(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            {previa ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previa} alt="Prévia da capa" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                  <ImagePlus className="h-5 w-5" strokeWidth={1.85} />
                </span>
                <span className="text-xs text-gray-500 text-center px-4">
                  Arraste ou clique
                  <br />
                  JPG, PNG ou WEBP
                </span>
              </>
            )}
          </label>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Sem capa, o curso usa um fundo colorido automático.
          </p>

          {/* ---------- Cor ---------- */}
          <label className="block text-sm font-semibold text-gray-700 mb-2 mt-5">
            Cor do curso
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CORES_CURSO) as CorCurso[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                title={CORES_CURSO[c].nome}
                aria-label={CORES_CURSO[c].nome}
                aria-pressed={cor === c}
                className={`h-9 w-9 rounded-xl bg-gradient-to-br ${CORES_CURSO[c].gradiente} transition-all ${
                  cor === c
                    ? 'ring-2 ring-offset-2 ring-brand-600 scale-110'
                    : 'ring-1 ring-black/5 hover:scale-105'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ---------- Campos ---------- */}
        <div className="grid sm:grid-cols-2 gap-4 content-start">
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Nome do curso
            </label>
            <input
              name="titulo"
              type="text"
              required
              defaultValue={curso?.titulo}
              placeholder="Ex: Escola de Líderes — Módulo 1"
              className={CAMPO}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Chamada curta
            </label>
            <input
              name="subtitulo"
              type="text"
              defaultValue={curso?.subtitulo ?? ''}
              placeholder="Uma frase que resume o curso"
              className={CAMPO}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Categoria</label>
            <input
              name="categoria"
              type="text"
              defaultValue={curso?.categoria ?? ''}
              placeholder="Ex: Liderança"
              className={CAMPO}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nível</label>
            <select name="nivel" defaultValue={curso?.nivel ?? 'iniciante'} className={`${CAMPO} bg-white`}>
              {Object.entries(NIVEL_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Carga horária (horas)
            </label>
            <input
              name="carga_horaria"
              type="number"
              min={1}
              defaultValue={curso?.carga_horaria ?? ''}
              placeholder="20"
              className={CAMPO}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Descrição</label>
            <textarea
              name="descricao"
              rows={3}
              defaultValue={curso?.descricao ?? ''}
              placeholder="O que o aluno vai aprender neste curso"
              className={`${CAMPO} resize-none`}
            />
          </div>
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
          className="inline-flex items-center gap-2 bg-gradient-to-br from-brand-600 to-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-glow transition-all disabled:opacity-50"
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
          {isPending ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar curso'}
        </button>
        {!editando && (
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
