'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutList, ChevronRight, Wand2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { criarMatrizCurricular } from '@/app/dashboard/admin/actions'
import {
  lerMatriz,
  conferirMatriz,
  resumoDaMatriz,
  MATRIZ_DE_EXEMPLO,
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

export default function MatrizCurricular({
  cursoId,
  cursoVazio,
}: {
  cursoId: string
  /** Curso ainda sem aula nenhuma: aí a matriz é o próximo passo óbvio. */
  cursoVazio: boolean
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

  const criar = () => {
    setErro(null)
    setPronto(null)
    iniciar(async () => {
      const r = await criarMatrizCurricular(cursoId, texto)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setPronto(
        `Pronto: ${r.modulos} ${r.modulos === 1 ? 'módulo' : 'módulos'}` +
          (r.disciplinas > 0
            ? `, ${r.disciplinas} ${r.disciplinas === 1 ? 'disciplina' : 'disciplinas'}`
            : '') +
          ` e ${r.aulas} ${r.aulas === 1 ? 'aula' : 'aulas'}.`
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
            <span>O que vai ser criado</span>
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
                    <p className="text-[13px] font-bold text-gray-900">
                      <span className="tabular-nums text-gray-400">{i + 1}.</span> {m.nome}
                    </p>
                    <ul className="mt-1 space-y-1.5 border-l border-gray-200 pl-3">
                      {m.disciplinas.map((d, j) => (
                        <li key={j}>
                          {d.nome && (
                            <p className="text-[12.5px] font-semibold text-brand-800">{d.nome}</p>
                          )}
                          {d.aulas.length === 0 ? (
                            <p className="text-[12px] italic text-gray-400">sem aulas ainda</p>
                          ) : (
                            <ol className="mt-0.5 space-y-0.5">
                              {d.aulas.map((a, k) => (
                                <li key={k} className="flex gap-1.5 text-[12px] text-gray-600">
                                  <span className="tabular-nums text-gray-400">{k + 1}.</span>
                                  <span className="min-w-0 truncate">{a}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </li>
                      ))}
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

          <button
            type="button"
            disabled={criando || !conferida.ok}
            onClick={criar}
            data-teste="criar-matriz"
            className="mt-3 h-10 w-full rounded-xl bg-brand-700 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
          >
            {criando ? 'Criando a estrutura...' : `Criar ${resumo.frase || 'a matriz'}`}
          </button>

          <p className="mt-2 text-center text-[11.5px] leading-snug text-gray-400">
            Nada é apagado: a matriz é acrescentada ao que já existe no curso.
          </p>
        </div>
      </div>
    </div>
  )
}
