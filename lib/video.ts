export type TipoVideo = 'youtube' | 'vimeo' | 'arquivo' | 'desconhecido'

export interface VideoInfo {
  tipo: TipoVideo
  id?: string
  url: string
}

/**
 * Descobre de onde vem o vídeo a partir do link colado pelo professor.
 * Aceita as formas mais comuns de link do YouTube (normal, curto, embed,
 * live e shorts), do Vimeo, e arquivos de vídeo diretos (.mp4 etc).
 */
export function analisarVideo(url: string | null | undefined): VideoInfo {
  const limpa = (url ?? '').trim()
  if (!limpa) return { tipo: 'desconhecido', url: '' }

  const youtube =
    limpa.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (youtube) return { tipo: 'youtube', id: youtube[1], url: limpa }

  const vimeo = limpa.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return { tipo: 'vimeo', id: vimeo[1], url: limpa }

  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(limpa)) {
    return { tipo: 'arquivo', url: limpa }
  }

  return { tipo: 'desconhecido', url: limpa }
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
