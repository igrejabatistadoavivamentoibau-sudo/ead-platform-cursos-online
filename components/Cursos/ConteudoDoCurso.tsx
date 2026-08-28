'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  PenLine,
  Trash2,
  X,
  Search,
  Layers,
  Video,
  Users2,
  AlertTriangle,
  CornerUpRight,
  BookMarked,
} from 'lucide-react'
import {
  criarModulo,
  renomearModulo,
  moverModulo,
  removerModulo,
  moverAulaDeModulo,
  criarDisciplina,
  renomearDisciplina,
  moverDisciplina,
  removerDisciplina,
  moverAulasParaDisciplina,
} from '@/app/dashboard/admin/actions'
import BoasVindasDoModulo from '@/components/Cursos/BoasVindasDoModulo'
import LinhaDaAula, { type AulaItem } from '@/components/Aulas/LinhaDaAula'
import NovaAula from '@/components/Aulas/NovaAula'
import AulaAvulsaForm from '@/components/Aulas/AulaAvulsaForm'
import { Alerta } from '@/components/ui'

export interface DisciplinaComAulas {
  id: string
  nome: string
  ordem: number
  /** Nasceu junto com o módulo. Enquanto for só ela, o degrau não aparece. */
  padrao: boolean
  aulas: AulaItem[]
}

export interface ModuloComAulas {
  id: string
  nome: string
  descricao: string | null
  ordem: number
  /** Quantas turmas estão penduradas neste módulo. */
  turmas: number
  /** Link do vídeo de boas-vindas do módulo, se houver (migração 031). */
  video_boas_vindas?: string | null
  /** As matérias do módulo, em ordem. Sempre tem pelo menos uma. */
  disciplinas: DisciplinaComAulas[]
  /** Todas as aulas do módulo, planas. Serve para contagem e para a busca. */
  aulas: AulaItem[]
}

/* ------------------------------------------------------------------
   O DEGRAU DA DISCIPLINA APARECE SEMPRE — E POR QUÊ ISSO MUDOU

   Até aqui esta função escondia o degrau enquanto o módulo tivesse só a
   matéria automática. A ideia era poupar um clique no curso simples.

   Ela mudou a pedido: *"Módulo é só um nome, as disciplinas que têm as
   aulas."* E o pedido está certo por um motivo que a tela anterior
   escondia: com o degrau ora visível ora não, a coordenação aprendia
   DUAS estruturas diferentes conforme o módulo. No módulo A a aula ficava
   solta; no módulo B ficava dentro de uma matéria. O lugar de anexar
   mudava de módulo para módulo, que é exatamente a queixa que originou
   toda esta parte do trabalho.

   Agora é sempre o mesmo caminho: módulo → matéria → aula. O módulo passa
   a ter o que é dele — nome, recado e o vídeo de boas-vindas.

   A função continua existindo, e continua exportada, porque a TELA DO
   ALUNO usa outro critério: lá a faixa da matéria só aparece quando ela
   informa alguma coisa (mais de uma matéria no módulo). Mostrar
   "Conteúdo do módulo" para o aluno seria ruído, não estrutura.
   ------------------------------------------------------------------ */
export function mostrarDisciplinas(m: { disciplinas: DisciplinaComAulas[] }): boolean {
  const d = m.disciplinas ?? []
  return d.length > 1 || d.some((x) => !x.padrao)
}

/* A receita do campo mora em app/globals.css, numa definição só. Existiam
   seis cópias quase iguais espalhadas pelo projeto, cada uma com um raio ou
   um anel de foco levemente diferente — ninguém aponta a diferença olhando
   uma tela por vez, e é justamente isso que dá a sensação de "feito à mão"
   no conjunto. */
const CAMPO = 'campo'

const VAZIO = { nome: '', descricao: '' }

