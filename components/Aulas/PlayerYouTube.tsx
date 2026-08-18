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

   COMO SE RESOLVE — quatro camadas, e as quatro são necessárias
   1. O vídeo sobe com os controles do YouTube DESLIGADOS (`controls: 0`).
      Isso tira a barra dele, e faz com que nada apareça enquanto o vídeo
      está rodando.
   2. Uma CAPA OPACA cobre o quadro sempre que o vídeo NÃO está rodando.
      Foi o que faltou na primeira tentativa: `controls: 0` não impede o
      YouTube de desenhar, no estado parado, a foto e o nome do canal, o
      título, o botão de copiar link e o "Assistir no YouTube". Não existe
      parâmetro que desligue isso — a única saída é não deixar esse estado
      ser visto. Opaca, e não semitransparente: cortina fina só deixaria a
      marca do YouTube mais fraquinha.
   3. Uma camada transparente sobre o vídeo intercepta todo clique e todo
      movimento do mouse. Serve para duas coisas: nada por baixo pode ser
      clicado, e o player nunca "sente" o mouse — o que impede a chrome de
      passar o mouse por cima de aparecer durante a reprodução.
   4. O vídeo é pausado uma fração de segundo ANTES do fim. O YouTube só
      monta a grade de sugestões quando chega ao estado "terminou" — e ele
      nunca chega.

   Ainda: as legendas são descarregadas na mão (ver `desligarLegendas`), e o
   endereço usado é o youtube-nocookie.com, que não instala rastreio no
   navegador do aluno enquanto ele assiste.

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

const ESTADO = { TERMINOU: 0, TOCANDO: 1, PAUSADO: 2, BUFFERANDO: 3 }

/**
 * Desliga as legendas.
 *
 * `cc_load_policy: 0` só diz "não force a legenda"; ele não desliga a que
 * já veio ligada — seja porque o vídeo tem legenda padrão, seja porque a
 * conta do YouTube da pessoa pede legenda sempre. O jeito de desligar de
 * verdade é descarregar o módulo de legendas do player. São dois nomes
 * porque o player usa um ou outro conforme a versão que carregou.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function desligarLegendas(player: any) {
  try {
    player?.unloadModule?.('captions')
    player?.unloadModule?.('cc')
  } catch {
    // Player ainda engatinhando: tentamos de novo quando o vídeo começar.
  }
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
  /** Chamado quando a reprodução começa, com o ponto exato de partida. */
  aoIniciar?: (posicao: number) => void
  /** Chamado quando a reprodução para (pausa, buffer ou fim). */
  aoParar?: () => void
  /** Chamado quando o vídeo chega ao fim. */
  aoTerminar?: () => void
  /**
   * Entrega um controle do player para quem o montou.
   *
   * Existe por causa do caderno na segunda janela: quando o aluno clica num
   * minuto que anotou, o pedido chega de fora e alguém precisa mandar o
   * vídeo pular para lá.
   */
  aoMontar?: (controle: { irPara: (segundos: number) => void }) => void
  /** Sem trava de avanço (pré-visualização do professor). */
  livre?: boolean
  /** Título da aula, mostrado na capa. É o nosso, não o do YouTube. */
  titulo?: string
}

