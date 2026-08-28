'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, UserPlus } from 'lucide-react'
import { matricularAluno } from '@/app/dashboard/admin/actions'
import { Botao, Alerta, CAMPO } from '@/components/ui'

export interface Repetente {
  matriculaId: string
  alunoId: string
  nome: string
  email: string
  media: number | null
  observacao: string | null
  concluidaEm: string | null
  turmaAnterior: string
  moduloId: string | null
  moduloNome: string | null
  cursoTitulo: string | null
}

export interface TurmaDisponivel {
  id: string
  nome: string
  status: string
  modalidade: string
  moduloId: string
}

/* ============================================================
   COLOCAR O ALUNO NUMA TURMA NOVA

   A decisão é da coordenação, não da plataforma. O que esta peça faz é
   reduzir a decisão ao mínimo: mostrar as turmas do MESMO módulo que
   ainda não encerraram, e matricular numa delas.

   Só aparecem turmas do mesmo módulo porque é o que faz sentido para
   quem repete — e porque oferecer uma turma do módulo seguinte aqui seria
   oferecer exatamente o que a regra do pré-requisito impede.
   ============================================================ */

export default function ColocarEmTurma({
  repetente,
  turmas,
}: {
  repetente: Repetente
  turmas: TurmaDisponivel[]
}) {
  const [escolhida, setEscolhida] = useState('')
  const [feito, setFeito] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (feito) {
    return (
      <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700">
        <Check className="h-4 w-4" strokeWidth={2.4} />
        Matriculado
      </p>
    )
  }

  if (!turmas.length) {
    return (
      <p className="max-w-[260px] text-right text-[12px] text-gray-500">
        Nenhuma turma aberta neste módulo. Crie uma turma nova de{' '}
        <b>{repetente.moduloNome ?? 'o mesmo módulo'}</b> para receber quem repete.
      </p>
    )
  }

  const matricular = () => {
    if (!escolhida) return
    setError(null)
    startTransition(async () => {
      /* Sem `ignorarPreRequisito`: refazer o MESMO módulo não exige
         pré-requisito nenhum, então a regra passa naturalmente. Se um
         dia isto virar exceção, ela tem que ser escrita.

         A ação devolve o motivo em vez de lançar — em produção o Next
         apaga a mensagem de exceção, e a coordenação via um parágrafo em
         inglês no lugar da frase. */
      const r = await matricularAluno(escolhida, repetente.alunoId)
      if (!r.ok) {
        setError(r.erro)
        return
      }
      setFeito(true)
      router.refresh()
    })
  }

  return (
    <div className="min-w-[240px]">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-[11px] font-semibold text-gray-600">
            Refazer em qual turma
          </label>
          <select
            value={escolhida}
            onChange={(e) => setEscolhida(e.target.value)}
            className={`${CAMPO} campo-select`}
          >
            <option value="">Escolher turma…</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} · {t.modalidade === 'presencial' ? 'presencial' : 'EAD'}
                {t.status === 'planejada' ? ' · ainda não começou' : ''}
              </option>
            ))}
          </select>
        </div>
        <Botao icone="UserPlus" tamanho="sm" disabled={!escolhida || isPending} onClick={matricular}>
          {isPending ? 'Matriculando...' : 'Matricular'}
        </Botao>
      </div>
      {error && (
        <div className="mt-2">
          <Alerta>{error}</Alerta>
        </div>
      )}
    </div>
  )
}
