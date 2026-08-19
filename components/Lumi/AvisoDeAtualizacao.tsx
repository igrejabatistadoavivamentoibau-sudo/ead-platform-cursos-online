'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Sparkles, RefreshCw, X } from 'lucide-react'

/**
 * A LUMI avisando que a página está rodando código velho.
 *
 * A PERGUNTA CERTA
 * As versões anteriores comparavam com a última versão que a pessoa tinha
 * "visto" ou carregado em memória. Isso gerava um incômodo real: depois de
 * recarregar a página manualmente — já com o código novo rodando — o aviso
 * continuava pedindo para atualizar de novo, porque a marca só avançava no
 * clique do botão.
 *
 * A pergunta correta não é "o que ela viu por último?", e sim: **o código
 * que ESTA página está executando é o mesmo que está publicado?** Se for,
 * não há o que atualizar, ponto. Se não for, ela está mesmo defasada.
 *
 * A versão desta página vem do servidor no momento em que ela é montada
 * (ver o layout), então é o retrato fiel do que o navegador carregou.
 */
/**
 * De quanto em quanto tempo a LUMI pergunta se saiu versão nova.
 *
 * Eram 45 segundos, e na prática isso significava a escola publicando uma
 * atualização e ficando apertando F5 para ver se já entrou — que é
 * exatamente o trabalho que a LUMI existe para poupar. Doze segundos é
 * barato (a resposta é uma linha de texto) e faz o aviso chegar enquanto a
 * pessoa ainda está olhando para a tela.
 */
const INTERVALO_MS = 12 * 1000

/** Última versão que a LUMI já anunciou como "você chegou nela". */
const CHAVE_ANUNCIADA = 'ibau:versao-anunciada'
/** Chave da era anterior — serve só para migrar quem já usava a plataforma. */
const CHAVE_ANTIGA = 'ibau:versao-vista'

