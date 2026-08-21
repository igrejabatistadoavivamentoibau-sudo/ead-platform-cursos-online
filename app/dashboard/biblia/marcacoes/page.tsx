import Link from 'next/link'
import { Bookmark, PenLine } from 'lucide-react'
import Voltar from '@/components/ui/Voltar'
import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { LIVROS, VERSAO_PADRAO, versaoValida, lerCapitulo } from '@/lib/biblia'
import type { CorGrifo } from '@/app/dashboard/biblia/actions'

export const dynamic = 'force-dynamic'

const FUNDO: Record<CorGrifo, string> = {
  amarelo: 'bg-[#fdf3d0]',
  verde: 'bg-[#d9f2e4]',
  azul: 'bg-[#d9e9fb]',
  rosa: 'bg-[#fbdfe9]',
  roxo: 'bg-[#e6ddf7]',
}

const PONTO: Record<CorGrifo, string> = {
  amarelo: 'bg-[#f2d24b]',
  verde: 'bg-[#3fbf85]',
  azul: 'bg-[#4b9df2]',
  rosa: 'bg-[#ef6f9c]',
  roxo: 'bg-[#9271e0]',
}

export default async function MinhasMarcacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>
}) {
  const sessao = await exigirSessao()
  const { v } = await searchParams
  const versao = versaoValida(v ?? VERSAO_PADRAO)

  const supabase = await createClient()
  const { data } = await supabase
    .from('biblia_marcacoes')
    .select('livro, capitulo, versiculo, cor, nota, updated_at')
    .eq('user_id', sessao.id)
    .order('livro')
    .order('capitulo')
    .order('versiculo')

  const marcacoes = data ?? []

  /* O texto de cada versículo marcado.
     Lemos capítulo por capítulo (e não versículo por versículo) porque o
     capítulo já vem inteiro da memória: buscar dez versículos do mesmo
     capítulo custa exatamente o mesmo que buscar um. */
  const capitulosNecessarios = new Map<string, { l: number; c: number }>()
  for (const m of marcacoes) {
    capitulosNecessarios.set(`${m.livro}:${m.capitulo}`, { l: m.livro, c: m.capitulo })
  }

  const textos = new Map<string, string[]>()
  for (const { l, c } of capitulosNecessarios.values()) {
    const lido = await lerCapitulo(versao.sigla, l, c)
    if (lido) textos.set(`${l}:${c}`, lido.versiculos)
  }

  // Agrupa por livro para a lista não virar um paredão de referências.
  const porLivro = new Map<number, typeof marcacoes>()
  for (const m of marcacoes) {
    porLivro.set(m.livro, [...(porLivro.get(m.livro) ?? []), m])
  }

  const totalGrifos = marcacoes.filter((m) => m.cor).length
  const totalNotas = marcacoes.filter((m) => m.nota).length

  return (
    <div className="p-5 sm:p-8">
      <Voltar
        href="/dashboard/biblia"
        label="Voltar à leitura"
        titulo="Minhas marcações"
        margem="mb-5"
      />

      <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-gray-900 sm:text-[26px]">
        Minhas marcações
      </h1>
      <p className="mt-1 text-[14px] text-gray-500">
        {marcacoes.length === 0
          ? 'Tudo o que você grifar ou anotar na Bíblia aparece aqui.'
          : `${totalGrifos} ${totalGrifos === 1 ? 'versículo grifado' : 'versículos grifados'} · ${totalNotas} ${totalNotas === 1 ? 'anotação' : 'anotações'}`}
      </p>

      {marcacoes.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-brand-950/[0.07] bg-white px-6 py-14 text-center shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-brand-200 bg-brand-50 text-brand-700">
            <Bookmark className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <p className="font-display text-[15px] font-bold text-gray-900">
            Sua Bíblia ainda está sem marcas
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-gray-500">
            Abra um capítulo, clique num versículo e escolha uma cor. O que você grifar fica
            guardado na sua conta e aparece em qualquer tradução.
          </p>
          <Link
            href="/dashboard/biblia"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-800"
          >
            Começar a ler
          </Link>
        </div>
      ) : (
        <div className="mt-7 space-y-7">
          {[...porLivro.entries()].map(([indiceLivro, itens]) => {
            const livro = LIVROS[indiceLivro]
            return (
              <div key={indiceLivro}>
                <div className="mb-3 flex items-center gap-2.5">
                  <h2 className="micro-rotulo text-[11px] font-extrabold tracking-[0.14em] text-[#41514a]">
                    {livro.nome.toUpperCase()}
                  </h2>
                  <span className="h-px flex-1 bg-gradient-to-r from-brand-950/[0.08] to-transparent" />
                  <span className="text-[11px] text-gray-400">
                    {itens.length} {itens.length === 1 ? 'marcação' : 'marcações'}
                  </span>
                </div>

                <div className="divide-y divide-brand-950/[0.06] overflow-hidden rounded-2xl border border-brand-950/[0.07] bg-white shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]">
                  {itens.map((m, i) => {
                    const texto = textos.get(`${m.livro}:${m.capitulo}`)?.[m.versiculo - 1]
                    const cor = (m.cor as CorGrifo | null) ?? null
                    return (
                      <Link
                        key={i}
                        href={`/dashboard/biblia?v=${versao.sigla}&l=${m.livro}&c=${m.capitulo}#v${m.versiculo}`}
                        className="block px-5 py-4 transition-colors hover:bg-[#f6faf8]"
                      >
                        <p className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.12em] text-brand-700">
                          {cor && (
                            <span className={`h-2.5 w-2.5 rounded-full ${PONTO[cor]}`} />
                          )}
                          {livro.nome.toUpperCase()} {m.capitulo}.{m.versiculo}
                        </p>

                        {texto && (
                          <p
                            className={`mt-1.5 rounded-md px-1.5 py-0.5 text-[14.5px] leading-relaxed text-gray-800 ${
                              cor ? FUNDO[cor] : ''
                            }`}
                          >
                            {texto}
                          </p>
                        )}

                        {m.nota && (
                          <p className="mt-2 flex gap-2 border-l-2 border-accent-400/50 bg-[#fdfaf2] py-1.5 pl-3 pr-2 text-[13px] leading-relaxed text-[#6b5426]">
                            <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                            <span className="whitespace-pre-line">{m.nota}</span>
                          </p>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
