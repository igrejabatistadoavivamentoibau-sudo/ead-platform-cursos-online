'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Check, Copy, Highlighter, PenLine, Trash2, X, Loader2 } from 'lucide-react'
import { grifarVersiculo, anotarVersiculo, type CorGrifo, type Marcacao } from '@/app/dashboard/biblia/actions'

/* ============================================================
   O LEITOR

   A REGRA DE OURO AQUI É O TEXTO
   Numa Bíblia, o protagonista é a Palavra. Toda decisão abaixo serve a
   isso: fonte de leitura com bom espaçamento entre linhas, largura de
   coluna medida (texto largo demais cansa o olho no retorno da linha),
   número do versículo discreto em vez de gritando, e nenhum enfeite
   disputando atenção com o versículo.

   O GRIFO É O GESTO DA PESSOA
   Clicar num versículo abre as cores. Passar a mesma cor de novo apaga —
   como um marca-texto de verdade na mão. O grifo aparece na hora, antes de
   o servidor confirmar: quem grifa espera ver a cor, não uma espera.

   O GRIFO NÃO PERTENCE À TRADUÇÃO
   João 3.16 grifado na Bíblia Livre continua grifado na Almeida 1911. É a
   mesma Palavra em outra roupa (ver a migração 017).
   ============================================================ */

const CORES: { cor: CorGrifo; nome: string; fundo: string; amostra: string }[] = [
  { cor: 'amarelo', nome: 'Amarelo', fundo: 'bg-[#fdf3d0]', amostra: 'bg-[#f2d24b]' },
  { cor: 'verde', nome: 'Verde', fundo: 'bg-[#d9f2e4]', amostra: 'bg-[#3fbf85]' },
  { cor: 'azul', nome: 'Azul', fundo: 'bg-[#d9e9fb]', amostra: 'bg-[#4b9df2]' },
  { cor: 'rosa', nome: 'Rosa', fundo: 'bg-[#fbdfe9]', amostra: 'bg-[#ef6f9c]' },
  { cor: 'roxo', nome: 'Roxo', fundo: 'bg-[#e6ddf7]', amostra: 'bg-[#9271e0]' },
]

const FUNDO_POR_COR = Object.fromEntries(CORES.map((c) => [c.cor, c.fundo])) as Record<
  CorGrifo,
  string
>

type Chave = string
const chave = (c: number, v: number): Chave => `${c}:${v}`

