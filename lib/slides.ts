/**
 * Monta a URL pública de uma foto do carrossel guardada no Supabase Storage.
 * Centralizado aqui para que servidor e cliente usem exatamente a mesma regra.
 */
export function urlDaFoto(imagePath: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/carrossel/${imagePath}`
}

export interface SlideDB {
  id: string
  titulo: string | null
  image_path: string
  ordem: number
  ativo: boolean
}
