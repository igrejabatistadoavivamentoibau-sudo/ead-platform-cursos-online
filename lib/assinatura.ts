/* ============================================================
   A ASSINATURA ELETRÔNICA

   O QUE ELA É, E O QUE ELA NÃO É
   Ela não substitui firma reconhecida, e não vou fingir que substitui. O
   que ela resolve é o problema real da escola: hoje o aluno recebe uma
   nota e não sabe **quem** corrigiu, **quando** corrigiu, nem tem como
   mostrar isso para alguém. A nota aparece sozinha na tela, sem dono.

   A assinatura amarra três coisas num bloco só: o nome de quem corrigiu,
   o instante da correção, e a nota atribuída — mais um código de
   conferência que nasce desses mesmos três dados. Se qualquer um dos três
   for alterado, o código deixa de bater. É o que dá para fazer sem
   certificado digital, e é honesto sobre o que é.

   POR QUE O NOME FICA CONGELADO
   `users.assinatura_nome` guarda o nome do momento em que a conta nasceu,
   e não é lido de `users.name`. Nome muda — casamento, correção de
   cadastro. Um trabalho assinado em março tem que continuar mostrando o
   nome de março; documento assinado não se reescreve depois.
   ============================================================ */

export type EstiloDeAssinatura = 'classica' | 'corrente'

/**
 * O código de conferência.
 *
 * É uma soma dos dados que a assinatura cobre, escrita em base 36 e
 * cortada em oito caracteres — curto o bastante para caber embaixo da
 * assinatura e ser lido em voz alta. Não é criptografia: é um lacre. Não
 * impede ninguém de forjar, mas denuncia alteração acidental, que é o que
 * de fato acontece (a nota trocada, a data reescrita numa migração).
 */
export function codigoDeConferencia(dados: {
  entregaId: string
  assinanteId: string
  em: string
  nota: number | null
}): string {
  const texto = `${dados.entregaId}|${dados.assinanteId}|${dados.em}|${dados.nota ?? ''}`
  // FNV-1a de 32 bits: pequeno, determinístico, sem dependência nenhuma.
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  // Uma segunda passada com semente diferente dobra o espaço e reduz a
  // chance de dois trabalhos diferentes exibirem o mesmo código na mesma
  // turma — que seria constrangedor mesmo sem ser um risco de segurança.
  let g = 0x9e3779b9
  for (let i = texto.length - 1; i >= 0; i--) {
    g ^= texto.charCodeAt(i)
    g = Math.imul(g, 0x85ebca6b) >>> 0
  }
  return (h.toString(36) + g.toString(36)).toUpperCase().slice(0, 8).padStart(8, '0')
}

/** A família de fonte de cada estilo, para a tela e para o papel. */
export const FONTE_DA_ASSINATURA: Record<EstiloDeAssinatura, string> = {
  classica: "'Great Vibes', 'Segoe Script', cursive",
  corrente: "'Dancing Script', 'Segoe Script', cursive",
}

/**
 * O estilo de cada pessoa, decidido pelo nome.
 *
 * Duas caligrafias diferentes, escolhidas pelo próprio nome — assim duas
 * assinaturas lado a lado no mesmo boletim não saem idênticas, e ninguém
 * precisa escolher nada ao criar a conta. A conta é determinística: o
 * mesmo nome dá sempre a mesma letra, hoje e daqui a dois anos.
 */
export function estiloDoNome(nome: string): EstiloDeAssinatura {
  let soma = 0
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i)
  return soma % 2 === 0 ? 'classica' : 'corrente'
}

/** "14/03/2026 às 20:41", sempre no horário de Brasília. */
export function momentoDaAssinatura(iso: string): string {
  const d = new Date(iso)
  const data = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(d)
  const hora = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d)
  return `${data} às ${hora}`
}

/**
 * O tamanho da caligrafia, decidido pelo comprimento do nome.
 *
 * "ELIDIANE GUEDES DOS SANTOS LIMA" tem quase o dobro das letras de
 * "Ana Souza". Num tamanho fixo, o nome comprido quebra em duas linhas e
 * a assinatura deixa de parecer uma assinatura — vira um parágrafo em
 * letra bonita. Encolher pelo comprimento resolve sem ninguém decidir
 * nada, e a conta é a mesma na tela e no papel.
 */
export function tamanhoDaAssinatura(nome: string): { px: number; pt: number } {
  const n = nome.trim().length
  if (n <= 16) return { px: 34, pt: 30 }
  if (n <= 24) return { px: 30, pt: 26 }
  if (n <= 32) return { px: 26, pt: 22 }
  if (n <= 42) return { px: 22, pt: 19 }
  return { px: 19, pt: 16 }
}
