/* ============================================================
   O QUE O ALUNO PODE ANEXAR

   POR QUE ISTO NÃO MORA NA ACTION
   Um arquivo marcado com 'use server' só pode exportar função. Se as
   regras morassem lá, a tela teria que repetir os mesmos números — e
   duas listas de formatos aceitos em lugares diferentes é uma promessa
   de divergirem: a tela aceita PNG, o servidor recusa, e o aluno leva a
   culpa por "estar fazendo errado".

   Aqui é o único lugar onde estes números existem. A tela lê, a action
   lê, e o banco tem a mesma lista escrita na restrição da tabela
   `entrega_arquivos` — que é a palavra final, porque tela e action podem
   ser contornadas e a restrição não.
   ============================================================ */

/** 20 MB por arquivo. Uma foto de celular de página escrita dá 2 a 5 MB. */
export const TAMANHO_MAXIMO_ENTREGA = 20 * 1024 * 1024

/**
 * Quantos anexos cabem numa entrega.
 *
 * Doze porque atividade feita à punho vira uma foto por página, e doze
 * páginas é mais do que qualquer trabalho da escola pede. O teto existe
 * para o envio não virar um upload infinito na internet do celular.
 */
export const MAXIMO_DE_ANEXOS = 12

/** O que se aceita, como foi pedido: PDF e JPEG. */
export const TIPOS_ACEITOS: readonly string[] = ['application/pdf', 'image/jpeg']

/**
 * A extensão é decidida pelo TIPO, não pelo nome do arquivo.
 *
 * O nome vem do aparelho da pessoa e pode ser qualquer coisa —
 * "trabalho.pdf.exe", "foto" sem extensão nenhuma, ou um nome com barra
 * dentro. Derivar o caminho de gravação do nome é convidar problema.
 */
export const EXTENSAO_POR_TIPO: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
}

/** O que o campo de arquivo do navegador oferece na janela de escolha. */
export const ACEITE_DO_CAMPO = 'application/pdf,image/jpeg,.pdf,.jpg,.jpeg'

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