/* ============================================================
   O CONTEÚDO DO CURSO — UMA ÁRVORE SÓ

   Antes esta página tinha DUAS listas mostrando as mesmas aulas: uma
   "Módulos do curso", que servia para organizar, e uma "Vídeo aulas do
   curso", plana, que servia para anexar. Quem chegava aqui via a mesma
   aula duas vezes e não sabia em qual das duas mexer — "fica tudo
   misturado e eu não sei por onde eu anexo e vejo".

   Agora existe um lugar só, e ele tem a forma da escola:

     Módulo 1 — Fundamentos          3 aulas · 2 turmas
       Aula 1 ...  [publicar] [editar] [material de apoio]
       Aula 2 ...
       + Adicionar aula em Módulo 1
     Módulo 2 — ...

   Duas decisões que sustentam isso:

   1. ANEXAR ACONTECE ONDE SE VÊ. O botão de nova aula fica DENTRO da
      seção do módulo, e o material de apoio dentro da linha da aula. Não
      há um segundo lugar para procurar, e não há campo "módulo" para
      preencher errado — o módulo é o lugar onde a pessoa clicou.

   2. MÓDULO FECHADO CONTINUA CONTANDO. O cabeçalho diz quantas aulas e
      quantas turmas tem lá dentro mesmo fechado. Fechar para caber na
      tela não pode virar esconder o que existe.
   ============================================================ */

