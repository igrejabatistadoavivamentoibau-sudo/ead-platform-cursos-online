export type LayoutBloco = 'texto_imagem' | 'imagem_texto' | 'texto_centralizado' | 'destaque'

export interface BlocoSite {
  id: string
  chave: string | null
  titulo: string
  subtitulo: string | null
  texto: string | null
  imagem_path: string | null
  layout: LayoutBloco
  ordem: number
  publicado: boolean
}

export const LAYOUTS: Record<LayoutBloco, { label: string; descricao: string }> = {
  texto_imagem: { label: 'Texto e foto', descricao: 'Texto à esquerda, foto à direita.' },
  imagem_texto: { label: 'Foto e texto', descricao: 'Foto à esquerda, texto à direita.' },
  texto_centralizado: { label: 'Só texto', descricao: 'Texto centralizado, sem foto.' },
  destaque: { label: 'Destaque', descricao: 'Foto grande ao fundo com o texto por cima.' },
}

/** Endereço público da imagem do bloco. */
export function urlDaImagem(caminho: string | null | undefined): string | null {
  if (!caminho) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site/${caminho}`
}
