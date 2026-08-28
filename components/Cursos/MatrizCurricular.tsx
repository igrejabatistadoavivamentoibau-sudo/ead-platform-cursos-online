'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutList, ChevronRight, Wand2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { criarMatrizCurricular } from '@/app/dashboard/admin/actions'
import {
  lerMatriz,
  conferirMatriz,
  resumoDaMatriz,
  compararComOQueExiste,
  fraseDoQueVaiAcontecer,
  MATRIZ_DE_EXEMPLO,
  type EstruturaExistente,
  type DestinoDaAula,
} from '@/lib/nucleo/matrizCurricular'
import { Alerta } from '@/components/ui'

/* ============================================================
   MONTAR A MATRIZ CURRICULAR DE UMA VEZ

   O pedido: "1 curso pode ter 3 módulos e dentro desses módulos haverem 2
   disciplinas em cada um deles e serem 10 aulas em cada disciplina, cada
   aula com seu nome específico."

   São sessenta nomes. Numa tela de "adicionar + adicionar + adicionar",
   são sessenta cliques, sessenta campos abrindo, e nada existindo até o
   último. Aqui é uma lista escrita — a mesma que já existe no plano de
   ensino — colada de uma vez.

   AS DUAS COISAS QUE FAZEM ISSO NÃO DAR MEDO:

   1. A PRÉVIA. Nada é criado enquanto ela não mostrar exatamente a árvore
      que vai nascer. Escrever estrutura às cegas e descobrir depois é o
      que faz alguém preferir os sessenta cliques.

   2. OS AVISOS. Quando a leitura teve de adivinhar alguma coisa — recuo
      fora do padrão, "10 aulas" gerando nomes provisórios —, ela diz o
      que decidiu, ANTES de criar.

   A leitura em si não mora aqui: mora em `lib/nucleo/matrizCurricular.ts`,
   onde é testada caso a caso. Esta tela só mostra e manda criar.
   ============================================================ */

/* A marca de cada linha da prévia.

   Ela existe porque juntar por nome, sem mostrar, seria pior do que
   duplicar: pelo menos duplicata se vê depois. Aqui a pessoa vê ANTES —
   e "já existe" é a informação que a impede de desistir achando que vai
   criar tudo em dobro. */
/** O que o botão promete, num curso que já tem conteúdo. */
function rotuloDoBotao(c: {
  criar: { modulos: number; disciplinas: number; aulas: number }
  mover: number
}): string {
  const total = c.criar.modulos + c.criar.disciplinas + c.criar.aulas
  if (total === 0 && c.mover === 0) return 'Nada a fazer'
  if (total === 0) return `Mover ${c.mover} ${c.mover === 1 ? 'aula' : 'aulas'} de matéria`
  if (c.mover === 0) return 'Aplicar a matriz'
  return 'Aplicar a matriz'
}

function Etiqueta({ destino, de }: { destino: DestinoDaAula; de?: string }) {
  if (destino === 'manter') {
    return (
      <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-gray-500">
        já existe
      </span>
    )
  }
  return (
    <span
      className="shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-amber-800"
      title={de ? `Hoje está em "${de}". Muda de matéria levando vídeo, material e progresso.` : undefined}
    >
      muda de matéria
    </span>
  )
}

