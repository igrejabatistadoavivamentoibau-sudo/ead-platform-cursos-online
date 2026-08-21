'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, TriangleAlert, RotateCcw, Check, X } from 'lucide-react'
import { concluirTurma, reabrirConclusao, type DecisaoDeConclusao } from '@/app/dashboard/professor/actions'
import { NOTA_DE_APROVACAO } from '@/lib/boletim'
import { Botao, Card, Alerta, Selo, CAMPO } from '@/components/ui'

export interface AlunoParaConcluir {
  alunoId: string
  nome: string
  /** A média calculada pela plataforma, na escala 0–10. */
  mediaCalculada: number | null
  itensContados: number
  frequencia: number | null
  situacao: 'cursando' | 'aprovado' | 'reprovado' | 'desistente'
  mediaFinal: number | null
  observacao: string | null
  concluidaEm: string | null
}

type Linha = {
  media: string
  situacao: 'aprovado' | 'reprovado' | 'desistente'
  observacao: string
}

/* ============================================================
   FECHAR A TURMA

   A REGRA: aprovado a partir de 7. Abaixo disso, reprovado — e reprovado
   NÃO é o fim da linha: vira candidato a repetir, e a coordenação decide
   em qual turma ele entra.

   POR QUE A MÉDIA VEM PREENCHIDA, MAS EDITÁVEL
   A plataforma calcula, porque calcular à mão trinta médias ponderadas é
   onde o erro acontece. Mas a escola é de gente: existe o aluno que
   perdeu a prova por um enterro na família, o que fez tudo e travou num
   trabalho. Uma régua sem exceção é uma régua que alguém contorna por
   fora da plataforma — e aí o registro passa a mentir.

   Então a exceção existe e é escrita: aprovar abaixo de 7 exige o motivo
   no campo de observação, e o servidor recusa sem ele.

   POR QUE NÃO É AUTOMÁTICO
   Fechar turma decide se uma pessoa avança ou repete um semestre. Isso é
   um ato de alguém, com nome. A plataforma sugere; quem assina é o
   professor.
   ============================================================ */

function tomDaMedia(m: number | null) {
  if (m === null) return 'neutro' as const
  return m >= NOTA_DE_APROVACAO ? ('verde' as const) : ('vermelho' as const)
}

