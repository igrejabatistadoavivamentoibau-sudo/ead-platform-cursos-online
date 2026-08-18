'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Search, X } from 'lucide-react'
import type { LivroBiblia } from '@/lib/biblia'

/**
 * O seletor de passagem — o "índice" da Bíblia.
 *
 * COMO AS PESSOAS PROCURAM UM TEXTO
 * De dois jeitos, e os dois precisam funcionar:
 *   - quem sabe onde fica vai direto: bate o olho na grade e clica;
 *   - quem lembra só o nome digita "efésios" e quer ver o livro subir.
 *
 * Por isso a grade e o campo de digitar convivem na mesma janela, em vez
 * de haver uma lista rolante de 66 itens onde o Antigo e o Novo Testamento
 * viram um borrão só.
 *
 * A grade é dividida por testamento porque é assim que a Bíblia é ensinada,
 * e porque 66 caixinhas iguais em fila não dizem nada a ninguém.
 */
/* Fica FORA do componente de propósito: definido lá dentro, ele seria um
   componente novo a cada renderização, e o React destruiria e remontaria a
   grade inteira a cada tecla digitada no filtro. */
function Grade({
  livros,
  testamento,
  titulo,
  livroAtual,
  aoEscolher,
}: {
  livros: LivroBiblia[]
  testamento: 'AT' | 'NT'
  titulo: string
  livroAtual: LivroBiblia
  aoEscolher: (livro: LivroBiblia) => void
}) {
  const doTestamento = livros.filter((l) => l.testamento === testamento)
  if (doTestamento.length === 0) return null

  return (
    <div className="mb-5">
      <p className="micro-rotulo mb-2.5 text-[10px] font-extrabold tracking-[0.14em] text-[#41514a]">
        {titulo}
      </p>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {doTestamento.map((l) => (
          <button
            key={l.i}
            type="button"
            onClick={() => aoEscolher(l)}
            className={`truncate rounded-lg border px-2.5 py-2 text-left text-[12.5px] font-semibold transition-colors ${
              l.i === livroAtual.i
                ? 'border-brand-600 bg-brand-50 text-brand-800'
                : 'border-brand-950/[0.07] bg-white text-gray-700 hover:border-brand-500/40 hover:bg-[#f6faf8] hover:text-brand-800'
            }`}
          >
            {l.nome}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SeletorPassagem({
  livros,
  livroAtual,
  capituloAtual,
  versao,
}: {
  livros: LivroBiblia[]
  livroAtual: LivroBiblia
  capituloAtual: number
  versao: string
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [filtro, setFiltro] = useState('')
  // Livro escolhido dentro da janela, ainda sem capítulo. Enquanto for
  // nulo, mostramos a grade de livros; escolhido, mostramos os capítulos.
  const [escolhido, setEscolhido] = useState<LivroBiblia | null>(null)

  /* Fechar a janela limpa o estado — mas isso é feito no gesto de fechar,
     não num efeito. Efeito que chama setState logo depois de renderizar
     manda o React desenhar tudo de novo sem necessidade. */
  const fechar = () => {
    setAberto(false)
    setFiltro('')
    setEscolhido(null)
  }

  const escolherLivro = (l: LivroBiblia) => {
    if (l.capitulos === 1) ir(l.i, 1)
    else setEscolhido(l)
  }

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [])

  const semAcento = (t: string) =>
    t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const filtrados = useMemo(() => {
    const alvo = semAcento(filtro.trim())
    if (!alvo) return livros
    return livros.filter(
      (l) => semAcento(l.nome).includes(alvo) || semAcento(l.abrev).includes(alvo)
    )
  }, [filtro, livros])

  const ir = (livro: number, capitulo: number) => {
    fechar()
    router.push(`/dashboard/biblia?v=${versao}&l=${livro}&c=${capitulo}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 rounded-xl border border-brand-950/[0.08] bg-white px-3.5 py-2 font-display text-[15px] font-bold tracking-[-0.015em] text-gray-900 shadow-[0_1px_2px_rgba(5,38,29,0.04)] transition-colors hover:border-brand-500/40"
      >
        {livroAtual.nome} {livroAtual.capitulos > 1 && capituloAtual}
        <ChevronDown className="h-4 w-4 text-gray-400" strokeWidth={2.2} />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 sm:items-center">
          <div
            className="absolute inset-0 bg-brand-950/40 backdrop-blur-[2px]"
            onClick={fechar}
          />

          <div className="relative flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-deep ring-1 ring-brand-950/10 animate-float-in">
            <div className="flex items-center gap-2.5 border-b border-brand-950/[0.07] px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
              <input
                autoFocus
                value={filtro}
                onChange={(e) => {
                  setFiltro(e.target.value)
                  setEscolhido(null)
                }}
                placeholder={escolhido ? `${escolhido.nome} — escolha o capítulo` : 'Procure o livro...'}
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {escolhido ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEscolhido(null)}
                    className="mb-3 text-[12px] font-semibold text-brand-700 hover:text-brand-800"
                  >
                    ← todos os livros
                  </button>
                  <p className="mb-3 font-display text-[16px] font-bold text-gray-900">
                    {escolhido.nome}
                  </p>
                  <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
                    {Array.from({ length: escolhido.capitulos }, (_, i) => i + 1).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => ir(escolhido.i, c)}
                        className={`grid h-9 place-items-center rounded-lg border text-[12.5px] font-bold tabular-nums transition-colors ${
                          escolhido.i === livroAtual.i && c === capituloAtual
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-brand-950/[0.07] bg-white text-gray-600 hover:border-brand-500/40 hover:bg-[#f6faf8] hover:text-brand-800'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <Grade
                    livros={filtrados}
                    testamento="AT"
                    titulo="ANTIGO TESTAMENTO"
                    livroAtual={livroAtual}
                    aoEscolher={escolherLivro}
                  />
                  <Grade
                    livros={filtrados}
                    testamento="NT"
                    titulo="NOVO TESTAMENTO"
                    livroAtual={livroAtual}
                    aoEscolher={escolherLivro}
                  />
                  {filtrados.length === 0 && (
                    <p className="py-8 text-center text-[13px] text-gray-400">
                      Nenhum livro com esse nome.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