export default function MatrizCurricular({
  cursoId,
  cursoVazio,
  existente = { modulos: [] },
}: {
  cursoId: string
  /** Curso ainda sem aula nenhuma: aí a matriz é o próximo passo óbvio. */
  cursoVazio: boolean
  /** A árvore que o curso JÁ tem, para a prévia comparar antes de criar. */
  existente?: EstruturaExistente
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState<string | null>(null)
  const [criando, iniciar] = useTransition()

  /* A leitura roda a cada tecla e é barata: é só texto virando lista. Ler
     no servidor a cada tecla seria uma ida à rede por letra digitada. */
  const matriz = useMemo(() => lerMatriz(texto), [texto])
  const resumo = useMemo(() => resumoDaMatriz(matriz), [matriz])
  const conferida = useMemo(() => conferirMatriz(matriz), [matriz])

  /* O QUE VAI ACONTECER DE VERDADE, e não o que a matriz diz no papel.
     Num curso que já existe, boa parte do que está escrito já está lá — e
     a diferença entre "criar 60 aulas" e "criar 2 e mudar 3 de matéria" é
     a diferença entre confiar no botão e não clicar nele. */
  const comparada = useMemo(
    () => compararComOQueExiste(matriz, existente),
    [matriz, existente]
  )
  const cursoTemCoisa = existente.modulos.length > 0
  /* Botão que não vai fazer nada fica desligado. Clicar e receber
     "pronto: 0 módulos, 0 aulas" é a tela fingindo que trabalhou. */
  const nadaAFazer =
    cursoTemCoisa &&
    conferida.ok &&
    comparada.criar.modulos + comparada.criar.disciplinas + comparada.criar.aulas === 0 &&
    comparada.mover === 0

  const criar = () => {
    setErro(null)
    setPronto(null)
    iniciar(async () => {
      const r = await criarMatrizCurricular(cursoId, texto)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      const criados = [
        r.modulos > 0 ? `${r.modulos} ${r.modulos === 1 ? 'módulo' : 'módulos'}` : '',
        r.disciplinas > 0
          ? `${r.disciplinas} ${r.disciplinas === 1 ? 'disciplina' : 'disciplinas'}`
          : '',
        r.aulas > 0 ? `${r.aulas} ${r.aulas === 1 ? 'aula' : 'aulas'}` : '',
      ].filter(Boolean)

      const partes: string[] = []
      if (criados.length > 0) partes.push(`Criei ${criados.join(', ')}`)
      if (r.movidas > 0) {
        partes.push(
          `${criados.length > 0 ? 'e mudei' : 'Mudei'} ${r.movidas} ${
            r.movidas === 1 ? 'aula de matéria' : 'aulas de matéria'
          }`
        )
      }
      setPronto(
        partes.length > 0
          ? `${partes.join(' ')}.`
          : 'Tudo isso já estava no curso — nada precisou mudar.'
      )
      setTexto('')
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        data-teste="abrir-matriz"
        className={`card-alive card-clicavel flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ${
          cursoVazio ? 'ring-1 ring-brand-300' : ''
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <LayoutList className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-gray-900">
            Montar a matriz curricular
          </span>
          <span className="block text-[12.5px] leading-snug text-gray-500">
            {cursoVazio
              ? 'Escreva os módulos, as disciplinas e o nome de cada aula — a plataforma cria tudo.'
              : 'Acrescente módulos, disciplinas e aulas de uma vez, escrevendo a lista.'}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
      </button>
    )
  }

  return (
    <div className="superficie overflow-hidden rounded-2xl">
      <header className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
        <LayoutList className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
        <h3 className="flex-1 text-[14px] font-bold text-gray-900">Matriz curricular</h3>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-lg px-2.5 py-1 text-[12.5px] font-medium text-gray-500 transition-colors hover:bg-gray-100"
        >
          Fechar
        </button>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {/* ---------------- O que se escreve ---------------- */}
        <div>
          <label
            htmlFor="matriz"
            className="mb-1.5 block text-[12px] font-semibold text-gray-600"
          >
            Escreva a matriz — o recuo diz o que é cada coisa
          </label>

          <textarea
            id="matriz"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setPronto(null)
            }}
            spellCheck={false}
            rows={16}
            placeholder={MATRIZ_DE_EXEMPLO}
            data-teste="texto-da-matriz"
            className="campo w-full resize-y font-mono text-[12.5px] leading-relaxed"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTexto(MATRIZ_DE_EXEMPLO)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-200"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Usar o exemplo
            </button>
            <p className="text-[11.5px] leading-snug text-gray-400">
              Sem recuo = módulo · um recuo = disciplina · dois recuos = aula.
              Escreva <strong className="font-semibold text-gray-500">10 aulas</strong> para
              gerar dez numeradas.
            </p>
          </div>
        </div>

        {/* ---------------- O que vai nascer ---------------- */}
        <div className="min-w-0">
          <p className="mb-1.5 flex items-center justify-between gap-2 text-[12px] font-semibold text-gray-600">
            <span>{cursoTemCoisa ? 'Como o curso vai ficar' : 'O que vai ser criado'}</span>
            {resumo.aulas + resumo.modulos > 0 && (
              <span
                data-teste="resumo-da-matriz"
                className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700"
              >
                {resumo.frase}
              </span>
            )}
          </p>

          <div
            data-teste="previa-da-matriz"
            className="max-h-[22rem] overflow-auto rounded-xl bg-gray-50/70 p-3 ring-1 ring-gray-200"
          >
            {matriz.modulos.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-gray-400">
                A prévia aparece aqui conforme você escreve.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {matriz.modulos.map((m, i) => (
                  <li key={i}>
                    <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold text-gray-900">
                      <span className="tabular-nums text-gray-400">{i + 1}.</span>{' '}
                      {comparada.modulos[i]?.nomeAtual ?? m.nome}
                      {cursoTemCoisa && comparada.modulos[i] && !comparada.modulos[i].novo && (
                        <Etiqueta destino="manter" />
                      )}
                    </p>
                    <ul className="mt-1 space-y-1.5 border-l border-gray-200 pl-3">
                      {m.disciplinas.map((d, j) => {
                        const cd = comparada.modulos[i]?.disciplinas[j]
                        return (
                        <li key={j}>
                          {d.nome && (
                            <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-brand-800">
                              {cd?.nomeAtual ?? d.nome}
                              {cursoTemCoisa && cd && !cd.novo && <Etiqueta destino="manter" />}
                            </p>
                          )}
                          {d.aulas.length === 0 ? (
                            <p className="text-[12px] italic text-gray-400">sem aulas ainda</p>
                          ) : (
                            <ol className="mt-0.5 space-y-0.5">
                              {d.aulas.map((a, k) => (
                                <li key={k} className="flex items-center gap-1.5 text-[12px] text-gray-600">
                                  <span className="tabular-nums text-gray-400">{k + 1}.</span>
                                  <span className="min-w-0 truncate">{a}</span>
                                  {cursoTemCoisa && cd?.aulas[k] && cd.aulas[k].destino !== 'criar' && (
                                    <Etiqueta destino={cd.aulas[k].destino} de={cd.aulas[k].de} />
                                  )}
                                </li>
                              ))}
                            </ol>
                          )}
                        </li>
                        )
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Os palpites que a leitura teve de dar, contados antes de criar. */}
          {matriz.avisos.length > 0 && (
            <ul className="mt-2 space-y-1" data-teste="avisos-da-matriz">
              {matriz.avisos.slice(0, 4).map((a, i) => (
                <li key={i} className="flex gap-1.5 text-[11.5px] leading-snug text-amber-700">
                  <AlertTriangle className="mt-px h-3 w-3 shrink-0" strokeWidth={2.4} />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}

          {erro && (
            <div className="mt-3">
              <Alerta>{erro}</Alerta>
            </div>
          )}
          {!erro && !conferida.ok && texto.trim().length > 0 && (
            <div className="mt-3">
              <Alerta tom="aviso">{conferida.erro}</Alerta>
            </div>
          )}
          {pronto && (
            <div className="mt-3" data-teste="matriz-criada">
              <Alerta tom="sucesso">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  {pronto} As aulas nascem como rascunho — publique cada uma depois de anexar o
                  vídeo.
                </span>
              </Alerta>
            </div>
          )}

          {cursoTemCoisa && conferida.ok && (
            <p
              className="mt-3 rounded-lg bg-gray-50 px-2.5 py-2 text-[12px] font-medium leading-snug text-gray-700 ring-1 ring-gray-200"
              data-teste="o-que-vai-acontecer"
            >
              {fraseDoQueVaiAcontecer(comparada)}
            </p>
          )}

          <button
            type="button"
            disabled={criando || !conferida.ok || nadaAFazer}
            onClick={criar}
            data-teste="criar-matriz"
            className="mt-3 h-10 w-full rounded-xl bg-brand-700 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
          >
            {/* O RÓTULO DO BOTÃO DIZ O QUE VAI ACONTECER, não o que a
                matriz descreve. Num curso que já existe os dois números
                são diferentes — "Criar 4 aulas" logo abaixo de "mover 3
                aulas de matéria" seria a tela se contradizendo. */}
            {criando
              ? 'Criando a estrutura...'
              : cursoTemCoisa
                ? conferida.ok
                  ? rotuloDoBotao(comparada)
                  : 'Aplicar a matriz'
                : `Criar ${resumo.frase || 'a matriz'}`}
          </button>

          <p className="mt-2 text-center text-[11.5px] leading-snug text-gray-400">
            Nada é apagado. O que já existe no curso é reaproveitado pelo nome — colar a
            mesma matriz duas vezes não cria nada em dobro.
          </p>
        </div>
      </div>
    </div>
  )
}
