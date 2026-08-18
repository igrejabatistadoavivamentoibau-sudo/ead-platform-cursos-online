import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Search, Bookmark, Columns2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import {
  LIVROS,
  VERSOES,
  VERSAO_PADRAO,
  versaoValida,
  lerCapitulo,
  lerCapituloComparado,
} from '@/lib/biblia'
import SeletorPassagem from '@/components/Biblia/SeletorPassagem'
import LeitorBiblia from '@/components/Biblia/LeitorBiblia'
import type { Marcacao, CorGrifo } from '@/app/dashboard/biblia/actions'

export const dynamic = 'force-dynamic'

/**
 * Número vindo do endereço.
 *
 * `minimo` existe por causa de Gênesis: o índice dele é ZERO, e um "n > 0"
 * ingênuo mandaria o leitor de volta para João toda vez que alguém tentasse
 * abrir o primeiro livro da Bíblia.
 */
function inteiro(valor: string | undefined, padrao: number, minimo = 1) {
  const n = Number(valor)
  return Number.isFinite(n) && n >= minimo ? Math.floor(n) : padrao
}

export default async function BibliaPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; l?: string; c?: string; cmp?: string }>
}) {
  const sessao = await exigirSessao()
  const { v, l, c, cmp } = await searchParams

  const versao = versaoValida(v ?? VERSAO_PADRAO)
  // João é onde a Bíblia abre quando ninguém pediu nada — é por onde a
  // maioria começa a ler, e é o Evangelho que a escola usa de porta de
  // entrada.
  const indiceLivro = Math.min(65, inteiro(l, 42, 0))
  const livro = LIVROS[indiceLivro]
  const capitulo = Math.min(livro.capitulos, inteiro(c, 1))

  const lido = await lerCapitulo(versao.sigla, indiceLivro, capitulo)
  if (!lido) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Capítulo não encontrado.</p>
      </div>
    )
  }

  // Comparação lado a lado — só entra se for uma versão diferente da atual.
  const comparada =
    cmp && cmp !== versao.sigla ? VERSOES.find((x) => x.sigla === cmp) ?? null : null
  const comparados = comparada
    ? await lerCapituloComparado(comparada.sigla, indiceLivro, capitulo)
    : null

  const supabase = await createClient()
  const { data: marcadas } = await supabase
    .from('biblia_marcacoes')
    .select('livro, capitulo, versiculo, cor, nota')
    .eq('user_id', sessao.id)
    .eq('livro', indiceLivro)
    .eq('capitulo', capitulo)

  const marcacoes: Marcacao[] = (marcadas ?? []).map((m) => ({
    livro: m.livro as number,
    capitulo: m.capitulo as number,
    versiculo: m.versiculo as number,
    cor: (m.cor as CorGrifo | null) ?? null,
    nota: (m.nota as string | null) ?? null,
  }))

  /* Navegação entre capítulos — atravessando a virada de livro, porque a
     leitura corrida não para no fim de Gênesis: ela segue para Êxodo. */
  const anterior =
    capitulo > 1
      ? { l: indiceLivro, c: capitulo - 1 }
      : indiceLivro > 0
        ? { l: indiceLivro - 1, c: LIVROS[indiceLivro - 1].capitulos }
        : null
  const proximo =
    capitulo < livro.capitulos
      ? { l: indiceLivro, c: capitulo + 1 }
      : indiceLivro < 65
        ? { l: indiceLivro + 1, c: 1 }
        : null

  const endereco = (p: { l: number; c: number }) =>
    `/dashboard/biblia?v=${versao.sigla}&l=${p.l}&c=${p.c}${comparada ? `&cmp=${comparada.sigla}` : ''}`

  return (
    <div className="p-5 sm:p-8">
      {/* ---------------- Capa da Bíblia ---------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(115deg,#0a3628,#0f513c_55%,#136247)] px-6 py-5 text-white shadow-[0_1px_2px_rgba(5,38,29,0.06),0_24px_48px_-24px_rgba(5,38,29,0.5)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_240px_at_88%_-30%,rgba(212,162,76,0.22),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.09]" />

        <div className="relative flex flex-wrap items-center gap-4">
          <Image
            src="/ibau-capelo.webp"
            alt="IBAU"
            width={720}
            height={756}
            className="h-[54px] w-auto drop-shadow-[0_10px_22px_rgba(0,0,0,0.4)]"
          />
          <div className="min-w-0">
            <p className="micro-rotulo text-[10px] font-bold tracking-[0.18em] text-accent-300">
              IGREJA BATISTA DO AVIVAMENTO
            </p>
            <h1 className="font-display text-[21px] font-bold tracking-[-0.022em]">
              Bíblia de Estudos
            </h1>
            <p className="text-[12px] text-white/60">
              {versao.nome} · {versao.ano} · domínio público
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/biblia/busca"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-3.5 text-[12.5px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/[0.14]"
            >
              <Search className="h-4 w-4" strokeWidth={2} />
              Buscar
            </Link>
            <Link
              href="/dashboard/biblia/marcacoes"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-3.5 text-[12.5px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/[0.14]"
            >
              <Bookmark className="h-4 w-4" strokeWidth={2} />
              Minhas marcações
            </Link>
          </div>
        </div>
      </div>

      {/* ---------------- Barra de navegação da leitura ---------------- */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SeletorPassagem
          livros={LIVROS}
          livroAtual={livro}
          capituloAtual={capitulo}
          versao={versao.sigla}
        />

        <div className="flex items-center gap-1">
          {anterior ? (
            <Link
              href={endereco(anterior)}
              aria-label="Capítulo anterior"
              className="grid h-9 w-9 place-items-center rounded-lg border border-brand-950/[0.08] bg-white text-gray-500 transition-colors hover:border-brand-500/40 hover:text-brand-700"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
            </Link>
          ) : (
            <span className="h-9 w-9" />
          )}
          {proximo ? (
            <Link
              href={endereco(proximo)}
              aria-label="Próximo capítulo"
              className="grid h-9 w-9 place-items-center rounded-lg border border-brand-950/[0.08] bg-white text-gray-500 transition-colors hover:border-brand-500/40 hover:text-brand-700"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
            </Link>
          ) : (
            <span className="h-9 w-9" />
          )}
        </div>

        {/* Traduções: botões e não uma lista escondida. São três, cabem, e
            trocar de tradução é o gesto mais frequente numa Bíblia de
            estudo — esconder isso num menu seria pedir um clique a mais
            dezenas de vezes por aula. */}
        <div className="flex items-center gap-1 rounded-xl border border-brand-950/[0.08] bg-white p-1">
          {VERSOES.map((x) => (
            <Link
              key={x.sigla}
              href={`/dashboard/biblia?v=${x.sigla}&l=${indiceLivro}&c=${capitulo}${
                comparada && comparada.sigla !== x.sigla ? `&cmp=${comparada.sigla}` : ''
              }`}
              title={x.sobre}
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

        <div className="ml-auto flex items-center gap-1.5">
          {comparada ? (
            <Link
              href={`/dashboard/biblia?v=${versao.sigla}&l=${indiceLivro}&c=${capitulo}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-600 bg-brand-50 px-3 text-[12px] font-semibold text-brand-800 transition-colors hover:bg-brand-100"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.2} />
              Comparando com {comparada.nome}
            </Link>
          ) : (
            VERSOES.filter((x) => x.sigla !== versao.sigla)
              .slice(0, 1)
              .map((x) => (
                <Link
                  key={x.sigla}
                  href={`/dashboard/biblia?v=${versao.sigla}&l=${indiceLivro}&c=${capitulo}&cmp=${x.sigla}`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-950/[0.08] bg-white px-3 text-[12px] font-semibold text-gray-600 transition-colors hover:border-brand-500/40 hover:text-brand-800"
                >
                  <Columns2 className="h-4 w-4" strokeWidth={2} />
                  Comparar
                </Link>
              ))
          )}
        </div>
      </div>

      {/* ---------------- O texto ---------------- */}
      <div className="mt-5 rounded-2xl border border-brand-950/[0.07] bg-white px-5 py-7 shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)] sm:px-9 sm:py-10">
        <div className={comparada ? 'mx-auto max-w-5xl' : 'mx-auto max-w-2xl'}>
          <div className="mb-6 text-center">
            <p className="micro-rotulo text-[10px] font-extrabold tracking-[0.16em] text-accent-600">
              {livro.testamento === 'AT' ? 'ANTIGO TESTAMENTO' : 'NOVO TESTAMENTO'}
            </p>
            <h2 className="mt-1.5 font-display text-[26px] font-bold tracking-[-0.02em] text-gray-900">
              {livro.nome}
            </h2>
            {livro.capitulos > 1 && (
              <p className="mt-0.5 font-display text-[15px] font-bold text-brand-600">
                Capítulo {capitulo}
              </p>
            )}
            <span className="mx-auto mt-4 block h-px w-24 bg-gradient-to-r from-transparent via-accent-500/40 to-transparent" />
          </div>

          <LeitorBiblia
            key={`${versao.sigla}:${indiceLivro}:${capitulo}`}
            livro={indiceLivro}
            livroNome={livro.nome}
            capitulo={capitulo}
            versiculos={lido.versiculos}
            comparados={comparados}
            nomeVersao={versao.nome}
            nomeComparada={comparada?.nome ?? null}
            marcacoesIniciais={marcacoes}
          />

          <div className="mt-9 flex items-center justify-between border-t border-brand-950/[0.07] pt-5">
            {anterior ? (
              <Link
                href={endereco(anterior)}
                className="group inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:text-brand-800"
              >
                <ChevronLeft
                  className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
                  strokeWidth={2.2}
                />
                {LIVROS[anterior.l].nome} {anterior.c}
              </Link>
            ) : (
              <span />
            )}
            {proximo && (
              <Link
                href={endereco(proximo)}
                className="group inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:text-brand-800"
              >
                {LIVROS[proximo.l].nome} {proximo.c}
                <ChevronRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.2}
                />
              </Link>
            )}
          </div>
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-[11px] leading-relaxed text-gray-400">
        Texto de domínio público. {versao.nome} ({versao.ano}) — {versao.sobre} Clique num
        versículo para grifar ou anotar; suas marcações são só suas e aparecem em qualquer
        tradução.
      </p>
    </div>
  )
}