export default function ConcluirTurma({
  turmaId,
  alunos,
}: {
  turmaId: string
  alunos: AlunoParaConcluir[]
}) {
  const [linhas, setLinhas] = useState<Record<string, Linha>>(() => {
    const inicial: Record<string, Linha> = {}
    for (const a of alunos) {
      const m = a.mediaFinal ?? a.mediaCalculada
      inicial[a.alunoId] = {
        media: m === null ? '' : String(m),
        situacao:
          a.situacao !== 'cursando'
            ? (a.situacao as Linha['situacao'])
            : m !== null && m >= NOTA_DE_APROVACAO
              ? 'aprovado'
              : 'reprovado',
        observacao: a.observacao ?? '',
      }
    }
    return inicial
  })
  const [encerrar, setEncerrar] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const acao = (fn: () => Promise<unknown>, aoTerminar?: () => void) => {
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

  const mudar = (id: string, campo: keyof Linha, valor: string) =>
    setLinhas((l) => ({ ...l, [id]: { ...l[id], [campo]: valor } as Linha }))

  /* Mudar a nota re-sugere a situação. É o comportamento que a pessoa
     espera: digitou 8, o selo vira "aprovado" sozinho. Ela ainda pode
     trocar depois — a sugestão não trava nada. */
  const mudarMedia = (id: string, valor: string) =>
    setLinhas((l) => {
      const n = valor.trim() === '' ? null : Number(valor.replace(',', '.'))
      const situacao =
        l[id].situacao === 'desistente'
          ? 'desistente'
          : n !== null && !Number.isNaN(n) && n >= NOTA_DE_APROVACAO
            ? 'aprovado'
            : 'reprovado'
      return { ...l, [id]: { ...l[id], media: valor, situacao } }
    })

  const enviar = () => {
    const decisoes: DecisaoDeConclusao[] = alunos.map((a) => {
      const l = linhas[a.alunoId]
      const bruto = l.media.trim().replace(',', '.')
      return {
        alunoId: a.alunoId,
        media: bruto === '' ? null : Number(bruto),
        situacao: l.situacao,
        frequencia: a.frequencia,
        observacao: l.observacao,
      }
    })
    acao(() => concluirTurma(turmaId, decisoes, { encerrarTurma: encerrar }), () => {
      setSalvo(true)
      setTimeout(() => setSalvo(false), 4000)
    })
  }

  const aprovados = alunos.filter((a) => linhas[a.alunoId]?.situacao === 'aprovado').length
  const reprovados = alunos.filter((a) => linhas[a.alunoId]?.situacao === 'reprovado').length
  const jaConcluidos = alunos.filter((a) => a.situacao !== 'cursando').length

  if (!alunos.length) {
    return (
      <Alerta tom="info">
        Nenhum aluno ativo nesta turma. Matricule alunos antes de fechar o módulo.
      </Alerta>
    )
  }

  return (
    <div className="space-y-4">
      {error && <Alerta>{error}</Alerta>}
      {salvo && <Alerta tom="sucesso">Situação registrada e avisada aos alunos.</Alerta>}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-gray-900">
              <GraduationCap className="h-4.5 w-4.5 text-brand-700" strokeWidth={2.2} />
              Fechar o módulo
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-gray-500">
              A média vem calculada de tudo o que foi lançado — avaliações e atividades, todas
              trazidas para a escala de 0 a 10. Aprovação a partir de{' '}
              <b>{NOTA_DE_APROVACAO.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</b>. Você
              pode ajustar qualquer número antes de confirmar; abaixo de{' '}
              {NOTA_DE_APROVACAO.toLocaleString('pt-BR')}, aprovar exige escrever o motivo.
            </p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="font-display text-[22px] font-bold tabular-nums text-brand-700">
                {aprovados}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Aprovados
              </p>
            </div>
            <div>
              <p className="font-display text-[22px] font-bold tabular-nums text-red-600">
                {reprovados}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Repetem
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <ul className="divide-y divide-gray-100">
          {alunos.map((a) => {
            const l = linhas[a.alunoId]
            const abaixo =
              l.situacao === 'aprovado' &&
              l.media.trim() !== '' &&
              Number(l.media.replace(',', '.')) < NOTA_DE_APROVACAO

            return (
              <li key={a.alunoId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-gray-900">{a.nome}</p>
                    <p className="mt-0.5 text-[12px] text-gray-500">
                      {a.mediaCalculada === null ? (
                        <>sem notas suficientes para calcular</>
                      ) : (
                        <>
                          calculado:{' '}
                          <b className="tabular-nums text-gray-700">
                            {a.mediaCalculada.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
                          </b>{' '}
                          de {a.itensContados}{' '}
                          {a.itensContados === 1 ? 'avaliação' : 'avaliações'}
                        </>
                      )}
                      {a.frequencia !== null && ` · frequência ${a.frequencia}%`}
                    </p>
                    {a.situacao !== 'cursando' && (
                      <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-gray-400">
                        <Check className="h-3 w-3" strokeWidth={2.4} />
                        já fechado
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => acao(() => reabrirConclusao(turmaId, a.alunoId))}
                          className="inline-flex items-center gap-1 font-semibold text-brand-700 underline underline-offset-2"
                        >
                          <RotateCcw className="h-3 w-3" strokeWidth={2.4} />
                          reabrir
                        </button>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-gray-600">
                        Média final
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={l.media}
                        onChange={(e) => mudarMedia(a.alunoId, e.target.value)}
                        className="h-9 w-20 rounded-lg border border-gray-200 bg-gray-50/60 px-3 text-center text-[13px] tabular-nums focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-gray-600">
                        Situação
                      </label>
                      <select
                        value={l.situacao}
                        onChange={(e) => mudar(a.alunoId, 'situacao', e.target.value)}
                        className="h-9 rounded-lg border border-gray-200 bg-gray-50/60 px-2.5 text-[13px] focus:border-brand-500 focus:bg-white focus:outline-none"
                      >
                        <option value="aprovado">Aprovado</option>
                        <option value="reprovado">Reprovado — repete</option>
                        <option value="desistente">Desistente</option>
                      </select>
                    </div>
                    <Selo tom={tomDaMedia(a.mediaCalculada)}>
                      {l.situacao === 'aprovado'
                        ? 'passa para o próximo módulo'
                        : l.situacao === 'reprovado'
                          ? 'candidato a repetir'
                          : 'fora da turma'}
                    </Selo>
                  </div>
                </div>

                {(abaixo || l.observacao) && (
                  <div className="mt-2.5">
                    {abaixo && (
                      <p className="mb-1.5 flex items-start gap-1.5 text-[12px] font-medium text-amber-800">
                        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                        Aprovação abaixo de {NOTA_DE_APROVACAO.toLocaleString('pt-BR')}: escreva o
                        motivo. Fica registrado com o seu nome.
                      </p>
                    )}
                    <input
                      type="text"
                      value={l.observacao}
                      onChange={(e) => mudar(a.alunoId, 'observacao', e.target.value)}
                      placeholder="Motivo / observação (o aluno vê no aviso)"
                      className={CAMPO}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={encerrar}
            onChange={(e) => setEncerrar(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-700 focus:ring-brand-500"
          />
          <span className="text-[13px] text-gray-700">
            Marcar a turma como <b>encerrada</b>
            <span className="block text-[12px] text-gray-500">
              Desmarque se ainda faltam alunos para fechar — dá para concluir em partes e voltar
              aqui depois.
            </span>
          </span>
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Botao icone="GraduationCap" disabled={isPending} onClick={enviar}>
            {isPending ? 'Registrando...' : 'Confirmar e avisar os alunos'}
          </Botao>
          {jaConcluidos > 0 && (
            <span className="text-[12px] text-gray-500">
              {jaConcluidos} de {alunos.length} já {jaConcluidos === 1 ? 'fechado' : 'fechados'}
            </span>
          )}
        </div>
      </Card>
    </div>
  )
}
