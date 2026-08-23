'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Layers, Check, Monitor, Users, Video, ArrowRight, AlertTriangle } from 'lucide-react'
import { definirModuloDaTurma } from '@/app/dashboard/admin/actions'

export interface ModuloEscolhivel {
  id: string
  nome: string
  ordem: number
  cursoId: string
  cursoTitulo: string
  /** Quantas vídeo aulas existem neste módulo hoje. */
  aulas: number
}

const CAMPO =
  'w-full px-3.5 py-2.5 bg-gray-50/60 border border-gray-200 rounded-xl text-[15px] transition-all focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500'

/* ============================================================
   A QUE CURSO-MÓDULO ESTA TURMA PERTENCE

   A escolha é feita em DOIS PASSOS, e não numa lista só:

     1) o CURSO      — Escola de Líderes, Discipulado, ...
     2) o MÓDULO     — 1. Fundamentos   2. Caráter   3. Missão

   Antes era um <select> único com todos os módulos de todos os cursos
   agrupados. Funcionava, mas escondia a decisão: a coordenação lia
   "Módulo 1", "Módulo 1", "Módulo 2" numa fila e precisava confiar no
   agrupamento para saber de que curso era cada um. Escolher a turma
   errada de módulo não dá erro nenhum — só faz aparecer o conteúdo
   errado para uma sala inteira, e ninguém percebe até a primeira aula.

   Por isso o segundo passo é um cartão por módulo, e não um campo: o
   cartão mostra a ORDEM (que é o pré-requisito) e QUANTAS AULAS já
   existem ali dentro. Módulo vazio aparece marcado — é o erro mais
   comum, ligar a turma numa etapa que ainda não tem conteúdo.

   A MODALIDADE É DA TURMA, não do curso. Num curso marcado como EAD,
   uma turma presencial recebia presença automática por vídeo assistido
   — ou seja, a frequência daquela turma estava errada e ninguém via.
   Quem responde pela modalidade é quem de fato se encontra (ou não)
   numa sala: a turma.
   ============================================================ */

