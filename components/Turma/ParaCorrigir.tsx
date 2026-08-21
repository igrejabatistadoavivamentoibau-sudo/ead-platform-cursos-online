import Link from 'next/link'
import { FileCheck2, ArrowRight, Clock, CheckCheck } from 'lucide-react'
import { momentoPorExtenso } from '@/lib/janelaDaAtividade'

/* ============================================================
   A CAIXA DE CORREÇÕES

   O PROBLEMA QUE ELA RESOLVE
   Até agora o professor não tinha como saber que chegou trabalho. Ele
   precisava entrar em cada turma, abrir Atividades, e abrir atividade por
   atividade para descobrir se alguém tinha entregado. Na prática isso
   significa trabalho parado por semanas — não por descaso, por não ter
   como saber.

   Agora são dois caminhos, e os dois importam:
   - o aviso chega sozinho (gatilho no banco manda a notificação na hora
     em que o aluno entrega);
   - e esta caixa mostra o acumulado, porque quem passou uma semana sem
     entrar perdeu os avisos e precisa ver a pilha.

   O QUE MOSTRA E POR QUÊ NESSA ORDEM
   O que esperou mais aparece primeiro. Não é detalhe: o aluno que entregou
   há três semanas é o que está sofrendo com a demora, e ordenar pelo mais
   recente esconderia exatamente ele.
   ============================================================ */

export interface EntregaPendente {
  entregaId: string
  alunoNome: string
  atividadeTitulo: string
  turmaId: string
  turmaNome: string
  entregueEm: string
  anexos: number
}

export default function ParaCorrigir({ pendentes }: { pendentes: EntregaPendente[] }) {
  if (!pendentes.length) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-brand-50/60 px-5 py-4 ring-1 ring-brand-200/70">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 ring-1 ring-brand-200">
          <CheckCheck className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div>
          <p className="text-[13.5px] font-semibold text-brand-900">Nenhuma entrega esperando</p>
          <p className="text-[12px] text-brand-800/70">
            Tudo o que os alunos mandaram já foi corrigido.
          </p>
        </div>
      </div>
    )
  }

  /* Mais de dez na tela vira parede de texto e ninguém lê nenhuma. O resto
     continua na tela da turma, e o número no topo não esconde nada. */
  const mostrados = pendentes.slice(0, 10)
  const restantes = pendentes.length - mostrados.length

  return (
    <div className="card-alive overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
          <FileCheck2 className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-gray-900">
            Entregas esperando correção
          </h2>
          <p className="text-[12px] text-gray-500">
            <span className="font-semibold tabular-nums text-gray-700">{pendentes.length}</span>{' '}
            {pendentes.length === 1 ? 'trabalho aguardando' : 'trabalhos aguardando'} · o mais antigo
            primeiro
          </p>
        </div>
      </div>

      <ul className="divide-y divide-gray-100">
        {mostrados.map((p) => (
          <li key={p.entregaId}>
            <Link
              href={`/dashboard/professor/turmas/${p.turmaId}/atividades`}
              className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-gray-50/70"
            >
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-gray-800">
                  {p.alunoNome}
                </p>
                <p className="truncate text-[12.5px] text-gray-500">
                  {p.atividadeTitulo} · {p.turmaNome}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-gray-400">
                  <Clock className="h-3 w-3 shrink-0" strokeWidth={2.2} />
                  entregue em {momentoPorExtenso(p.entregueEm)}
                  {p.anexos > 0 &&
                    ` · ${p.anexos} ${p.anexos === 1 ? 'arquivo' : 'arquivos'}`}
                </p>
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
                strokeWidth={2.2}
              />
            </Link>
          </li>
        ))}
      </ul>

      {restantes > 0 && (
        <p className="border-t border-gray-100 px-5 py-2.5 text-[12px] text-gray-500">
          e mais {restantes} — abra a turma para ver todas.
        </p>
      )}
    </div>
  )
}
