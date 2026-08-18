'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, VideoOff, Eye, ShieldCheck } from 'lucide-react'
import { analisarVideo, marcaProgressoSozinho, COBERTURA_MINIMA } from '@/lib/video'
import { CadernoDoVideo } from '@/lib/assistido'
import { registrarProgresso } from '@/app/dashboard/aluno/actions'
import PlayerYouTube from '@/components/Aulas/PlayerYouTube'

interface Props {
  aulaId: string
  videoUrl: string | null
  concluidaInicial: boolean
  percentualInicial: number
  /** Título da aula — aparece na capa do player, no lugar do do YouTube. */
  titulo?: string
  /**
   * Modo pré-visualização (admin/professor testando a experiência do aluno).
   * O vídeo toca normalmente, mas nada é gravado: nem progresso, nem selo
   * de conclusão. Assim o teste não suja os dados de ninguém — e a trava de
   * avanço fica desligada, porque o professor precisa poder pular para
   * conferir um trecho específico.
   */
  somenteLeitura?: boolean
}

export default function VideoPlayer({
  aulaId,
  videoUrl,
  concluidaInicial,
  percentualInicial,
  titulo,
  somenteLeitura = false,
}: Props) {
  const info = analisarVideo(videoUrl)
  const [concluida, setConcluida] = useState(concluidaInicial)
  const [percentual, setPercentual] = useState(percentualInicial)
  const [salvando, setSalvando] = useState(false)
  const [falhouVideo, setFalhouVideo] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const ultimoEnviadoRef = useRef(percentualInicial)
  const concluidaRef = useRef(concluidaInicial)
  const restauradoRef = useRef(false)

  /**
   * O caderno de presença do vídeo.
   *
   * É ele que responde "quanto foi assistido de verdade". Vive numa ref
   * porque atravessa renderizações inteiras: se fosse estado, cada troca de
   * tela zeraria a contagem no meio da aula.
   */
  const [caderno] = useState(() => new CadernoDoVideo())

  const duracaoRef = useRef(0)

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
      const virouConcluida = arredondado >= COBERTURA_MINIMA && !concluidaRef.current

      if (!forcar && !virouConcluida && arredondado - ultimoEnviadoRef.current < 10) return
      if (arredondado <= ultimoEnviadoRef.current && !virouConcluida && !forcar) return

      ultimoEnviadoRef.current = Math.max(ultimoEnviadoRef.current, arredondado)
      if (virouConcluida) setSalvando(true)

      try {
        const r = await registrarProgresso(aulaId, arredondado, {
          segundosAssistidos: caderno.segundos,
          duracao: duracaoRef.current,
        })
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
    [aulaId, somenteLeitura, caderno]
  )

  /**
   * Devolve ao caderno o trecho que a pessoa já tinha assistido antes.
   *
   * Sem isto ela começaria do zero toda vez que reabrisse a aula — e, com a
   * trava de avanço ligada, ficaria presa no início de um vídeo que já
   * assistiu pela metade.
   *
   * O banco guarda só QUANTO foi assistido, não QUAIS trechos. Então o
   * caderno reconstrói o mais provável e o mais generoso: um bloco contínuo
   * desde o começo. Na prática é o que acontece — as pessoas assistem em
   * ordem.
   */
  const restaurar = useCallback((duracao: number) => {
    if (restauradoRef.current || duracao <= 0) return
    restauradoRef.current = true
    duracaoRef.current = duracao
    if (percentualInicial > 0) {
      caderno.restaurar((percentualInicial / 100) * duracao)
    }
  }, [percentualInicial, caderno])

  /**
   * Cada segundo de vídeo que passa pela tela é anotado no caderno.
   *
   * Repare que o percentual NÃO sai da posição da agulha: sai da contagem
   * do caderno. É essa troca que faz o pulo deixar de valer presença.
   */
  const aoRodar = useCallback((posicao: number, duracao: number) => {
    duracaoRef.current = duracao
    restaurar(duracao)

    caderno.marcar(posicao)
    const pct = caderno.percentual(duracao)
    setPercentual((atual) => Math.max(atual, Math.round(pct)))
    enviarProgresso(pct)
  }, [enviarProgresso, restaurar, caderno])

  /**
   * A reprodução começou (ou recomeçou depois de uma pausa). Avisar o ponto
   * exato de partida é o que fecha o buraco do primeiro segundo — sem isso o
   * limite de avanço não saía do zero e o vídeo voltava sozinho.
   */
  const aoIniciar = useCallback(
    (posicao: number) => {
      restaurar(duracaoRef.current)
      caderno.iniciar(posicao)
    },
    [caderno, restaurar]
  )

  const aoParar = useCallback(() => caderno.pausar(), [caderno])

  const limiteDeAvanco = useCallback(() => caderno.limiteDeAvanco, [caderno])

  /* Ao sair da aula, salva o que foi assistido — mesmo que não tenha
     batido o próximo marco de 10%. Sem isto, quem assiste 8 minutos e
     fecha a aba perde os 8 minutos. */
  useEffect(() => {
    return () => {
      if (somenteLeitura || duracaoRef.current <= 0) return
      const pct = caderno.percentual(duracaoRef.current)
      if (Math.round(pct) > ultimoEnviadoRef.current) {
        registrarProgresso(aulaId, Math.round(pct), {
          segundosAssistidos: caderno.segundos,
          duracao: duracaoRef.current,
        }).catch(() => {})
      }
    }
  }, [aulaId, somenteLeitura, caderno])

  /* ---------- Sem vídeo cadastrado ---------- */
  if (!videoUrl || info.tipo === 'desconhecido') {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 px-6 text-center ring-1 ring-gray-200">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-soft">
          <VideoOff className="h-7 w-7" strokeWidth={1.75} />
        </span>
        <p className="font-medium text-gray-600">Vídeo ainda não disponível</p>
        <p className="max-w-sm text-sm text-gray-500">
          {videoUrl
            ? 'O link cadastrado não foi reconhecido. O caminho mais simples é o YouTube como "não listado".'
            : 'Assim que o professor adicionar o vídeo, ele aparece aqui.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ---------- YouTube: player da casa, sem o YouTube em volta ---------- */}
      {info.tipo === 'youtube' && info.id && (
        <PlayerYouTube
          videoId={info.id}
          limiteDeAvanco={limiteDeAvanco}
          aoRodar={aoRodar}
          aoPronto={restaurar}
          aoIniciar={aoIniciar}
          aoParar={aoParar}
          titulo={titulo}
          livre={somenteLeitura || concluidaInicial}
        />
      )}

      {info.tipo !== 'youtube' && (
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-brand-950 shadow-float">
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
              ref={videoRef}
              src={info.embed ?? info.url}
              controls
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              className="h-full w-full"
              onTimeUpdate={(e) => {
                const v = e.currentTarget
                if (v.paused || v.duration <= 0) return
                aoRodar(v.currentTime, v.duration)
              }}
              onPlay={(e) => aoIniciar(e.currentTarget.currentTime)}
              onPause={aoParar}
              onSeeking={(e) => {
                // Mesma regra do player do YouTube: voltar é livre, adiantar
                // só até onde já foi assistido.
                if (somenteLeitura || concluidaInicial) return
                const v = e.currentTarget
                const limite = caderno.limiteDeAvanco
                if (v.currentTime > limite + 2) v.currentTime = Math.max(0, limite)
              }}
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
                  ? 'O OneDrive exige login da Microsoft para exibir vídeo — nenhum link dele abre para os alunos. Peça ao professor para subir a gravação no YouTube como "não listado" e mandar o link.'
                  : 'O endereço do vídeo não respondeu. Confira se o link continua válido.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Selo de conclusão + barra de progresso */}
      {somenteLeitura ? (
        <div className="rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800">
              <Eye className="h-3.5 w-3.5" strokeWidth={2.25} />
              Pré-visualização — seu progresso não é salvo
            </span>
            <span className="font-bold tabular-nums text-amber-800">{Math.round(percentual)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-amber-200/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-[width] duration-700"
              style={{ width: `${percentual}%` }}
            />
          </div>
        </div>
      ) : concluida ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-brand-50 to-brand-100/60 px-4 py-3 ring-1 ring-brand-200 animate-float-in">
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
        <div className="rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-200">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-gray-600">
              {salvando ? 'Registrando...' : 'Tempo de aula assistido'}
            </span>
            <span className="font-bold tabular-nums text-gray-700">{Math.round(percentual)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-[width] duration-700"
              style={{ width: `${percentual}%` }}
            />
          </div>

          {marcaProgressoSozinho(info) ? (
            <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-gray-500">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-brand-600" strokeWidth={2} />
              A presença conta o tempo assistido de verdade. Adiantar o vídeo não avança esta
              barra.
            </p>
          ) : (
            /* Google Drive e Vimeo tocam dentro da plataforma, mas não deixam
               ler o tempo do vídeo — então a conclusão fica na mão do aluno.
               Sem este botão, uma aula hospedada no Drive nunca geraria
               presença automática no EAD, e o aluno ficaria sem o selo. */
            <div className="mt-3 border-t border-gray-200 pt-3">
              <p className="mb-2 text-[11.5px] leading-snug text-gray-500">
                Este vídeo não consegue registrar seu avanço sozinho. Quando terminar de assistir,
                confirme aqui para receber o selo e a presença.
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
