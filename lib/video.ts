export type TipoVideo = 'youtube' | 'vimeo' | 'drive' | 'onedrive' | 'arquivo' | 'desconhecido'

export interface VideoInfo {
  tipo: TipoVideo
  id?: string
  url: string
  /** Endereço pronto para tocar dentro da plataforma (iframe/player). */
  embed?: string
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
  const limpa = (url ?? '').trim()
  if (!limpa) return { tipo: 'desconhecido', url: '' }

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
export function marcaProgressoSozinho(tipo: TipoVideo): boolean {
  // OneDrive entra aqui porque o link vira um arquivo de vídeo de verdade,
  // tocado pelo player da própria plataforma — dá para ler o tempo dele.
  return tipo === 'youtube' || tipo === 'arquivo' || tipo === 'onedrive'
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

/** URL pública de um vídeo enviado direto para a plataforma. */
export function urlDoVideo(videoPath: string | null | undefined): string | null {
  if (!videoPath) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/aulas/${videoPath}`
}
