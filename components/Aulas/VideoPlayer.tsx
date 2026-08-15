'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, VideoOff, Loader2, Eye } from 'lucide-react'
import { analisarVideo, marcaProgressoSozinho, PERCENTUAL_CONCLUSAO } from '@/lib/video'
import { registrarProgresso } from '@/app/dashboard/aluno/actions'

interface Props {
  aulaId: string
  videoUrl: string | null
  concluidaInicial: boolean
  percentualInicial: number
  /**
   * Modo pré-visualização (admin/professor testando a experiência do aluno).
   * O vídeo toca normalmente, mas nada é gravado: nem progresso, nem selo
   * de conclusão. Assim o teste não suja os dados de ninguém.
   */
  somenteLeitura?: boolean
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
  somenteLeitura = false,
}: Props) {
  const info = analisarVideo(videoUrl)
  const [concluida, setConcluida] = useState(concluidaInicial)
  const [percentual, setPercentual] = useState(percentualInicial)
  const [salvando, setSalvando] = useState(false)
  const [falhouVideo, setFalhouVideo] = useState(false)
  const [carregandoPlayer, setCarregandoPlayer] = useState(info.tipo === 'youtube')

  const containerRef = useRef<HTMLDivElement>(null)
  const ultimoEnviadoRef = useRef(percentualInicial)
  const concluidaRef = useRef(concluidaInicial)

  /* Envia progresso, mas sem inundar o servidor: só a cada 10 pontos
     percentuais, ou imediatamente quando a aula é concluída. */
  const enviarProgresso = useCallback(
    async (pct: number, forcar = false) => {
      // Em pré-visualização apenas acompanhamos na tela, sem gravar nada.
      if (somenteLeitura) {
        setPercentual((atual) => Math.max(atual, Math.round(pct)))
        return
      }

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
    [aulaId, somenteLeitura]
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
            ? 'O link cadastrado não foi reconhecido. Use YouTube, Google Drive, Vimeo ou link direto de vídeo.'
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

        {(info.tipo === 'vimeo' || info.tipo === 'drive' || info.iframe) && (
          <iframe
            src={info.embed}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Vídeo da aula"
          />
        )}

        {(info.tipo === 'arquivo' || info.tipo === 'onedrive') && !info.iframe && !falhouVideo && (
          <video
            src={info.embed ?? info.url}
            controls
            controlsList="nodownload"
            className="h-full w-full"
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.duration > 0) enviarProgresso((v.currentTime / v.duration) * 100)
            }}
            onEnded={() => enviarProgresso(100, true)}
            onError={() => setFalhouVideo(true)}
          />
        )}

        {/* O link do OneDrive só toca se o arquivo estiver compartilhado
            publicamente. Quando não está, o navegador não diz o motivo —
            então explicamos aqui, em vez de deixar uma tela preta. */}
        {falhouVideo && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
            <VideoOff className="h-7 w-7 text-white/50" strokeWidth={1.75} />
            <p className="text-[14px] font-semibold text-white">Não consegui abrir este vídeo</p>
            <p className="max-w-sm text-[12.5px] leading-relaxed text-white/60">
              {info.tipo === 'onedrive'
                ? 'Os links novos do OneDrive exigem sessão da Microsoft. Abra o vídeo no OneDrive, use "Incorporar" e cole aqui o código que aparecer — a plataforma aceita o código inteiro.'
                : 'O endereço do vídeo não respondeu. Confira se o link continua válido.'}
            </p>
          </div>
        )}
      </div>

      {/* Selo de conclusão + barra de progresso */}
      {somenteLeitura ? (
        <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-amber-800 inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" strokeWidth={2.25} />
              Pré-visualização — seu progresso não é salvo
            </span>
            <span className="font-bold text-amber-800 tabular-nums">
              {Math.round(percentual)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-amber-200/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-[width] duration-700"
              style={{ width: `${percentual}%` }}
            />
          </div>
        </div>
      ) : concluida ? (
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

          {/* Google Drive e Vimeo tocam dentro da plataforma, mas não deixam
              ler o tempo do vídeo — então a conclusão fica na mão do aluno.
              Sem este botão, uma aula hospedada no Drive nunca geraria
              presença automática no EAD, e o aluno ficaria sem o selo. */}
          {!marcaProgressoSozinho(info) && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <p className="mb-2 text-[11.5px] leading-snug text-gray-500">
                Este vídeo não consegue registrar seu avanço sozinho. Quando terminar de
                assistir, confirme aqui para receber o selo e a presença.
              </p>
              <button
                type="button"
                disabled={salvando}
                onClick={() => enviarProgresso(100, true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
              >
                <CheckCircle2 className="h-[15px] w-[15px]" strokeWidth={2.2} />
                {salvando ? 'Registrando...' : 'Marcar aula como assistida'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