export default function PlayerYouTube({
  videoId,
  limiteDeAvanco,
  aoRodar,
  aoPronto,
  aoIniciar,
  aoParar,
  aoTerminar,
  aoMontar,
  livre = false,
  titulo,
}: PlayerYouTubeProps) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const alvoRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null)

  const [pronto, setPronto] = useState(false)
  const [tocando, setTocando] = useState(false)
  const [bufferando, setBufferando] = useState(false)
  const [comecou, setComecou] = useState(false)
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
  const aoIniciarRef = useRef(aoIniciar)
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
    aoIniciarRef.current = aoIniciar
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
            desligarLegendas(playerRef.current)
            const total = playerRef.current?.getDuration?.() ?? 0
            setDuracao(total)
            // Avisa a duração antes de tocar: é com ela que o caderno
            // devolve ao aluno o trecho que ele já tinha assistido — e o
            // limite de avanço já nasce certo, sem precisar dar play antes.
            if (total > 0) aoProntoRef.current?.(total)
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            const p = playerRef.current

            if (e.data === ESTADO.TOCANDO) {
              setTocando(true)
              setBufferando(false)
              setComecou(true)
              setTerminou(false)
              setDuracao(p?.getDuration?.() ?? 0)
              // Algumas legendas só entram depois que o vídeo começa.
              desligarLegendas(p)

              // Avisa em que ponto a reprodução COMEÇOU. Sem isso o segundo
              // inicial ficava sem marcação e o limite de avanço não saía do
              // lugar — era o que fazia o vídeo voltar sozinho.
              aoIniciarRef.current?.(p?.getCurrentTime?.() ?? 0)

              parar()
              timer = setInterval(() => {
                const player = playerRef.current
                if (!player?.getCurrentTime) return
                const atual = player.getCurrentTime()
                const total = player.getDuration?.() ?? 0
                setPosicao(atual)
                if (total > 0) setDuracao(total)

                // Rede de segurança da trava: se por qualquer caminho a
                // agulha foi parar muito à frente do que já foi assistido,
                // ela volta. (A barra já impede, mas isto cobre o resto.)
                if (!livreRef.current) {
                  const limite = limiteRef.current()
                  if (atual > limite + 8) {
                    player.seekTo?.(Math.max(0, limite - 1), true)
                    setAvisoTrava(true)
                    return
                  }
                }

                aoRodarRef.current(atual, total)

                // Pausa antes do fim: o YouTube só monta a grade de
                // sugestões quando o vídeo "termina" de verdade.
                if (total > 0 && atual >= total - 0.4) {
                  player.pauseVideo?.()
                  setTerminou(true)
                  setPosicao(total)
                  aoTerminarRef.current?.()
                }
              }, 1000)
              return
            }

            // Buffer NÃO é pausa: o vídeo continua no ar, só engasgou. Tratar
            // como pausa fazia a capa piscar por cima do vídeo a cada
            // travadinha de rede.
            if (e.data === ESTADO.BUFFERANDO) {
              setBufferando(true)
              aoPararRef.current?.()
              return
            }

            setTocando(false)
            setBufferando(false)
            parar()
            aoPararRef.current?.()
            if (e.data === ESTADO.TERMINOU) {
              setTerminou(true)
              aoTerminarRef.current?.()
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

  /* ---------------- Controle para quem está de fora ---------------- */
  useEffect(() => {
    if (!aoMontar) return
    aoMontar({
      irPara: (segundos: number) => {
        const p = playerRef.current
        if (!p?.seekTo) return
        p.seekTo(Math.max(0, segundos), true)
        setPosicao(segundos)
        setTerminou(false)
        p.playVideo?.()
      },
    })
  }, [aoMontar])

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

        {/* ===================================================
            A CAPA

            Aqui está a correção que faltava. Desligar os controles do
            YouTube (`controls: 0`) tira a barra dele, mas NÃO tira o que
            ele desenha quando o vídeo está parado: a foto e o nome do
            canal, o título, o botão de copiar link e o "Assistir no
            YouTube". Isso aparece antes de começar e toda vez que a
            pessoa pausa — e nenhum parâmetro de configuração desliga.

            A saída é simples e definitiva: enquanto o vídeo não está
            rodando, ele não é visto. Uma capa OPACA — não uma cortina
            semitransparente, que só deixaria a marca do YouTube mais
            fraquinha — cobre o quadro inteiro. Some no instante em que a
            reprodução começa, e volta quando pausa.

            Enquanto ROLA, o YouTube não desenha nada por conta própria:
            a chrome dele só aparece quando o player recebe o mouse, e a
            camada transparente acima intercepta todos os eventos antes.
            =================================================== */}
        {(!pronto || !tocando) && (
          <div
            data-capa=""
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[linear-gradient(150deg,#08130f,#0b1f18_55%,#0a2a20)] px-6 text-center"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_260px_at_50%_-20%,rgba(212,162,76,0.10),transparent_62%)]" />

            {!pronto ? (
              <Loader2 className="relative h-7 w-7 animate-spin text-white/50" strokeWidth={2} />
            ) : (
              <div className="relative">
                <span className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full border border-white/20 bg-white/[0.07] text-white backdrop-blur-md">
                  <Play className="ml-1 h-7 w-7 fill-current" strokeWidth={0} />
                </span>

                {titulo && (
                  <p className="mx-auto mt-4 max-w-md font-display text-[15px] font-bold leading-snug tracking-[-0.01em] text-white/90">
                    {titulo}
                  </p>
                )}

                <p className="micro-rotulo mt-2 text-[10px] font-bold tracking-[0.16em] text-accent-300/70">
                  {terminou
                    ? 'FIM DA AULA — CLIQUE PARA REVER'
                    : comecou
                      ? 'AULA PAUSADA — CLIQUE PARA CONTINUAR'
                      : 'ESCOLA DE LÍDERES IBAU'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Engasgo de rede: o vídeo continua no ar, então a capa não entra —
            só um giro discreto no canto, para a pessoa saber que é a
            conexão e não a plataforma. */}
        {bufferando && tocando && (
          <div className="pointer-events-none absolute right-3 top-3 z-20">
            <Loader2 className="h-5 w-5 animate-spin text-white/70" strokeWidth={2.2} />
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