export default function ModuloDaTurma({
  turmaId,
  moduloAtual,
  modalidadeAtual,
  modulos,
}: {
  turmaId: string
  moduloAtual: string | null
  modalidadeAtual: 'presencial' | 'ead'
  modulos: ModuloEscolhivel[]
}) {
  const [modulo, setModulo] = useState(moduloAtual ?? '')
  const [modalidade, setModalidade] = useState<'presencial' | 'ead'>(modalidadeAtual)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const escolhido = modulos.find((m) => m.id === modulo) ?? null

  /* O curso começa no do módulo já escolhido. Numa turma nova, no
     primeiro curso da lista — nunca em branco, porque um segundo passo
     vazio parece que a tela quebrou. */
  const cursos = [...new Map(modulos.map((m) => [m.cursoId, m.cursoTitulo])).entries()]
  const [curso, setCurso] = useState(escolhido?.cursoId ?? cursos[0]?.[0] ?? '')

  const doCurso = modulos
    .filter((m) => m.cursoId === curso)
    .sort((a, b) => a.ordem - b.ordem)

  const salvar = (novoModulo: string, novaModalidade: 'presencial' | 'ead') => {
    setErro(null)
    startTransition(async () => {
      /* A ação DEVOLVE o motivo em vez de lançá-lo: exceção lançada de
         Server Action o Next apaga em produção, e a frase escrita aqui
         chegaria à coordenação como um parágrafo em inglês. */
      const r = await definirModuloDaTurma(turmaId, {
        modulo_id: novoModulo || null,
        modalidade: novaModalidade,
      })
      if (!r.ok) return setErro(r.erro)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2200)
      router.refresh()
    })
  }

  return (
    <div className="card-alive p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200">
          <Layers className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-gray-900">
            Curso e módulo desta turma
          </h2>
          <p className="text-[12px] text-gray-500">
            É o módulo que traz as vídeo aulas — e é a ordem dele que define o pré-requisito de
            entrada.
          </p>
        </div>
        {salvo && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-brand-700">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Salvo
          </span>
        )}
      </div>

      {/* ---------- Passo 1: o curso ---------- */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[12px] font-semibold text-gray-700">
          1. De qual curso é esta turma
        </label>
        <select
          value={curso}
          disabled={isPending}
          onChange={(e) => setCurso(e.target.value)}
          className={CAMPO}
        >
          {cursos.length === 0 && <option value="">Nenhum curso com módulos ainda</option>}
          {cursos.map(([id, titulo]) => (
            <option key={id} value={id}>
              {titulo}
            </option>
          ))}
        </select>
      </div>

      {/* ---------- Passo 2: o módulo ---------- */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[12px] font-semibold text-gray-700">
          2. Em que módulo ela entra
        </label>

        {doCurso.length === 0 ? (
          <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] text-amber-800 ring-1 ring-amber-200">
            Este curso ainda não tem módulos. Crie o primeiro na tela do curso — é o módulo que
            guarda as aulas.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {doCurso.map((m) => {
              const marcado = modulo === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setModulo(m.id)
                    salvar(m.id, modalidade)
                  }}
                  className={`flex items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                    marcado
                      ? 'border-brand-600 bg-brand-50/60'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-[14px] font-bold ${
                      marcado
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200'
                    }`}
                  >
                    {m.ordem}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-gray-900">
                      {m.nome}
                    </span>
                    <span
                      className={`mt-0.5 inline-flex items-center gap-1 text-[11.5px] ${
                        m.aulas === 0 ? 'font-medium text-amber-700' : 'text-gray-500'
                      }`}
                    >
                      {m.aulas === 0 ? (
                        <>
                          <AlertTriangle className="h-3 w-3" strokeWidth={2.25} />
                          sem aulas ainda
                        </>
                      ) : (
                        <>
                          <Video className="h-3 w-3" strokeWidth={2.25} />
                          {m.aulas} {m.aulas === 1 ? 'aula' : 'aulas'}
                        </>
                      )}
                    </span>
                  </span>
                  {marcado && (
                    <Check className="mt-1 h-4 w-4 shrink-0 text-brand-700" strokeWidth={2.6} />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {escolhido && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="text-gray-500">
              Hoje esta turma recebe as aulas de{' '}
              <b className="text-gray-700">
                {escolhido.ordem}. {escolhido.nome}
              </b>{' '}
              ({escolhido.cursoTitulo}).
              {/* Olhar outro curso na lista não muda a turma. Sem esta
                  frase, ver os módulos de "Novos Convertidos" na tela e o
                  resumo falando de "Escola de Líderes" parece defeito. */}
              {escolhido.cursoId !== curso && ' Você está olhando outro curso — clique num módulo para trocar.'}
            </span>
            <Link
              href={`/dashboard/admin/cursos/${escolhido.cursoId}`}
              className="group inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800"
            >
              Ver e anexar as aulas
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                strokeWidth={2.25}
              />
            </Link>
          </div>
        )}
      </div>

      {/* ---------- Modalidade ---------- */}
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-gray-700">
          3. Como esta turma acontece
        </label>
        <div className="grid max-w-md grid-cols-2 gap-2">
          {(
            [
              {
                valor: 'presencial' as const,
                rotulo: 'Presencial',
                Icone: Users,
                ajuda: 'chamada em sala',
              },
              {
                valor: 'ead' as const,
                rotulo: 'EAD',
                Icone: Monitor,
                ajuda: 'presença pelo vídeo',
              },
            ]
          ).map(({ valor, rotulo, Icone, ajuda }) => (
            <button
              key={valor}
              type="button"
              disabled={isPending}
              onClick={() => {
                setModalidade(valor)
                salvar(modulo, valor)
              }}
              className={`flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                modalidade === valor
                  ? 'border-brand-600 bg-brand-50/60'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
                <Icone
                  className={`h-3.5 w-3.5 ${
                    modalidade === valor ? 'text-brand-700' : 'text-gray-400'
                  }`}
                  strokeWidth={2.2}
                />
                {rotulo}
              </span>
              <span className="text-[11.5px] text-gray-500">{ajuda}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11.5px] text-gray-500">
          Presencial e EAD do mesmo módulo convivem: são duas turmas, cada uma com a sua forma de
          contar presença, estudando o mesmo conteúdo.
        </p>
      </div>

      {!modulo && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800 ring-1 ring-amber-200">
          Enquanto esta turma não estiver ligada a um módulo, ela não tem aulas nem pré-requisito —
          os alunos entram e não encontram conteúdo nenhum.
        </p>
      )}

      {erro && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-px h-[18px] w-[18px] shrink-0" strokeWidth={2.25} />
          {erro}
        </div>
      )}
    </div>
  )
}
