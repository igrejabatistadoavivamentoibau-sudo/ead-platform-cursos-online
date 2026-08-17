export type TipoVideo = 'youtube' | 'vimeo' | 'drive' | 'onedrive' | 'arquivo' | 'desconhecido'

export interface VideoInfo {
  tipo: TipoVideo
  id?: string
  url: string
  /** Endereço pronto para tocar dentro da plataforma (iframe/player). */
  embed?: string
  /** Precisa ser exibido em iframe (player da origem) em vez de <video>. */
  iframe?: boolean
}

/**
 * Descobre de onde vem o vídeo a partir do link colado pelo professor.
 *
 * Aceita YouTube (normal, curto, embed, live e shorts), Vimeo, Google Drive
 * e arquivos de vídeo diretos (.mp4 etc). Em todos os casos o vídeo abre
 * DENTRO da plataforma — o link nunca leva o aluno para fora.
 *
 * O Google Drive entrou aqui porque é a saída natural para gravação de
 * culto ou de aula presencial: são arquivos grandes demais para enviar
 * pela plataforma, e a igreja normalmente já tem o arquivo no Drive.
 */
export function analisarVideo(url: string | null | undefined): VideoInfo {
  let limpa = (url ?? '').trim()
  if (!limpa) return { tipo: 'desconhecido', url: '' }

  // Se a pessoa colou o código de incorporação inteiro (<iframe src="...">),
  // pegamos o endereço de dentro. É o caso mais comum de "colei e não
  // funcionou": o botão Incorporar do OneDrive e do Google Drive copia o
  // bloco de HTML completo, não só o endereço.
  const dentroDoIframe = limpa.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i)
  if (dentroDoIframe) limpa = dentroDoIframe[1].trim()

  const youtube =
    limpa.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (youtube) return { tipo: 'youtube', id: youtube[1], url: limpa }

  const vimeo = limpa.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) {
    return { tipo: 'vimeo', id: vimeo[1], url: limpa, embed: `https://player.vimeo.com/video/${vimeo[1]}` }
  }

  // Google Drive aceita duas formas de link, e as duas são comuns:
  //   .../file/d/ID/view    e    ...open?id=ID
  const drive =
    limpa.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/) ??
    limpa.match(/drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/) ??
    limpa.match(/docs\.google\.com\/.*[?&]id=([A-Za-z0-9_-]+)/)
  if (drive) {
    return {
      tipo: 'drive',
      id: drive[1],
      url: limpa,
      embed: `https://drive.google.com/file/d/${drive[1]}/preview`,
    }
  }

  // OneDrive / SharePoint.
  //
  // O link curto (1drv.ms) não mostra o id do arquivo em lugar nenhum, então
  // não dá para montar um endereço de player a partir dele por leitura. A
  // Microsoft resolve isso com uma API pública de compartilhamento: você
  // codifica o PRÓPRIO link em base64 e pede o conteúdo. É o caminho oficial
  // e funciona igual para 1drv.ms, onedrive.live.com e SharePoint.
  // Caminho garantido: o endereço que o próprio OneDrive gera no botão
  // "Incorporar". Como quem monta é a Microsoft, ele sempre abre.
  if (/onedrive\.live\.com\/embed/i.test(limpa) || /sharepoint\.com\/.*action=embedview/i.test(limpa)) {
    return { tipo: 'onedrive', url: limpa, embed: limpa, iframe: true }
  }

  // Caminho por link de compartilhamento comum. Funciona nos links antigos;
  // nos novos (1drv.ms/v/c/...) a Microsoft passou a exigir sessão, e aí o
  // player avisa para usar o "Incorporar".
  if (/(?:1drv\.ms|onedrive\.live\.com|sharepoint\.com)\//i.test(limpa)) {
    return {
      tipo: 'onedrive',
      url: limpa,
      embed: `https://api.onedrive.com/v1.0/shares/${codificarLinkOneDrive(limpa)}/root/content`,
    }
  }

  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(limpa)) {
    return { tipo: 'arquivo', url: limpa, embed: limpa }
  }

  return { tipo: 'desconhecido', url: limpa }
}

/**
 * Converte um link de compartilhamento do OneDrive no identificador que a
 * API da Microsoft entende: base64 do link, no formato "seguro para URL"
 * (barra vira _, mais vira -, sem o = do final), com "u!" na frente.
 *
 * Escrito sem Buffer nem btoa direto para funcionar igual no servidor e no
 * navegador, que é onde este arquivo é usado.
 */
function codificarLinkOneDrive(url: string): string {
  const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes = new TextEncoder().encode(url)
  let base64 = ''

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]

    base64 += ALFABETO[b0 >> 2]
    base64 += ALFABETO[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]
    base64 += b1 === undefined ? '=' : ALFABETO[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]
    base64 += b2 === undefined ? '=' : ALFABETO[b2 & 63]
  }

  return 'u!' + base64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-')
}

/** Nome amigável da origem do vídeo, para mostrar na tela. */
export const ORIGEM_VIDEO: Record<TipoVideo, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  drive: 'Google Drive',
  onedrive: 'OneDrive',
  arquivo: 'Arquivo de vídeo',
  desconhecido: 'Link não reconhecido',
}

/**
 * O progresso do aluno só é medido de verdade no YouTube e em arquivo
 * direto — são os dois casos em que conseguimos ler o tempo do vídeo.
 * Vimeo e Drive tocam normalmente, mas a conclusão é marcada pelo aluno.
 */
export function marcaProgressoSozinho(info: VideoInfo): boolean {
  // Só dá para medir o avanço quando o vídeo toca no player da própria
  // plataforma. Em iframe (Drive, Vimeo, OneDrive incorporado) quem controla
  // é a origem, e ela não conta nada para fora.
  if (info.iframe) return false
  return info.tipo === 'youtube' || info.tipo === 'arquivo' || info.tipo === 'onedrive'
}

/** Miniatura do vídeo, quando a plataforma oferece uma. */
export function miniaturaDoVideo(url: string | null | undefined): string | null {
  const info = analisarVideo(url)
  if (info.tipo === 'youtube' && info.id) {
    return `https://img.youtube.com/vi/${info.id}/hqdefault.jpg`
  }
  return null
}

/** Percentual a partir do qual consideramos a aula assistida por completo. */
export const PERCENTUAL_CONCLUSAO = 95

/**
 * Quanto do vídeo precisa ter passado pela tela, de verdade, para valer
 * presença — nos casos em que a plataforma consegue medir o tempo.
 *
 * É um pouco mais folgado que o percentual acima, de propósito. A contagem
 * é feita segundo a segundo pelo navegador, e um engasgo de rede ou uma
 * troca de aba podem deixar dois ou três segundos sem marcar. Exigir 95%
 * cravados puniria quem assistiu a aula inteira por uma falha que não é
 * dela. Noventa por cento é impossível de alcançar pulando, e tranquilo de
 * alcançar assistindo.
 */
export const COBERTURA_MINIMA = 90

/** URL pública de um vídeo enviado direto para a plataforma. */
export function urlDoVideo(videoPath: string | null | undefined): string | null {
  if (!videoPath) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/aulas/${videoPath}`
}
