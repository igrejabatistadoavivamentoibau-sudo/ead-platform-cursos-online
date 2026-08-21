'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, Check, Monitor, Users } from 'lucide-react'
import { definirModuloDaTurma } from '@/app/dashboard/admin/actions'
import { Alerta, CAMPO } from '@/components/ui'

export interface ModuloEscolhivel {
  id: string
  nome: string
  ordem: number
  cursoTitulo: string
}

/* ============================================================
   A QUE MÓDULO ESTA TURMA PERTENCE — E SE ELA É PRESENCIAL OU EAD

   Duas escolhas que antes não existiam, e que juntas dão a forma pedida:

     Curso: Escola de Líderes
       Módulo 1  →  Turma A (presencial)   Turma B (EAD)
       Módulo 2  →  Turma C (presencial)   Turma D (EAD)

   A MODALIDADE MUDOU DE DONO, e isso conserta um defeito que estava
   rodando calado: ela era do CURSO. Num curso marcado como EAD, uma
   turma presencial recebia presença automática por vídeo assistido — ou
   seja, a frequência daquela turma estava errada e ninguém via. Agora
   quem responde pela modalidade é a turma, que é quem de fato se
   encontra (ou não) numa sala.
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
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const salvar = (novoModulo: string, novaModalidade: 'presencial' | 'ead') => {
    setError(null)
    startTransition(async () => {
      try {
        await definirModuloDaTurma(turmaId, {
          modulo_id: novoModulo || null,
          modalidade: novaModalidade,
        })
        setSalvo(true)
        setTimeout(() => setSalvo(false), 2200)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar.')
      }
    })
  }

  /* Agrupado por curso: numa escola com três cursos, uma lista corrida de
     módulos ("Módulo 1", "Módulo 1", "Módulo 2"...) seria impossível de
     ler. O nome do curso é o que dá sentido ao número. */
  const porCurso = new Map<string, ModuloEscolhivel[]>()
  for (const m of modulos) {
    porCurso.set(m.cursoTitulo, [...(porCurso.get(m.cursoTitulo) ?? []), m])
  }

  return (
    <div className="card-alive p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200">
          <Layers className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div>
          <h2 className="font-display text-[15px] font-bold text-gray-900">Módulo e modalidade</h2>
          <p className="text-[12px] text-gray-500">
            O módulo traz o curso junto — e é ele que define o pré-requisito de entrada.
          </p>
        </div>
        {salvo && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Salvo
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-gray-700">
            Módulo desta turma
          </label>
          {/* <select> cru em vez do componente Selecao: aqui os módulos
              precisam vir agrupados por curso (<optgroup>), e o componente
              compartilhado só aceita uma lista plana. */}
          <select
            value={modulo}
            disabled={isPending}
            onChange={(e) => {
              setModulo(e.target.value)
              salvar(e.target.value, modalidade)
            }}
            className={CAMPO}
          >
            <option value="">Sem módulo definido</option>
            {[...porCurso.entries()].map(([curso, lista]) => (
              <optgroup key={curso} label={curso}>
                {lista.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.ordem}. {m.nome}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-gray-700">
            Como esta turma acontece
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { valor: 'presencial' as const, rotulo: 'Presencial', Icone: Users, ajuda: 'chamada em sala' },
                { valor: 'ead' as const, rotulo: 'EAD', Icone: Monitor, ajuda: 'presença pelo vídeo' },
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
                className={`flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
                  modalidade === valor
                    ? 'border-brand-600 bg-brand-50/60'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
                  <Icone
                    className={`h-3.5 w-3.5 ${modalidade === valor ? 'text-brand-700' : 'text-gray-400'}`}
                    strokeWidth={2.2}
                  />
                  {rotulo}
                </span>
                <span className="text-[11.5px] text-gray-500">{ajuda}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {!modulo && (
        <p className="mt-3 text-[12px] text-amber-800">
          Sem módulo, esta turma não tem aulas nem pré-requisito. Escolha um módulo para ela
          receber o conteúdo do curso.
        </p>
      )}

      {error && (
        <div className="mt-3">
          <Alerta>{error}</Alerta>
        </div>
      )}
    </div>
  )
}