export default function ConteudoDoCurso({
  cursoId,
  modulos,
  semModulo = [],
  totalAlunos,
  podeEditarModulos,
}: {
  cursoId: string
  modulos: ModuloComAulas[]
  /** Aulas soltas, de antes de os módulos existirem. O aluno não as vê. */
  semModulo?: AulaItem[]
  totalAlunos: number
  /** A coordenação organiza módulos; o professor só dá aula dentro deles. */
  podeEditarModulos: boolean
}) {
  const [busca, setBusca] = useState('')
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState(VAZIO)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const emOrdem = useMemo(() => [...modulos].sort((a, b) => a.ordem - b.ordem), [modulos])
  const totalAulas = emOrdem.reduce((s, m) => s + m.aulas.length, 0) + semModulo.length

  /* Aberto por padrão quando o curso cabe na cabeça de uma vez. Num curso
     grande, só o primeiro — abrir tudo devolveria a parede de cards que
     esta tela existe para acabar. */
  const abertoPorPadrao = useMemo(() => {
    const abrirTudo = emOrdem.length <= 3 || totalAulas <= 12
    return new Set(abrirTudo ? emOrdem.map((m) => m.id) : emOrdem.slice(0, 1).map((m) => m.id))
  }, [emOrdem, totalAulas])

  const [abertos, setAbertos] = useState<Set<string>>(abertoPorPadrao)

  /* A escolha de quais módulos ficam abertos sobrevive a ir numa aula e
     voltar. Lida depois da montagem de propósito: ler no primeiro render
     faria o HTML do servidor e o do navegador divergirem. */
  const chave = `ibau:modulos-abertos:${cursoId}`
  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem(chave)
      if (salvo) setAbertos(new Set(JSON.parse(salvo) as string[]))
    } catch {
      /* Navegador sem sessionStorage: segue com o padrão. */
    }
  }, [chave])

  const alternar = (id: string) => {
    setAbertos((antes) => {
      const novo = new Set(antes)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      try {
        sessionStorage.setItem(chave, JSON.stringify([...novo]))
      } catch {
        /* sem sessionStorage, a escolha só vale nesta tela */
      }
      return novo
    })
  }

  const acao = (
    fn: () => Promise<{ ok: true } | { ok: false; erro: string }>,
    aoTerminar?: () => void
  ) => {
    setErro(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) return setErro(r.erro)
      aoTerminar?.()
      router.refresh()
    })
  }

  const fechar = () => {
    setCriando(false)
    setEditando(null)
    setForm(VAZIO)
  }

  /* A busca atravessa os módulos. É o segundo lado de "não sei onde vejo":
     numa escola com quatro módulos, achar "a aula do batismo" não pode
     depender de lembrar em qual etapa ela ficou. */
  const termo = busca.trim().toLowerCase()
  const bate = (a: AulaItem) =>
    !termo ||
    a.titulo.toLowerCase().includes(termo) ||
    (a.descricao ?? '').toLowerCase().includes(termo)

  const encontrados = termo
    ? emOrdem
        .map((m) => ({
          ...m,
          aulas: m.aulas.filter(bate),
          disciplinas: (m.disciplinas ?? []).map((d) => ({ ...d, aulas: d.aulas.filter(bate) })),
        }))
        .filter((m) => m.aulas.length > 0 || m.nome.toLowerCase().includes(termo))
    : emOrdem

  const achou = encontrados.reduce((s, m) => s + m.aulas.length, 0)

  return (
    <div className="space-y-4">
      {/* ---------- Cabeçalho ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-bold text-gray-900">Conteúdo do curso</h2>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-gray-500">
            {podeEditarModulos ? (
              <>
                Cada módulo é uma etapa, e as aulas moram dentro dele. A turma também pertence a um
                módulo — é o que permite várias turmas de primeiro módulo e várias de segundo ao
                mesmo tempo. <b>A ordem decide o pré-requisito:</b> só entra numa turma do módulo
                seguinte quem foi aprovado no anterior.
              </>
            ) : (
              <>
                As aulas ficam dentro do módulo a que pertencem. O aluno vê as aulas do módulo da
                turma dele — por isso a aula é criada <b>dentro</b> de um módulo, e o material de
                apoio, dentro da aula.
              </>
            )}
          </p>
          <p className="mt-1.5 text-[12px] font-medium text-gray-400">
            {emOrdem.length} {emOrdem.length === 1 ? 'módulo' : 'módulos'} · {totalAulas}{' '}
            {totalAulas === 1 ? 'aula' : 'aulas'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalAulas > 4 && (
            <label className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                strokeWidth={2}
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar aula"
                aria-label="Buscar aula em todos os módulos"
                className="w-52 rounded-xl border border-gray-200 bg-gray-50/60 py-2 pl-9 pr-3 text-[13px] transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
              />
            </label>
          )}
          {podeEditarModulos && !criando && editando === null && (
            <button
              type="button"
              onClick={() => {
                setForm(VAZIO)
                setCriando(true)
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-[13px] font-semibold text-gray-700 ring-1 ring-gray-200 transition-all hover:text-brand-800 hover:ring-brand-300 active:scale-[0.98]"
            >
              <Layers className="h-4 w-4 text-brand-600" strokeWidth={2.25} />
              Novo módulo
            </button>
          )}
        </div>
      </div>

      {erro && (
        <Alerta>{erro}</Alerta>
      )}

      {termo && (
        <p className="text-[12.5px] text-gray-500">
          {achou === 0
            ? 'Nenhuma aula com esse nome.'
            : `${achou} ${achou === 1 ? 'aula encontrada' : 'aulas encontradas'} — os módulos com resultado estão abertos.`}
        </p>
      )}

      {/* ---------- Criar / renomear módulo ---------- */}
      {podeEditarModulos && (criando || editando !== null) && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (criando) acao(() => criarModulo(cursoId, form), fechar)
            else acao(() => renomearModulo(editando!, cursoId, form), fechar)
          }}
          className="card-alive p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-[14.5px] font-bold text-gray-900">
              {criando ? 'Novo módulo' : 'Renomear módulo'}
            </h3>
            <button
              type="button"
              onClick={fechar}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-gray-700">Nome</label>
              <input
                type="text"
                required
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Módulo 2 — Fundamentos da liderança"
                className={CAMPO}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-gray-700">
                Descrição (opcional)
              </label>
              <input
                type="text"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Uma linha sobre o que se estuda aqui"
                className={CAMPO}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-brand-700 hover:bg-brand-800 active:bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white transition-all shadow-sm disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={fechar}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* ---------- Curso ainda sem módulo nenhum ---------- */}
      {emOrdem.length === 0 && (
        <div className="card-alive p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700">
            <Layers className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="font-medium text-gray-700">Este curso ainda não tem módulos.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            O módulo é a etapa do curso — é nele que as aulas moram e é a ele que a turma se liga.
            {podeEditarModulos
              ? ' Crie o primeiro em “Novo módulo”.'
              : ' Peça à coordenação para criar o primeiro.'}
          </p>
        </div>
      )}

      {/* ---------- Os módulos ---------- */}
      <div className="space-y-3">
        {encontrados.map((m, i) => {
          const aberto = termo ? true : abertos.has(m.id)
          const posicao = emOrdem.findIndex((x) => x.id === m.id)
          const outros = emOrdem
            .filter((x) => x.id !== m.id)
            .map((x) => ({ id: x.id, nome: `${x.ordem}. ${x.nome}` }))

          return (
            <div key={m.id} className="card-alive overflow-hidden">
              {/* ----- Cabeçalho do módulo ----- */}
              <div className="flex items-start gap-3.5 p-4">
                <button
                  type="button"
                  onClick={() => alternar(m.id)}
                  disabled={!!termo}
                  className="flex min-w-0 flex-1 items-start gap-3.5 text-left disabled:cursor-default"
                  aria-expanded={aberto}
                >
                  {/* O número da ordem, grande: é ele que define o
                      pré-requisito, então é o que precisa ser lido primeiro. */}
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-display text-[17px] font-bold text-brand-700 ring-1 ring-brand-200">
                    {m.ordem}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-[15px] font-bold text-gray-900">
                        {m.nome}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                        <Video className="h-3 w-3" strokeWidth={2.25} />
                        {m.aulas.length} {m.aulas.length === 1 ? 'aula' : 'aulas'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          m.turmas > 0
                            ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Users2 className="h-3 w-3" strokeWidth={2.25} />
                        {m.turmas} {m.turmas === 1 ? 'turma' : 'turmas'}
                      </span>
                    </span>
                    {m.descricao && (
                      <span className="mt-0.5 block text-[12.5px] text-gray-500">
                        {m.descricao}
                      </span>
                    )}
                    {m.turmas === 0 && podeEditarModulos && (
                      <span className="mt-1 block text-[11.5px] text-amber-700">
                        Nenhuma turma neste módulo ainda — as aulas daqui não chegam a ninguém até
                        uma turma ser ligada a ele.
                      </span>
                    )}
                  </span>

                  <span className="mt-2 shrink-0 text-gray-400">
                    {aberto ? (
                      <ChevronDown className="h-5 w-5" strokeWidth={2.25} />
                    ) : (
                      <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
                    )}
                  </span>
                </button>

                {podeEditarModulos && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      disabled={posicao === 0 || isPending}
                      onClick={() => acao(() => moverModulo(m.id, cursoId, 'cima'))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Subir módulo"
                      title="Subir — muda o pré-requisito"
                    >
                      <ChevronUp className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      disabled={posicao === emOrdem.length - 1 || isPending}
                      onClick={() => acao(() => moverModulo(m.id, cursoId, 'baixo'))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Descer módulo"
                      title="Descer — muda o pré-requisito"
                    >
                      <ChevronDown className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ nome: m.nome, descricao: m.descricao ?? '' })
                        setCriando(false)
                        setEditando(m.id)
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
                      aria-label="Renomear módulo"
                    >
                      <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>

                    {confirmando === m.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            acao(
                              () => removerModulo(m.id, cursoId),
                              () => setConfirmando(null)
                            )
                          }
                          className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Apagar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmando(null)}
                          className="rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-gray-500 hover:bg-gray-100"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmando(m.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Apagar módulo"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ----- O que é do módulo, e depois as matérias ----- */}
              {aberto && (
                <div className="space-y-3 border-t border-gray-100 bg-gray-50/40 p-4">
                  {/* O QUE É DO MÓDULO: o vídeo de boas-vindas.
                      Vem primeiro porque é o que o aluno vê primeiro. */}
                  {!termo && podeEditarModulos && (
                    <BoasVindasDoModulo
                      cursoId={cursoId}
                      moduloId={m.id}
                      moduloNome={m.nome}
                      videoAtual={m.video_boas_vindas ?? null}
                    />
                  )}

                  {/* AS AULAS MORAM SEMPRE DENTRO DE UMA MATÉRIA.
                      Cada matéria é uma seção com as SUAS aulas e o SEU
                      botão de adicionar. É este o "entro no módulo, na
                      disciplina, e anexo o vídeo naquela aula": não há
                      campo de escolher matéria, porque a matéria é o
                      lugar onde a pessoa clicou. */}
                  <div className="space-y-4">
                    {(m.disciplinas ?? [])
                      .slice()
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((d) => (
                        <SecaoDaDisciplina
                          key={d.id}
                          cursoId={cursoId}
                          modulo={m}
                          disciplina={d}
                          totalAlunos={totalAlunos}
                          outros={outros}
                          termo={termo}
                          busca={busca}
                          podeEditar={podeEditarModulos}
                          soUmaMateria={(m.disciplinas ?? []).length === 1}
                        />
                      ))}
                  </div>

                  {/* Módulo sem matéria nenhuma não deveria existir (o
                      gatilho da 030 cria uma junto com o módulo), mas se
                      um dia existir, a tela não pode ficar muda. */}
                  {(m.disciplinas ?? []).length === 0 && (
                    <p className="py-2 text-center text-[13px] text-gray-500">
                      Este módulo ainda não tem nenhuma matéria. Crie a primeira abaixo.
                    </p>
                  )}

                  {!termo && podeEditarModulos && (
                    <>
                      <NovaDisciplina cursoId={cursoId} moduloId={m.id} moduloNome={m.nome} />
                      <AulaAvulsaForm
                        cursoId={cursoId}
                        modulos={[{ id: m.id, nome: m.nome, ordem: m.ordem }]}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ---------- Aulas fora de qualquer módulo ---------- */}
      {semModulo.length > 0 && (
        <div className="overflow-hidden rounded-2xl ring-1 ring-amber-300">
          <div className="flex items-start gap-3 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2.2} />
            <div className="min-w-0">
              <h3 className="font-display text-[14.5px] font-bold text-amber-900">
                {semModulo.length} {semModulo.length === 1 ? 'aula fora' : 'aulas fora'} de qualquer
                módulo
              </h3>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-800">
                Nenhum aluno vê estas aulas: o aluno entra por uma turma, a turma pertence a um
                módulo, e o que ele enxerga são as aulas daquele módulo.{' '}
                {podeEditarModulos
                  ? 'Escolha um módulo para cada uma abaixo.'
                  : 'Peça à coordenação para encaixá-las num módulo.'}
              </p>
            </div>
          </div>
          <div className="space-y-2 border-t border-amber-200 bg-amber-50/40 p-4">
            {semModulo.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 text-[13px] ring-1 ring-gray-200"
              >
                <span className="font-semibold text-gray-800">{a.titulo}</span>
                {!a.publicada && <span className="text-[11.5px] text-gray-400">(rascunho)</span>}
                {podeEditarModulos && emOrdem.length > 0 && (
                  <label className="ml-auto inline-flex items-center gap-1.5">
                    <CornerUpRight className="h-3.5 w-3.5 text-gray-400" strokeWidth={2.25} />
                    <select
                      value=""
                      disabled={isPending}
                      onChange={(e) => {
                        if (!e.target.value) return
                        acao(() => moverAulaDeModulo(a.id, cursoId, e.target.value))
                      }}
                      className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11.5px] font-medium text-gray-600"
                      aria-label={`Mover ${a.titulo} para um módulo`}
                    >
                      <option value="">colocar no módulo…</option>
                      {emOrdem.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.ordem}. {x.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   UMA DISCIPLINA DENTRO DO MÓDULO

   Seção própria, com as suas aulas, a sua numeração (que recomeça em 1 —
   ver a migração 030) e o seu botão de adicionar. O nome fica em cima e o
   conteúdo recuado à esquerda por uma linha vertical: é o que faz o olho
   entender, sem ler, que aquelas aulas pertencem àquela matéria.
   ============================================================ */
function SecaoDaDisciplina({
  cursoId,
  modulo,
  disciplina,
  totalAlunos,
  outros,
  termo,
  busca,
  podeEditar,
  soUmaMateria,
}: {
  cursoId: string
  modulo: ModuloComAulas
  disciplina: DisciplinaComAulas
  totalAlunos: number
  outros: { id: string; nome: string }[]
  termo: string
  busca: string
  podeEditar: boolean
  /** Última matéria do módulo: apagar deixaria as aulas sem casa. */
  soUmaMateria: boolean
}) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(disciplina.nome)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  /* As OUTRAS matérias deste módulo, para levar aulas de uma para outra.
     É o que transforma um módulo antigo de vinte aulas soltas em duas
     matérias de dez — sem isso, seriam vinte movimentos um a um. */
  const outrasMaterias = (modulo.disciplinas ?? []).filter((d) => d.id !== disciplina.id)

  /* Uma transição POR DISCIPLINA, e não uma para a página inteira. Com um
     estado só, renomear a segunda matéria desabilitaria os botões de
     todas as outras — o mesmo motivo que fez cada linha de aula ter a
     sua. */
  const executar = (acao: () => Promise<{ ok: boolean; erro?: string }>) => {
    setErro(null)
    iniciar(async () => {
      const r = await acao()
      if (!r.ok) setErro(r.erro ?? 'Não consegui salvar.')
      else {
        setEditando(false)
        router.refresh()
      }
    })
  }

  return (
    <section className="rounded-xl bg-white ring-1 ring-gray-200/70">
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-3.5 py-2.5">
        <BookMarked className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />

        {editando ? (
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') executar(() => renomearDisciplina(disciplina.id, cursoId, { nome }))
              if (e.key === 'Escape') {
                setNome(disciplina.nome)
                setEditando(false)
              }
            }}
            className={`${CAMPO} h-8 flex-1 !py-1 text-[13.5px]`}
          />
        ) : (
          <h4 className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-gray-900">
            {disciplina.nome}
          </h4>
        )}

        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-500">
          {disciplina.aulas.length} {disciplina.aulas.length === 1 ? 'aula' : 'aulas'}
        </span>

        {podeEditar && !termo && (
          <span className="flex shrink-0 items-center gap-0.5">
            {editando ? (
              <button
                type="button"
                disabled={salvando}
                onClick={() => executar(() => renomearDisciplina(disciplina.id, cursoId, { nome }))}
                className="rounded-md px-2 py-1 text-[12px] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                Salvar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditando(true)}
                aria-label={`Renomear ${disciplina.nome}`}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <PenLine className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={salvando}
              onClick={() => executar(() => moverDisciplina(disciplina.id, cursoId, 'cima'))}
              aria-label="Subir disciplina"
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => executar(() => moverDisciplina(disciplina.id, cursoId, 'baixo'))}
              aria-label="Descer disciplina"
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={salvando || soUmaMateria}
              onClick={() => executar(() => removerDisciplina(disciplina.id, cursoId))}
              aria-label={`Apagar ${disciplina.nome}`}
              title={
                soUmaMateria
                  ? 'É a única matéria do módulo — as aulas ficariam sem casa.'
                  : `Apagar ${disciplina.nome}`
              }
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </header>

      {/* A MATÉRIA AUTOMÁTICA PEDINDO NOME.
          Ela nasce chamada "Conteúdo do módulo" — nome de lugar, não de
          matéria. Enquanto ficava escondida isso não incomodava; agora
          que ela aparece sempre, o convite a batizar precisa estar ali,
          onde se olha. Sem cobrança: um curso pode ter mesmo um módulo
          de conteúdo corrido. */}
      {podeEditar && !termo && disciplina.padrao && !editando && (
        <div className="border-b border-gray-100 bg-brand-50/40 px-3.5 py-2">
          <button
            type="button"
            onClick={() => setEditando(true)}
            data-teste="batizar-materia"
            className="text-[11.5px] font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-600"
          >
            Dar um nome a esta matéria (Bibliologia, Homilética…) — hoje ela se chama
            &ldquo;{disciplina.nome}&rdquo;.
          </button>
        </div>
      )}

      {erro && (
        <div className="px-3.5 pt-3">
          <Alerta>{erro}</Alerta>
        </div>
      )}

      <div className="space-y-3 p-3.5">
        {disciplina.aulas.length === 0 ? (
          <p className="py-1 text-center text-[12.5px] text-gray-400">
            Nenhuma aula em {disciplina.nome} ainda.
          </p>
        ) : (
          disciplina.aulas
            .slice()
            .sort((a, b) => a.numero - b.numero)
            .map((a, j) => (
              <LinhaDaAula
                key={a.id}
                aula={a}
                cursoId={cursoId}
                totalAlunos={totalAlunos}
                podeSubir={j > 0 && !termo}
                podeDescer={j < disciplina.aulas.length - 1 && !termo}
                outrosModulos={podeEditar ? outros : []}
                outrasMaterias={podeEditar ? outrasMaterias : []}
                destacar={busca}
              />
            ))
        )}

        {!termo && (
          <div className="pt-1">
            <NovaAula
              cursoId={cursoId}
              moduloId={modulo.id}
              disciplinaId={disciplina.id}
              moduloNome={disciplina.nome}
              proximoNumero={
                disciplina.aulas.reduce((max, a) => Math.max(max, a.numero), 0) + 1
              }
            />
          </div>
        )}

        {/* CONVERTER UM MÓDULO ANTIGO EM MATÉRIAS.
            Vinte aulas soltas viram Bibliologia e Teologia por aqui. Sem
            isto seriam vinte movimentos um a um — e ninguém faz vinte
            movimentos: desiste, e o curso fica sem matriz. */}
        {podeEditar && !termo && outrasMaterias.length > 0 && disciplina.aulas.length > 0 && (
          <label className="flex flex-wrap items-center gap-1.5 pt-1 text-[11.5px] text-gray-500">
            <CornerUpRight className="h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={2.25} />
            <span>
              Levar as {disciplina.aulas.length} aulas de {disciplina.nome} para
            </span>
            <select
              value=""
              disabled={salvando}
              data-teste="mover-todas-as-aulas"
              onChange={(e) => {
                if (!e.target.value) return
                const destino = e.target.value
                e.target.value = ''
                executar(() => moverAulasParaDisciplina(cursoId, disciplina.id, destino))
              }}
              className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11.5px] font-medium text-gray-600 disabled:opacity-50"
              aria-label={`Mover todas as aulas de ${disciplina.nome} para outra matéria`}
            >
              <option value="">outra matéria…</option>
              {outrasMaterias
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
    </section>
  )
}

/* ============================================================
   ABRIR UMA DISCIPLINA NOVA

   Fica no pé do módulo, e não num menu: dividir um módulo em matérias é
   uma decisão que se toma OLHANDO para o que já está lá dentro.
   ============================================================ */
function NovaDisciplina({
  cursoId,
  moduloId,
  moduloNome,
}: {
  cursoId: string
  moduloId: string
  moduloNome: string
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciar] = useTransition()

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-2.5 text-[12.5px] font-medium text-gray-500 transition-colors hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700"
      >
        <BookMarked className="h-3.5 w-3.5" />
        Nova disciplina em {moduloNome}
      </button>
    )
  }

  return (
    <div className="rounded-xl bg-white p-3.5 ring-1 ring-gray-200/70">
      {erro && (
        <div className="mb-2.5">
          <Alerta>{erro}</Alerta>
        </div>
      )}
      <label className="mb-1.5 block text-[12px] font-semibold text-gray-600">
        Nome da disciplina
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Bibliologia, Homilética, Vida devocional..."
          className={`${CAMPO} h-9 min-w-0 flex-1 !py-1.5 text-[13.5px]`}
        />
        <button
          type="button"
          disabled={salvando || !nome.trim()}
          onClick={() => {
            setErro(null)
            iniciar(async () => {
              const r = await criarDisciplina(cursoId, moduloId, { nome })
              if (!r.ok) setErro(r.erro)
              else {
                setNome('')
                setAberto(false)
                router.refresh()
              }
            })
          }}
          className="h-9 shrink-0 rounded-lg bg-brand-700 px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
        >
          {salvando ? 'Criando...' : 'Criar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false)
            setNome('')
            setErro(null)
          }}
          className="h-9 shrink-0 rounded-lg px-3 text-[12.5px] font-medium text-gray-500 transition-colors hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
