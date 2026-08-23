/* ============================================================
   MATERIAL COMPLEMENTAR DA AULA

   A turma presencial pediu vídeo aula E material de apoio. O vídeo já
   existia; isto é o apoio — a apostila em PDF, o slide, o roteiro de
   estudo, o link de um artigo.

   O MATERIAL FICA NA AULA, E NÃO NA TURMA. Ele é do conteúdo: todas as
   turmas daquele módulo recebem o mesmo, e ninguém precisa reenviar a cada
   turma nova. Se ficasse pendurado na turma, o professor da turma de junho
   teria de subir de novo o que o de março já subiu — e as duas versões
   divergiriam na primeira correção.

   As constantes vivem aqui, e não dentro do arquivo de ações, porque
   arquivo marcado com `use server` não pode exportar constante: tudo o que
   ele exporta precisa ser função. A tela precisa desses limites para
   avisar ANTES de a pessoa esperar o envio inteiro para ouvir não.
   ============================================================ */

export const TAMANHO_MAXIMO_MATERIAL = 25 * 1024 * 1024 // 25 MB

/** O que a escola manda, na prática. Nada de executável. */
export const TIPOS_DE_MATERIAL: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'Imagem',
  'image/png': 'Imagem',
  'image/webp': 'Imagem',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.ms-powerpoint': 'Slides',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Slides',
  'audio/mpeg': 'Áudio',
  'audio/mp4': 'Áudio',
}

export function tipoAceito(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(TIPOS_DE_MATERIAL, mime)
}

export function rotuloDoTipo(mime: string | null | undefined): string {
  return (mime && TIPOS_DE_MATERIAL[mime]) || 'Arquivo'
}

export function tamanhoLegivel(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/**
 * O endereço só é aceito se for http(s).
 *
 * Sem esta conferência, um `javascript:` colado no campo de link viraria
 * um link clicável que roda código no navegador de quem abrir a aula.
 */
export function linkSeguro(url: string): string | null {
  const limpo = (url ?? '').trim()
  if (!limpo) return null
  try {
    const u = new URL(limpo)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export const EXTENSAO_PADRAO: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
}
