'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { criarTurma } from '@/app/dashboard/admin/actions'
import { Selecao } from '@/components/ui'

interface Professor {
  id: string
  name: string
}

export default function CriarTurmaForm({ professores }: { professores: Professor[] }) {
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [professorId, setProfessorId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await criarTurma({
          nome,
          descricao: descricao || undefined,
          professor_id: professorId || undefined,
          data_inicio: dataInicio || undefined,
        })
        setNome('')
        setDescricao('')
        setProfessorId('')
        setDataInicio('')
        setOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao criar turma.')
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-800 transition-colors shadow-sm"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Criar turma
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-alive p-5 sm:p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Nova turma</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da turma</label>
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Turma 2026.2"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição (opcional)</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Módulo de liderança básica"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Professor responsável</label>
          <Selecao
            valorInicial={professorId}
            aoMudar={setProfessorId}
            placeholder="Sem professor definido ainda"
            opcoes={[
              { valor: '', rotulo: 'Sem professor definido ainda' },
              ...professores.map((pr) => ({ valor: pr.id, rotulo: pr.name })),
            ]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Data de início (opcional)</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-800 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Criando...' : 'Criar turma'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