export default function AvisoDeAtualizacao({ versaoDaPagina }: { versaoDaPagina: string }) {
  const [temNova, setTemNova] = useState(false)
  const [dispensado, setDispensado] = useState(false)
  const [recarregando, setRecarregando] = useState(false)
  const [chegouNaNova, setChegouNaNova] = useState(false)

  /**
   * O ANÚNCIO DE CHEGADA
   *
   * O aviso de atualizar só aparece quando a página está DEFASADA — e isso
   * criou um silêncio estranho: quem abria o site depois do deploy já
   * entrava direto na versão nova e não via nada. A atualização acontecia,
   * mas parecia que não. ("A LUMI não avisou nada da v29.")
   *
   * São dois momentos diferentes, com mensagens diferentes:
   *   página velha  -> "tem versão nova, clique para atualizar" (botão)
   *   página nova   -> "você já está na versão nova!" (só celebração)
   *
   * O anúncio dispara uma única vez por versão, comparando a versão desta
   * página com a última que já foi anunciada neste navegador.
   */
  useEffect(() => {
    if (!versaoDaPagina || versaoDaPagina === 'desenvolvimento') return
    const anunciada = localStorage.getItem(CHAVE_ANUNCIADA)
    const marcaAntiga = localStorage.getItem(CHAVE_ANTIGA)

    if (anunciada === versaoDaPagina) return

    // Primeira visita de todas neste navegador: nada a celebrar ainda —
    // exceto se a chave da era anterior existir, sinal de que a pessoa já
    // usava a plataforma e ACABOU de cair numa versão mais nova.
    if (!anunciada && !marcaAntiga) {
      localStorage.setItem(CHAVE_ANUNCIADA, versaoDaPagina)
      return
    }

    localStorage.setItem(CHAVE_ANUNCIADA, versaoDaPagina)
    setChegouNaNova(true)
    const t = setTimeout(() => setChegouNaNova(false), 9000)
    return () => clearTimeout(t)
  }, [versaoDaPagina])

  const verificar = useCallback(async () => {
    if (!versaoDaPagina || versaoDaPagina === 'desenvolvimento') return
    try {
      const r = await fetch('/api/versao', { cache: 'no-store' })
      if (!r.ok) return
      const { versao } = (await r.json()) as { versao: string }
      if (!versao || versao === 'desenvolvimento') return

      // Defasada = o que está publicado difere do que esta aba carregou.
      setTemNova(versao !== versaoDaPagina)
    } catch {
      // Sem internet no momento não é assunto da LUMI — ela tenta depois.
    }
  }, [versaoDaPagina])

  useEffect(() => {
    verificar()
    const timer = setInterval(verificar, INTERVALO_MS)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') verificar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', verificar)
    window.addEventListener('online', verificar)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', verificar)
      window.removeEventListener('online', verificar)
    }
  }, [verificar])

  /**
   * Recarrega buscando tudo de novo do servidor.
   *
   * Um simples reload pode reaproveitar arquivos guardados pelo navegador e
   * montar uma mistura de código novo com estilo velho — foi assim que
   * apareceu aquela tela branca com os textos sem formatação. Trocar o
   * endereço por um com marca de tempo obriga a buscar tudo outra vez.
   */
  const atualizar = () => {
    setRecarregando(true)
    const url = new URL(window.location.href)
    url.searchParams.set('v', Date.now().toString(36))
    window.location.replace(url.toString())
  }

  // O anúncio de chegada só aparece se não houver defasagem para resolver:
  // "atualize" e "você já está atualizado" juntos seriam contraditórios.
  if ((!temNova || dispensado) && chegouNaNova) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-sm animate-float-in sm:left-auto sm:right-6 sm:mx-0">
        <div className="overflow-hidden rounded-2xl bg-white shadow-deep ring-1 ring-brand-950/10">
          <div className="flex items-center gap-3 p-4">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-brand-500/25">
              <Image src="/lumi-avatar.png" alt="LUMI" fill sizes="40px" className="object-cover" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13.5px] font-bold text-gray-900">
                A plataforma foi atualizada ✨
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500">
                Você já está na versão mais nova. Bom proveito!
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px]">
                <Sparkles className="h-2.5 w-2.5 text-accent-500" strokeWidth={2.4} />
                <span className="font-display font-bold text-brand-700">LUMI</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChegouNaNova(false)}
              aria-label="Fechar"
              className="shrink-0 text-gray-300 transition-colors hover:text-gray-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-1 bg-gradient-to-r from-brand-500 via-accent-400 to-brand-500" />
        </div>
      </div>
    )
  }

  if (!temNova || dispensado) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-md animate-float-in sm:left-auto sm:right-6 sm:mx-0">
      <div className="overflow-hidden rounded-2xl bg-white shadow-deep ring-1 ring-brand-950/10">
        <div className="flex items-start gap-3 p-4">
          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-brand-500/25">
            <Image src="/lumi-avatar.png" alt="LUMI" fill sizes="44px" className="object-cover" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-bold text-gray-900">
              Nova versão disponível!
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
              Saiu uma atualização enquanto você estava aqui. Clique para carregar as novidades —
              leva um instante.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={recarregando}
                onClick={atualizar}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-[15px] w-[15px] ${recarregando ? 'animate-spin' : ''}`}
                  strokeWidth={2.2}
                />
                {recarregando ? 'Atualizando...' : 'Atualizar agora'}
              </button>
              <button
                type="button"
                onClick={() => setDispensado(true)}
                className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold text-gray-500 transition-colors hover:bg-gray-100"
              >
                Depois
              </button>
            </div>

            <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px]">
              <Sparkles className="h-3 w-3 text-accent-500" strokeWidth={2.4} />
              <span className="font-display font-bold text-brand-700">LUMI</span>
              <span className="text-gray-400">· sua assistente na Escola de Líderes</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDispensado(true)}
            aria-label="Fechar aviso"
            className="shrink-0 text-gray-300 transition-colors hover:text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-1 bg-gradient-to-r from-brand-500 via-accent-400 to-brand-500" />
      </div>
    </div>
  )
}
