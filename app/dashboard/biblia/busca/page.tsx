import Link from 'next/link'
import { Search, BookOpenText } from 'lucide-react'
import Voltar from '@/components/ui/Voltar'
import { buscar, normalizar, VERSOES, VERSAO_PADRAO, versaoValida } from '@/lib/biblia'

export const dynamic = 'force-dynamic'

/**
 * Realça no meio do versículo o pedaço que a pessoa procurou.
 *
 * A comparação é feita sem acento (senão "coracao" não acharia "coração"),
 * mas o que aparece na tela é o texto ORIGINAL, com acento e maiúscula no
 * lugar. Mostrar o texto normalizado seria mais fácil e estaria errado: a
 * Palavra não se escreve sem acento.
 */
function realcar(texto: string, termo: string) {
  const alvo = normalizar(termo)
  if (!alvo) return [texto]

  const base = normalizar(texto)
  const pedacos: (string | { forte: string })[] = []
  let de = 0

  for (;;) {
    const achou = base.indexOf(alvo, de)
    if (achou === -1) break
    if (achou > de) pedacos.push(texto.slice(de, achou))
    pedacos.push({ forte: texto.slice(achou, achou + alvo.length) })
    de = achou + alvo.length
  }
  if (de < texto.length) pedacos.push(texto.slice(de))
  return pedacos
}

export default async function BuscaBibliaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; v?: string; t?: string }>
}) {
  const { q, v, t } = await searchParams
  const versao = versaoValida(v ?? VERSAO_PADRAO)
  const termo = (q ?? '').trim()
  const apenas = t === 'AT' || t === 'NT' ? t : undefined

  const resultado = termo ? await buscar(versao.sigla, termo, { apenas }) : null

  const filtro = (valor: string | undefined, rotulo: string) => {
    const ativo = (valor ?? '') === (apenas ?? '')
    const params = new URLSearchParams({ q: termo, v: versao.sigla })
    if (valor) params.set('t', valor)
    return (
      <Link
        key={rotulo}
        href={`/dashboard/biblia/busca?${params.toString()}`}
        className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
          ativo ? 'bg-brand-700 text-white' : 'text-gray-500 hover:bg-[#f6faf8] hover:text-brand-800'
        }`}
      >
        {rotulo}
      </Link>
    )
  }

  return (
    <div className="p-5 sm:p-8">
      <Voltar
        href="/dashboard/biblia"
        label="Voltar à leitura"
        titulo="Buscar na Bíblia"
        margem="mb-5"
      />

      <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-gray-900 sm:text-[26px]">
        Buscar na Bíblia
      </h1>
      <p className="mt-1 text-[14px] text-gray-500">
        Procure uma palavra ou uma expressão inteira. Não precisa acertar o acento.
      </p>

      <form action="/dashboard/biblia/busca" className="mt-5 flex flex-wrap items-center gap-2">
        <input type="hidden" name="v" value={versao.sigla} />
        {apenas && <input type="hidden" name="t" value={apenas} />}
        <div className="flex min-w-[260px] flex-1 items-center gap-2.5 rounded-xl border border-brand-950/[0.08] bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(5,38,29,0.04)] focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
          <Search className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
          <input
            name="q"
            defaultValue={termo}
            autoFocus
            placeholder="Ex.: bem-aventurados, coração, boas novas"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-gray-400"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-800"
        >
          Buscar
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-brand-950/[0.08] bg-white p-1">
          {filtro(undefined, 'Bíblia toda')}
          {filtro('AT', 'Antigo Testamento')}
          {filtro('NT', 'Novo Testamento')}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-brand-950/[0.08] bg-white p-1">
          {VERSOES.map((x) => (
            <Link
              key={x.sigla}
              href={`/dashboard/biblia/busca?q=${encodeURIComponent(termo)}&v=${x.sigla}${
                apenas ? `&t=${apenas}` : ''
              }`}
              className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                x.sigla === versao.sigla
                  ? 'bg-brand-700 text-white'
                  : 'text-gray-500 hover:bg-[#f6faf8] hover:text-brand-800'
              }`}
            >
              {x.nome}
            </Link>
          ))}
        </div>
      </div>

      {resultado && (
        <>
          <div className="mb-3.5 mt-7 flex items-center gap-2.5">
            <BookOpenText className="h-3.5 w-3.5 text-brand-700" strokeWidth={2} />
            <h2 className="micro-rotulo text-[11px] font-extrabold tracking-[0.14em] text-[#41514a]">
              {resultado.total === 0
                ? 'NENHUM VERSÍCULO ENCONTRADO'
                : `${resultado.total} ${resultado.total === 1 ? 'VERSÍCULO' : 'VERSÍCULOS'}`}
            </h2>
            <span className="h-px flex-1 bg-gradient-to-r from-brand-950/[0.08] to-transparent" />
            {resultado.truncado && (
              <span className="text-[11px] text-gray-400">
                mostrando os {resultado.achados.length} primeiros
              </span>
            )}
          </div>

          {resultado.total === 0 ? (
            <div className="rounded-2xl border border-brand-950/[0.07] bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]">
              <p className="font-display text-[15px] font-bold text-gray-900">
                Nada encontrado para “{termo}”
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-gray-500">
                Tente uma palavra sozinha em vez da frase inteira — cada tradução escolhe palavras
                diferentes, e a expressão exata pode estar só em uma delas.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-brand-950/[0.06] overflow-hidden rounded-2xl border border-brand-950/[0.07] bg-white shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]">
              {resultado.achados.map((a, i) => (
                <Link
                  key={i}
                  href={`/dashboard/biblia?v=${versao.sigla}&l=${a.livro.i}&c=${a.capitulo}#v${a.versiculo}`}
                  className="block px-5 py-3.5 transition-colors hover:bg-[#f6faf8]"
                >
                  <p className="micro-rotulo text-[10px] font-extrabold tracking-[0.12em] text-brand-700">
                    {a.livro.nome.toUpperCase()} {a.capitulo}.{a.versiculo}
                  </p>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-gray-700">
                    {realcar(a.texto, termo).map((p, k) =>
                      typeof p === 'string' ? (
                        <span key={k}>{p}</span>
                      ) : (
                        <mark key={k} className="rounded bg-[#fdf3d0] px-0.5 font-semibold text-gray-900">
                          {p.forte}
                        </mark>
                      )
                    )}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
