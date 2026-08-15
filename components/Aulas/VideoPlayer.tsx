'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, VideoOff, Loader2 } from 'lucide-react'
import { analisarVideo, PERCENTUAL_CONCLUSAO } from '@/lib/video'
import { registrarProgresso } from '@/app/dashboard/aluno/actions'

interface Props {
  aulaId: string
  videoUrl: string | null
  concluidaInicial: boolean
  percentualInicial: number
}

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

export default function VideoPlayer({
  aulaId,
  videoUrl,
  concluidaInicial,
  percentualInicial,
}: Props) {
  const info = analisarVideo(videoUrl)
  const [concluida, setConcluida] = useState(concluidaInicial)
  const [percentual, setPercentual] = useState(percentualInicial)
  const [salvando, setSalvando] = useState(false)
  const [carregandoPlayer, setCarregandoPlayer] = useState(info.tipo === 'youtube')

  const containerRef = useRef<HTMLDivElement>(null)
  const ultimoEnviadoRef = useRef(percentualInicial)
  const concluidaRef = useRef(concluidaInicial)

  /* Envia progresso, mas sem inundar o servidor: só a cada 10 pontos
     percentuais, ou imediatamente quando a aula é concluída. */
  const enviarProgresso = useCallback(
    async (pct: number, forcar = false) => {
      const arredondado = Math.round(pct)
      const virouConcluida = arredondado >= PERCENTUAL_CONCLUSAO && !concluidaRef.current

      if (!forcar && !virouConcluida && arredondado - ultimoEnviadoRef.current < 10) return
      if (arredondado <= ultimoEnviadoRef.current && !virouConcluida) return

      ultimoEnviadoRef.current = arredondado
      if (virouConcluida) setSalvando(true)

      try {
        const r = await registrarProgresso(aulaId, arredondado)
        if (r.concluida) {
          concluidaRef.current = true
          setConcluida(true)
        }
        setPercentual(r.percentual)
      } catch {
        // Falha de rede não deve atrapalhar a aula — tenta de novo no
        // próximo marco de progresso.
      } finally {
        setSalvando(false)
      }
    },
    [aulaId]
  )

  /* ---------- YouTube ---------- */
  useEffect(() => {
    if (info.tipo !== 'youtube' || !info.id || !containerRef.current) return

    let player: { destroy?: () => void; getCurrentTime?: () => number; getDuration?: () => number } | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let cancelado = false

    carregarApiYouTube().then(() => {
      if (cancelado || !containerRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window as any).YT

      player = new YT.Player(containerRef.current, {
        videoId: info.id,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => setCarregandoPlayer(false),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            // 1 = tocando, 0 = terminou
            if (e.data === 1 && !timer) {
              timer = setInterval(() => {
                const atual = player?.getCurrentTime?.() ?? 0
                const total = player?.getDuration?.() ?? 0
                if (total > 0) enviarProgresso((atual / total) * 100)
              }, 3000)
            }
            if (e.data !== 1 && timer) {
              clearInterval(timer)
              timer = null
            }
            if (e.data === 0) enviarProgresso(100, true)
          },
        },
      })
    })

    return () => {
      cancelado = true
      if (timer) clearInterval(timer)
      player?.destroy?.()
    }
  }, [info.tipo, info.id, enviarProgresso])

  /* ---------- Sem vídeo cadastrado ---------- */
  if (!videoUrl || info.tipo === 'desconhecido') {
    return (
      <div className="aspect-video w-full rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 ring-1 ring-gray-200 flex flex-col items-center justify-center gap-3 text-center px-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-soft">
          <VideoOff className="h-7 w-7" strokeWidth={1.75} />
        </span>
        <p className="text-gray-600 font-medium">Vídeo ainda não disponível</p>
        <p className="text-sm text-gray-500 max-w-sm">
          {videoUrl
            ? 'O link cadastrado não é de um vídeo reconhecido (YouTube, Vimeo ou arquivo de vídeo).'
            : 'Assim que o professor adicionar o vídeo, ele aparece aqui.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-brand-950 shadow-float">
        {info.tipo === 'youtube' && (
          <>
            {carregandoPlayer && (
              <div className="absolute inset-0 flex items-center justify-center text-white/70">
                <Loader2 className="h-7 w-7 animate-spin" strokeWidth={2} />
              </div>
            )}
            <div ref={containerRef} className="h-full w-full" />
          </>
        )}

        {info.tipo === 'vimeo' && (
          <iframe
            src={`https://player.vimeo.com/video/${info.id}`}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Vídeo da aula"
          />
        )}

        {info.tipo === 'arquivo' && (
          <video
            src={info.url}
            controls
            controlsList="nodownload"
            className="h-full w-full"
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.duration > 0) enviarProgresso((v.currentTime / v.duration) * 100)
            }}
            onEnded={() => enviarProgresso(100, true)}
          />
        )}
      </div>

      {/* Selo de conclusão + barra de progresso */}
      {concluida ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-brand-50 to-brand-100/60 ring-1 ring-brand-200 px-4 py-3 animate-float-in">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-glow">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-sm font-bold text-brand-800">Aula concluída!</p>
            <p className="text-xs text-brand-700/80">
              Você assistiu esta aula por completo. Bom trabalho.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 px-4 py-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-gray-600">
              {salvando ? 'Registrando...' : 'Seu progresso nesta aula'}
            </span>
            <span className="font-bold text-gray-700 tabular-nums">{Math.round(percentual)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-[width] duration-700"
              style={{ width: `${percentual}%` }}
            />
          </div>
          {info.tipo === 'vimeo' && (
            <p className="text-[11px] text-gray-500 mt-2">
              Vídeos do Vimeo ainda não marcam conclusão automática.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