export default function LeitorBiblia({
  livro,
  livroNome,
  capitulo,
  versiculos,
  comparados,
  nomeVersao,
  nomeComparada,
  marcacoesIniciais,
}: {
  livro: number
  livroNome: string
  capitulo: number
  versiculos: string[]
  comparados: string[] | null
  nomeVersao: string
  nomeComparada: string | null
  marcacoesIniciais: Marcacao[]
}) {
  const [marcacoes, setMarcacoes] = useState<Map<Chave, { cor: CorGrifo | null; nota: string | null }>>(
    () => new Map(marcacoesIniciais.map((m) => [chave(m.capitulo, m.versiculo), { cor: m.cor, nota: m.nota }]))
  )
  const [aberto, setAberto] = useState<number | null>(null)
  const [editandoNota, setEditandoNota] = useState<number | null>(null)
  const [rascunho, setRascunho] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [salvando, iniciarSalvamento] = useTransition()

  /* Trocar de capítulo tem de trazer as marcações do capítulo novo — senão
     as cores do capítulo anterior "vazariam" para este.
     Isso NÃO é feito com um efeito que reescreve o estado depois de
     renderizar (o que obrigaria o React a desenhar a tela duas vezes). Quem
     resolve é a página: ela dá a este componente uma identidade que muda
     junto com a passagem, e o React monta um leitor novo, já com as
     marcações certas desde o primeiro traço. */

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAberto(null)
      setEditandoNota(null)
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [])

  const marcacaoDe = useCallback(
    (v: number) => marcacoes.get(chave(capitulo, v)) ?? { cor: null, nota: null },
    [marcacoes, capitulo]
  )

  const grifar = (v: number, cor: CorGrifo) => {
    const atual = marcacaoDe(v)
    const nova = atual.cor === cor ? null : cor

    // Pinta antes de perguntar ao servidor. Se a rede falhar, desfazemos.
    setMarcacoes((m) => new Map(m).set(chave(capitulo, v), { ...atual, cor: nova }))

    iniciarSalvamento(async () => {
      try {
        await grifarVersiculo(livro, capitulo, v, cor)
      } catch {
        setMarcacoes((m) => new Map(m).set(chave(capitulo, v), atual))
      }
    })
  }

  const salvarNota = (v: number) => {
    const atual = marcacaoDe(v)
    const texto = rascunho.trim()
    setMarcacoes((m) => new Map(m).set(chave(capitulo, v), { ...atual, nota: texto || null }))
    setEditandoNota(null)
    setAberto(null)

    iniciarSalvamento(async () => {
      try {
        await anotarVersiculo(livro, capitulo, v, texto)
      } catch {
        setMarcacoes((m) => new Map(m).set(chave(capitulo, v), atual))
      }
    })
  }

  const copiar = (v: number) => {
    const texto = `"${versiculos[v - 1]}"\n— ${livroNome} ${capitulo}.${v} (${nomeVersao})`
    navigator.clipboard?.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1800)
  }

  return (
    <div className="relative">
      {comparados && nomeComparada && (
        <div className="mb-4 grid grid-cols-2 gap-6 border-b border-brand-950/[0.07] pb-2.5">
          <p className="micro-rotulo text-[10px] font-extrabold tracking-[0.14em] text-[#41514a]">
            {nomeVersao.toUpperCase()}
          </p>
          <p className="micro-rotulo text-[10px] font-extrabold tracking-[0.14em] text-[#41514a]">
            {nomeComparada.toUpperCase()}
          </p>
        </div>
      )}

      <div>
        <div>
          {versiculos.map((texto, i) => {
            const v = i + 1
            const m = marcacaoDe(v)
            const selecionado = aberto === v

            const principal = (
              <p
                onClick={() => setAberto(selecionado ? null : v)}
                className={`cursor-pointer rounded-md px-1.5 py-0.5 text-[16.5px] leading-[1.85] text-gray-800 transition-colors ${
                  m.cor ? FUNDO_POR_COR[m.cor] : 'hover:bg-[#f4f7f5]'
                } ${selecionado ? 'ring-1 ring-brand-500/40' : ''}`}
              >
                <sup className="mr-1.5 select-none align-super font-display text-[10.5px] font-bold text-brand-600/80 tabular-nums">
                  {v}
                </sup>
                {texto}
                {m.nota && (
                  <PenLine
                    className="ml-1.5 inline h-3 w-3 -translate-y-px text-accent-500"
                    strokeWidth={2.2}
                  />
                )}
              </p>
            )

            return (
              <div key={v} id={`v${v}`} className="scroll-mt-24">
                {/* Na comparação, o versículo 3 de uma tradução fica NA MESMA
                    LINHA do versículo 3 da outra. Duas colunas correndo soltas
                    parecem certas nos primeiros versículos e vão se desencon-
                    trando conforme as frases têm tamanhos diferentes — e aí a
                    comparação, que era o motivo de estar ali, deixa de ser
                    possível sem caçar o número com o dedo. */}
                {comparados ? (
                  <div className="grid grid-cols-2 items-start gap-6">
                    {principal}
                    <p className="rounded-md px-1.5 py-0.5 text-[16.5px] leading-[1.85] text-gray-600">
                      <sup className="mr-1.5 select-none align-super font-display text-[10.5px] font-bold text-gray-400 tabular-nums">
                        {v}
                      </sup>
                      {comparados[i] ?? ''}
                    </p>
                  </div>
                ) : (
                  principal
                )}

                {/* A anotação da pessoa, logo abaixo do versículo. Fica
                    sempre visível: nota escondida atrás de um clique é nota
                    esquecida. */}
                {m.nota && editandoNota !== v && (
                  <div className="my-1.5 ml-6 border-l-2 border-accent-400/50 bg-[#fdfaf2] py-1.5 pl-3 pr-2">
                    <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#6b5426]">
                      {m.nota}
                    </p>
                  </div>
                )}

                {/* Barra de ações do versículo escolhido */}
                {selecionado && editandoNota !== v && (
                  <div className="my-2 ml-6 flex flex-wrap items-center gap-2 rounded-xl border border-brand-950/[0.08] bg-white p-2 shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-18px_rgba(5,38,29,0.2)] animate-float-in">
                    <span className="ml-1 flex items-center gap-1.5 text-[10.5px] font-bold tracking-wide text-gray-400">
                      <Highlighter className="h-3.5 w-3.5" strokeWidth={2} />
                      {livroNome} {capitulo}.{v}
                    </span>

                    <span className="flex items-center gap-1.5">
                      {CORES.map((c) => (
                        <button
                          key={c.cor}
                          type="button"
                          title={c.nome}
                          aria-label={`Grifar de ${c.nome.toLowerCase()}`}
                          onClick={() => grifar(v, c.cor)}
                          className={`h-6 w-6 rounded-full ${c.amostra} ring-offset-1 transition-transform hover:scale-110 ${
                            m.cor === c.cor ? 'ring-2 ring-brand-700 ring-offset-1' : ''
                          }`}
                        >
                          {m.cor === c.cor && (
                            <Check className="mx-auto h-3.5 w-3.5 text-white" strokeWidth={3} />
                          )}
                        </button>
                      ))}
                    </span>

                    <span className="mx-0.5 h-5 w-px bg-brand-950/[0.08]" />

                    <button
                      type="button"
                      onClick={() => {
                        setRascunho(m.nota ?? '')
                        setEditandoNota(v)
                      }}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-brand-800"
                    >
                      <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
                      {m.nota ? 'Editar nota' : 'Anotar'}
                    </button>

                    <button
                      type="button"
                      onClick={() => copiar(v)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-brand-800"
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                      {copiado ? 'Copiado!' : 'Copiar'}
                    </button>

                    {(m.cor || m.nota) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (m.cor) grifar(v, m.cor)
                          if (m.nota) {
                            setRascunho('')
                            setMarcacoes((mm) =>
                              new Map(mm).set(chave(capitulo, v), { cor: null, nota: null })
                            )
                            iniciarSalvamento(async () => {
                              await anotarVersiculo(livro, capitulo, v, '').catch(() => {})
                            })
                          }
                          setAberto(null)
                        }}
                        className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        Limpar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setAberto(null)}
                      aria-label="Fechar"
                      className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </button>
                  </div>
                )}

                {/* Escrevendo a anotação */}
                {editandoNota === v && (
                  <div className="my-2 ml-6 rounded-xl border border-brand-950/[0.08] bg-white p-3 shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-18px_rgba(5,38,29,0.2)]">
                    <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold tracking-wide text-gray-400">
                      <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
                      SUA ANOTAÇÃO EM {livroNome.toUpperCase()} {capitulo}.{v}
                    </p>
                    <textarea
                      autoFocus
                      rows={4}
                      value={rascunho}
                      onChange={(e) => setRascunho(e.target.value)}
                      placeholder="O que o Senhor falou com você neste versículo?"
                      className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5 text-[14px] leading-relaxed outline-none transition-all placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
                    />
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => salvarNota(v)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
                      >
                        {salvando ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
                        ) : (
                          <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                        )}
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditandoNota(null)}
                        className="inline-flex h-8 items-center rounded-lg px-3 text-[12.5px] font-semibold text-gray-500 transition-colors hover:bg-gray-100"
                      >
                        Cancelar
                      </button>
                      <span className="ml-auto text-[10.5px] tabular-nums text-gray-300">
                        {rascunho.length}/4000
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
