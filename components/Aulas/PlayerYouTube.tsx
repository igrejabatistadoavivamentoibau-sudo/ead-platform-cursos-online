'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Lock, Loader2 } from 'lucide-react'

/* ============================================================
   PLAYER DE AULA — o vídeo do YouTube sem o YouTube em volta.

   POR QUE NÃO USAR O PLAYER PRONTO
   Ele traz o canal de origem junto: título clicável, botão "Assistir no
   YouTube", e no fim uma grade de vídeos sugeridos. Numa escola da igreja
   isso é ruim por dois motivos — tira o aluno da plataforma no meio da
   aula, e mistura a formação com o que quer que o YouTube resolva sugerir
   depois.

   COMO SE RESOLVE
   1. O vídeo sobe com os controles do YouTube DESLIGADOS (`controls: 0`).
      Sem controles, ele não desenha barra, nem título, nem botão nenhum.
   2. Uma camada transparente cobre o quadro inteiro. Nada que esteja por
      baixo pode ser clicado — nem um logo que apareça em algum estado que
      não previmos. Essa camada é o nosso play/pause.
   3. A barra de controle abaixo é nossa, com a cara da plataforma.
   4. O vídeo é pausado uma fração de segundo ANTES do fim. O YouTube só
      monta a grade de sugestões quando chega ao estado "terminou" — e ele
      nunca chega.
   5. O endereço usado é o youtube-nocookie.com, que não instala rastreio
      no navegador do aluno enquanto ele assiste.

   A TRAVA DE AVANÇO
   A barra só deixa clicar até onde o aluno já assistiu. Voltar é livre.
   Isso não é implicância: a presença da aula depende do tempo assistido,
   e uma barra que convida ao pulo mas não conta o pulo seria uma armadilha
   silenciosa — a pessoa acharia que terminou e não teria presença.
   ============================================================ */

/* A API de iframe do YouTube é carregada sob demanda e uma única vez. */
let promessaYT: Promise<void> | null = null
function carregarApiYouTube(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).YT?.Player) return Promise.resolve()

  if (!promessaYT) {
    promessaYT = new Promise<void>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anterior = (window as any).onYouTubeIframeAPIReady
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).onYouTubeIframeAPIReady = () => {
        if (typeof anterior === 'function') anterior()
        resolve()
      }
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.head.appendChild(script)
    })
  }
  return promessaYT
}

