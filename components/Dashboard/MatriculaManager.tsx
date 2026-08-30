'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, CornerUpRight, ArrowUpRight, Check } from 'lucide-react'
import { matricularAluno, removerMatricula, moverAluno } from '@/app/dashboard/admin/actions'
import { alunosQuePodemEntrar } from '@/lib/nucleo/matricula'
import { Selecao, Alerta } from '@/components/ui'

interface AlunoMatriculado {
  matriculaId: string
  id: string
  name: string
  email: string
}

interface AlunoDisponivel {
  id: string
  name: string
}

/* ============================================================
   MATRICULAR E DESMATRICULAR

   O DEFEITO QUE ESTA TELA TINHA, E COMO ELE FOI FECHADO

   A lista de opções recebia `disponiveis` — todos os alunos ativos da
   escola — em vez da lista já filtrada, que estava calculada logo acima e
   nunca era usada. Escolher alguém que JÁ estava na turma não era só
   possível: era o caminho mais fácil, porque a pessoa aparecia ali igual
   às outras. O banco recusava (existe uma trava contra matrícula
   repetida, e ela está certa) e a tela mostrava um parágrafo em inglês.

   O filtro virou função com nome e teste — `alunosQuePodemEntrar` — e
   agora existe UMA lista só nesta tela. Não sobrou a segunda variável
   parecida para ser passada por engano.
   ============================================================ */

export interface TurmaParaMover {
  id: string
  nome: string
  moduloId: string | null
  moduloNome: string
  mesmoModulo: boolean
  status: string
}

export default function MatriculaManager({
  turmaId,
  matriculados,
  disponiveis,
  turmasParaMover = [],
}: {
  turmaId: string
  matriculados: AlunoMatriculado[]
  disponiveis: AlunoDisponivel[]
  /** Outras turmas deste curso, para trocar ou avançar o aluno. */
  turmasParaMover?: TurmaParaMover[]
}) {
  const [selecionado, setSelecionado] = useState('')
  const [movido, setMovido] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const podemEntrar = useMemo(
    () => alunosQuePodemEntrar(disponiveis, matriculados),
    [disponiveis, matriculados]
  )

  const handleAdicionar = () => {
    if (!selecionado) return
    setError(null)
    startTransition(async () => {
      /* A ação DEVOLVE o motivo em vez de lançar. Exceção o Next apaga em
         produção; dado atravessa. */
      const r = await matricularAluno(turmaId, selecionado)
      if (!r.ok) {
        setError(r.erro)
        return
      }
      setSelecionado('')
      router.refresh()
    })
  }

  const handleMover = (matriculaId: string, destino: string) => {
    setError(null)
    setMovido(null)
    startTransition(async () => {
      const r = await moverAluno(matriculaId, destino)
      if (!r.ok) {
        setError(r.erro)
        return
      }
      setMovido(
        r.modo === 'trocou'
          ? `Trocado para a turma "${r.turma}".`
          : `Avançou para "${r.turma}". A matrícula anterior fica no histórico, com a aprovação dele.`
      )
      router.refresh()
    })
  }

  const handleRemover = (matriculaId: string) => {
    setError(null)
    startTransition(async () => {
      const r = await removerMatricula(turmaId, matriculaId)
      if (!r.ok) {
        setError(r.erro)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="card-alive p-5 sm:p-6">
      <h2 className="font-semibold text-gray-900 mb-4">
        Alunos matriculados ({matriculados.length})
      </h2>

      {matriculados.length > 0 ? (
        <ul className="divide-y divide-gray-100 mb-5" data-teste="matriculados">
          {matriculados.map((aluno) => (
            <li key={aluno.matriculaId} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{aluno.name}</p>
                <p className="text-xs text-gray-500">{aluno.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/* MOVER, em vez de desmatricular e rematricular.
                    Tirar e pôr de novo apaga a linha da matrícula — e com
                    ela a situação, a média final e a observação de
                    conclusão. Trocar alguém de horário não pode custar o
                    histórico dele. */}
                {turmasParaMover.length > 0 && (
                  <label className="inline-flex items-center gap-1.5">
                    <CornerUpRight className="h-3.5 w-3.5 text-gray-400" strokeWidth={2.25} />
                    <select
                      value=""
                      disabled={isPending}
                      data-teste="mover-aluno"
                      onChange={(e) => {
                        if (!e.target.value) return
                        const destino = e.target.value
                        e.target.value = ''
                        handleMover(aluno.matriculaId, destino)
                      }}
                      className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11.5px] font-medium text-gray-600 disabled:opacity-50"
                      aria-label={`Mover ${aluno.name} para outra turma`}
                    >
                      <option value="">mover para…</option>
                      {turmasParaMover.some((t) => t.mesmoModulo) && (
                        <optgroup label="Trocar de turma (mesma etapa)">
                          {turmasParaMover
                            .filter((t) => t.mesmoModulo)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.nome}
                              </option>
                            ))}
                        </optgroup>
                      )}
                      {turmasParaMover.some((t) => !t.mesmoModulo) && (
                        <optgroup label="Avançar de módulo">
                          {turmasParaMover
                            .filter((t) => !t.mesmoModulo)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.moduloNome} · {t.nome}
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRemover(aluno.matriculaId)}
                  className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Remover ${aluno.name} da turma`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 mb-5">Nenhum aluno matriculado ainda.</p>
      )}

      {podemEntrar.length > 0 ? (
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-100">
          <div className="flex-1" data-teste="escolher-aluno">
            <Selecao
              valorInicial={selecionado}
              aoMudar={setSelecionado}
              placeholder="Escolha um aluno"
              opcoes={podemEntrar.map((a) => ({ valor: a.id, rotulo: a.name }))}
            />
          </div>
          <button
            type="button"
            disabled={!selecionado || isPending}
            onClick={handleAdicionar}
            data-teste="matricular"
            className="inline-flex items-center justify-center gap-2 bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-800 transition-colors disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" strokeWidth={2.25} />
            {isPending ? 'Matriculando...' : 'Adicionar'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400 pt-4 border-t border-gray-100" data-teste="todos-dentro">
          {disponiveis.length === 0
            ? 'Nenhum aluno ativo cadastrado ainda.'
            : 'Todos os alunos cadastrados já estão nesta turma.'}
        </p>
      )}

      {movido && (
        <p
          className="mt-3 inline-flex items-start gap-1.5 rounded-xl bg-brand-50 p-3 text-[12.5px] font-medium leading-snug text-brand-800 ring-1 ring-brand-200"
          data-teste="aluno-movido"
        >
          <Check className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.6} />
          {movido}
        </p>
      )}

      {error && (
        <div
          className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm"
          data-teste="erro-da-matricula"
        >
          {error}
        </div>
      )}
    </div>
  )
}
