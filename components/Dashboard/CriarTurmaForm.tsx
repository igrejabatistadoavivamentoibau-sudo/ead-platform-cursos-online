'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, AlertTriangle, Video, Check, Users, Monitor } from 'lucide-react'
import { criarTurma } from '@/app/dashboard/admin/actions'
import { Alerta, Selecao } from '@/components/ui'
import type { ModuloEscolhivel } from '@/components/Dashboard/ModuloDaTurma'

interface Professor {
  id: string
  name: string
}

/* A receita do campo mora em app/globals.css, numa definição só. Existiam
   seis cópias quase iguais espalhadas pelo projeto, cada uma com um raio ou
   um anel de foco levemente diferente — ninguém aponta a diferença olhando
   uma tela por vez, e é justamente isso que dá a sensação de "feito à mão"
   no conjunto. */
const CAMPO = 'campo'

/* ============================================================
   NOVA TURMA — JÁ NASCENDO DENTRO DE UM CURSO-MÓDULO

   Antes esta tela criava turma com nome, professor e data, e mais nada.
   A turma nascia solta: sem curso, sem módulo, sem aulas. Para ligá-la
   ao conteúdo era preciso criar, abrir a turma e procurar o seletor lá
   dentro — e uma turma que ninguém abriu de novo ficava para sempre sem
   conteúdo, sem dar erro em lugar nenhum.

   Agora o vínculo é parte de criar. Curso primeiro, módulo depois:

     Escola de Líderes  →  1. Fundamentos   2. Caráter   3. Missão

   O cartão de cada módulo mostra quantas aulas já existem ali dentro,
   porque ligar a turma numa etapa vazia é o engano mais fácil de
   cometer — e o mais silencioso.
   ============================================================ */

export default function CriarTurmaForm({
  professores,
  modulos = [],
}: {
  professores: Professor[]
  modulos?: ModuloEscolhivel[]
}) {
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [professorId, setProfessorId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [modalidade, setModalidade] = useState<'presencial' | 'ead'>('ead')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const cursos = [...new Map(modulos.map((m) => [m.cursoId, m.cursoTitulo])).entries()]
  const [curso, setCurso] = useState(cursos[0]?.[0] ?? '')
  const [modulo, setModulo] = useState('')

  const doCurso = modulos.filter((m) => m.cursoId === curso).sort((a, b) => a.ordem - b.ordem)

  const limpar = () => {
    setNome('')
    setDescricao('')
    setProfessorId('')
    setDataInicio('')
    setModulo('')
    setModalidade('ead')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    startTransition(async () => {
      const r = await criarTurma({
        nome,
        descricao: descricao || undefined,
        professor_id: professorId || undefined,
        data_inicio: dataInicio || undefined,
        modulo_id: modulo || undefined,
        modalidade,
      })
      if (!r.ok) return setErro(r.erro)
      limpar()
      setOpen(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Criar turma
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card-alive mb-6 p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nome da turma</label>
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Turma 2026.2"
            className={CAMPO}
          />
        </div>

        {/* ---------- O vínculo com o conteúdo ---------- */}
        {modulos.length > 0 && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Curso</label>
              <select
                value={curso}
                onChange={(e) => {
                  setCurso(e.target.value)
                  setModulo('')
                }}
                className={`${CAMPO} campo-select`}
              >
                {cursos.map(([id, titulo]) => (
                  <option key={id} value={id}>
                    {titulo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Como esta turma acontece
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { valor: 'presencial' as const, rotulo: 'Presencial', Icone: Users },
                    { valor: 'ead' as const, rotulo: 'EAD', Icone: Monitor },
                  ]
                ).map(({ valor, rotulo, Icone }) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setModalidade(valor)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                      modalidade === valor
                        ? 'border-brand-600 bg-brand-50/60 text-gray-900'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icone
                      className={`h-3.5 w-3.5 ${
                        modalidade === valor ? 'text-brand-700' : 'text-gray-400'
                      }`}
                      strokeWidth={2.2}
                    />
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Módulo desta turma
              </label>
              {doCurso.length === 0 ? (
                <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] text-amber-800 ring-1 ring-amber-200">
                  Este curso ainda não tem módulos. Crie o primeiro na tela do curso — é o módulo
                  que guarda as aulas.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {doCurso.map((m) => {
                    const marcado = modulo === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModulo(marcado ? '' : m.id)}
                        className={`flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
                          marcado
                            ? 'border-brand-600 bg-brand-50/60'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-display text-[13px] font-bold ${
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
                            className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${
                              m.aulas === 0 ? 'font-medium text-amber-700' : 'text-gray-500'
                            }`}
                          >
                            {m.aulas === 0 ? (
                              <>
                                <AlertTriangle className="h-3 w-3" strokeWidth={2.25} />
                                sem aulas
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
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-brand-700"
                            strokeWidth={2.6}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
              {!modulo && doCurso.length > 0 && (
                <p className="mt-1.5 text-[11.5px] text-amber-800">
                  Sem módulo, a turma é criada sem conteúdo nenhum: os alunos entram e não
                  encontram aula. Dá para escolher depois, mas é aqui que se lembra.
                </p>
              )}
            </div>
          </>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Professor responsável
          </label>
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
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Data de início (opcional)
          </label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className={CAMPO}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Descrição (opcional)
          </label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: encontros às terças, 19h30"
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
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
        >
          {isPending ? 'Criando...' : 'Criar turma'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