function relogio(segundos: number) {
  if (!Number.isFinite(segundos) || segundos < 0) return '0:00'
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = Math.floor(segundos % 60)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

export interface PlayerYouTubeProps {
  videoId: string
  /**
   * Até onde o aluno pode adiantar, em segundos. Lida no momento do clique
   * — por isso é uma função, e não um número: ela cresce enquanto assiste.
   */
  limiteDeAvanco: () => number
  /** Chamado a cada segundo enquanto o vídeo roda. */
  aoRodar: (posicao: number, duracao: number) => void
  /** Chamado assim que a duração do vídeo é conhecida, antes de tocar. */
  aoPronto?: (duracao: number) => void
  /** Chamado quando a reprodução para (pausa, buffer ou fim). */
  aoParar?: () => void
  /** Chamado quando o vídeo chega ao fim. */
  aoTerminar?: () => void
  /** Sem trava de avanço (pré-visualização do professor). */
  livre?: boolean
}

export default function PlayerYouTube({
  videoId,
  limiteDeAvanco,
  aoRodar,
  aoPronto,
  aoParar,
  aoTerminar,
  livre = false,
}: PlayerYouTubeProps) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const alvoRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null)

  const [pronto, setPronto] = useState(false)
  const [tocando, setTocando] = useState(false)
  const [mudo, setMudo] = useState(false)
  const [posicao, setPosicao] = useState(0)
  const [duracao, setDuracao] = useState(0)
  const [telaCheia, setTelaCheia] = useState(false)
  const [terminou, setTerminou] = useState(false)
  const [avisoTrava, setAvisoTrava] = useState(false)

  // Guardadas em ref para o efeito de montagem não depender delas: o player
  // é criado UMA vez. Recriá-lo a cada renderização faria o vídeo recomeçar.
  const aoRodarRef = useRef(aoRodar)
  const aoProntoRef = useRef(aoPronto)
  const aoPararRef = useRef(aoParar)
  const aoTerminarRef = useRef(aoTerminar)
  const limiteRef = useRef(limiteDeAvanco)
  const livreRef = useRef(livre)
  // A atualização acontece depois da renderização, e não durante: escrever
  // em ref no meio do render é justamente o tipo de efeito colateral que o
  // React pede para evitar. O laço de leitura roda de segundo em segundo,
  // então sempre pega a versão mais recente.
  useEffect(() => {
    aoRodarRef.current = aoRodar
    aoProntoRef.current = aoPronto
    aoPararRef.current = aoParar
    aoTerminarRef.current = aoTerminar
    limiteRef.current = limiteDeAvanco
    livreRef.current = livre
  })

  /* ---------------- Criação do player ---------------- */
  useEffect(() => {
    let cancelado = false
    let timer: ReturnType<typeof setInterval> | null = null

    const parar = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    carregarApiYouTube().then(() => {
      if (cancelado || !alvoRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT

      playerRef.current = new YT.Player(alvoRef.current, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          controls: 0, // sem a barra do YouTube
          modestbranding: 1,
          rel: 0, // nada de vídeos de outros canais
          iv_load_policy: 3, // sem cartõezinhos por cima do vídeo
          disablekb: 1, // o teclado do YouTube não pula o vídeo
          fs: 0, // a tela cheia é a nossa
          playsinline: 1,
          cc_load_policy: 0,
        },
        events: {
          onReady: () => {
            if (cancelado) return
            setPronto(true)
            const total = playerRef.current?.getDuration?.() ?? 0
            setDuracao(total)
            // Avisa a duração antes de tocar: é com ela que o caderno
            // devolve ao aluno o trecho que ele já tinha assistido — e o
            // limite de avanço já nasce certo, sem precisar dar play antes.
            if (total > 0) aoProntoRef.current?.(total)
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            const ESTADO = { TERMINOU: 0, TOCANDO: 1, PAUSADO: 2 }

            if (e.data === ESTADO.TOCANDO) {
              setTocando(true)
              setTerminou(false)
              setDuracao(playerRef.current?.getDuration?.() ?? 0)

              parar()
              timer = setInterval(() => {
                const p = playerRef.current
                if (!p?.getCurrentTime) return
                const atual = p.getCurrentTime()
                const total = p.getDuration?.() ?? 0
                setPosicao(atual)
                if (total > 0) setDuracao(total)

                // Rede de segurança da trava: se por qualquer caminho a
                // agulha foi parar muito à frente do que já foi assistido,
                // ela volta. (A barra já impede, mas isto cobre o resto.)
                if (!livreRef.current) {
                  const limite = limiteRef.current()
                  if (atual > limite + 5) {
                    p.seekTo?.(Math.max(0, limite), true)
                    setAvisoTrava(true)
                    return
                  }
                }

                aoRodarRef.current(atual, total)

                // Pausa antes do fim: o YouTube só monta a grade de
                // sugestões quando o vídeo "termina" de verdade.
                if (total > 0 && atual >= total - 0.4) {
                  p.pauseVideo?.()
                  setTerminou(true)
                  setPosicao(total)
                  aoTerminarRef.current?.()
                }
              }, 1000)
            } else {
              setTocando(false)
              parar()
              aoPararRef.current?.()
              if (e.data === ESTADO.TERMINOU) {
                setTerminou(true)
                aoTerminarRef.current?.()
              }
            }
          },
        },
      })
    })

    return () => {
      cancelado = true
      parar()
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [videoId])

  /* ---------------- Tela cheia ---------------- */
  useEffect(() => {
    const aoMudar = () => setTelaCheia(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', aoMudar)
    return () => document.removeEventListener('fullscreenchange', aoMudar)
  }, [])

  useEffect(() => {
    if (!avisoTrava) return
    const t = setTimeout(() => setAvisoTrava(false), 3200)
    return () => clearTimeout(t)
  }, [avisoTrava])

  /* ---------------- Comandos ---------------- */
  const alternarPlay = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    if (terminou) {
      p.seekTo?.(0, true)
      setTerminou(false)
      p.playVideo?.()
      return
    }
    if (tocando) p.pauseVideo?.()
    else p.playVideo?.()
  }, [tocando, terminou])

  const alternarMudo = () => {
    const p = playerRef.current
    if (!p) return
    if (p.isMuted?.()) {
      p.unMute?.()
      setMudo(false)
    } else {
      p.mute?.()
      setMudo(true)
    }
  }

  const alternarTelaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else caixaRef.current?.requestFullscreen?.()
  }

  const irPara = (evento: React.MouseEvent<HTMLDivElement>) => {
    const p = playerRef.current
    if (!p || duracao <= 0) return

    const caixa = evento.currentTarget.getBoundingClientRect()
    const fracao = Math.min(1, Math.max(0, (evento.clientX - caixa.left) / caixa.width))
    const destino = fracao * duracao

    if (!livre) {
      const limite = limiteRef.current()
      if (destino > limite + 1) {
        setAvisoTrava(true)
        return
      }
    }

    p.seekTo?.(destino, true)
    setPosicao(destino)
    setTerminou(false)
  }

  const pctTocado = duracao > 0 ? (posicao / duracao) * 100 : 0
  const pctLiberado = livre ? 100 : duracao > 0 ? Math.min(100, (limiteDeAvanco() / duracao) * 100) : 0

  return (
    <div
      ref={caixaRef}
      className="group/player relative overflow-hidden rounded-2xl bg-black shadow-[0_1px_2px_rgba(5,38,29,0.06),0_24px_48px_-24px_rgba(5,38,29,0.5)]"
    >
      <div className={telaCheia ? 'relative h-[calc(100vh-58px)] w-full' : 'relative aspect-video w-full'}>
        <div ref={alvoRef} className="h-full w-full" />

        {/* A camada que isola o vídeo do YouTube em volta dele.
            Tudo o que está por baixo fica inclicável — e um clique aqui é
            simplesmente dar play ou pausa, como em qualquer player. */}
        <button
          type="button"
          onClick={alternarPlay}
          aria-label={tocando ? 'Pausar' : 'Reproduzir'}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer bg-transparent"
        />

        {!pronto && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black">
            <Loader2 className="h-7 w-7 animate-spin text-white/60" strokeWidth={2} />
          </div>
        )}

        {/* Botão central: aparece parado e some tocando. */}
        {pronto && !tocando && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <span className="grid h-[68px] w-[68px] place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md">
              <Play className="ml-1 h-7 w-7 fill-current" strokeWidth={0} />
            </span>
          </div>
        )}

        {/* Fim da aula — a nossa tela final, no lugar da grade de sugestões. */}
        {terminou && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-gradient-to-b from-black/70 to-black/85 px-6 text-center">
            <div>
              <p className="font-display text-[17px] font-bold text-white">Fim da aula</p>
              <p className="mt-1 text-[12.5px] text-white/60">
                Clique no vídeo para assistir de novo.
              </p>
            </div>
          </div>
        )}

        {/* Aviso da trava */}
        {avisoTrava && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-4">
            <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3.5 py-2 text-[12px] font-semibold text-white backdrop-blur-md">
              <Lock className="h-3.5 w-3.5 text-accent-300" strokeWidth={2.2} />
              Você ainda não assistiu até aqui — a aula avança junto com você.
            </span>
          </div>
        )}
      </div>

      {/* ---------------- Barra de controle da casa ---------------- */}
      <div className="relative z-20 bg-[#0b0f0e] px-3 pb-2.5 pt-1.5">
        <div
          onClick={irPara}
          className="group/barra relative h-4 cursor-pointer"
          role="slider"
          aria-label="Posição do vídeo"
          aria-valuenow={Math.round(pctTocado)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        >
          <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/15">
            {/* Trecho liberado — o quanto já foi assistido */}
            <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${pctLiberado}%` }} />
            {/* Onde a agulha está */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-accent-400"
              style={{ width: `${pctTocado}%` }}
            />
          </div>
          <span
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity group-hover/barra:opacity-100"
            style={{ left: `${pctTocado}%` }}
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={alternarPlay}
            aria-label={tocando ? 'Pausar' : 'Reproduzir'}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            {tocando ? (
              <Pause className="h-[17px] w-[17px] fill-current" strokeWidth={0} />
            ) : (
              <Play className="ml-px h-[17px] w-[17px] fill-current" strokeWidth={0} />
            )}
          </button>

          <button
            type="button"
            onClick={alternarMudo}
            aria-label={mudo ? 'Ativar som' : 'Silenciar'}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            {mudo ? (
              <VolumeX className="h-[17px] w-[17px]" strokeWidth={1.9} />
            ) : (
              <Volume2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
            )}
          </button>

          <span className="font-mono text-[11.5px] tabular-nums text-white/60">
            {relogio(posicao)} <span className="text-white/25">/</span> {relogio(duracao)}
          </span>

          <span className="ml-auto" />

          {!livre && pctLiberado < 99.5 && (
            <span className="hidden items-center gap-1.5 text-[10.5px] font-semibold text-white/45 sm:flex">
              <Lock className="h-3 w-3" strokeWidth={2.2} />
              avanço liberado até {relogio((pctLiberado / 100) * duracao)}
            </span>
          )}

          <button
            type="button"
            onClick={alternarTelaCheia}
            aria-label={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            {telaCheia ? (
              <Minimize className="h-[16px] w-[16px]" strokeWidth={2} />
            ) : (
              <Maximize className="h-[16px] w-[16px]" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
