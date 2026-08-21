/* ============================================================
   A TRILHA — por onde a pessoa passou

   O PROBLEMA
   O botão "voltar" de cada tela apontava para um endereço FIXO. Da turma
   → Notas, "voltar" levava para "Minhas turmas" — a lista, lá no começo.
   Quem estava três telas adentro tinha que refazer o caminho inteiro a
   pé. O botão não voltava: ele recomeçava.

   POR QUE NÃO BASTA `router.back()`
   Voltar no histórico é o certo... quando existe um "antes" DENTRO da
   plataforma. Se a pessoa chegou por um link do WhatsApp, ou apertou F5,
   ou abriu a página numa aba nova, o histórico da aba está vazio — e
   `back()` joga ela para fora do site, ou para o Google. O navegador não
   deixa ninguém inspecionar o histórico para saber qual dos dois casos é.

   Então guardamos a nossa própria trilha, por aba (sessionStorage). Ela
   responde exatamente a pergunta que o botão precisa fazer: "existe uma
   tela ANTERIOR, aqui dentro, para onde voltar?".

   E ela precisa ENCOLHER quando a pessoa volta — senão, depois de dois
   "voltar", a trilha estaria dizendo que a tela anterior é justamente a
   que acabamos de deixar, e o botão ficaria indo e voltando entre duas
   telas para sempre.
   ============================================================ */

const CHAVE = 'ibau:trilha'
/** Doze passos. Mais que isso ninguém desfaz a pé, e ocupa espaço à toa. */
const MAXIMO = 12

export interface PassoDaTrilha {
  /** O caminho, sem domínio. */
  p: string
  /** O título que a tela mostrou. É o que o botão "voltar" vai dizer. */
  t?: string
}

export function lerTrilha(): PassoDaTrilha[] {
  try {
    const cru = sessionStorage.getItem(CHAVE)
    if (!cru) return []
    const lista = JSON.parse(cru)
    return Array.isArray(lista) ? (lista as PassoDaTrilha[]) : []
  } catch {
    return []
  }
}

function gravar(lista: PassoDaTrilha[]) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(lista.slice(-MAXIMO)))
  } catch {
    /* aba anônima ou sem espaço: o botão cai no endereço declarado */
  }
}

/**
 * Registra que a pessoa está agora nesta tela.
 *
 * Três casos, e os três importam:
 *
 *  - mesma tela de novo (F5, ou só o título chegou depois): atualiza o
 *    título e não empilha nada;
 *  - a tela ANTERIOR da trilha: ela voltou — então a trilha encolhe, em
 *    vez de crescer com um passo repetido;
 *  - qualquer outra: empilha.
 */
export function registrarPasso(caminho: string, titulo?: string) {
  const lista = lerTrilha()
  const ultimo = lista[lista.length - 1]
  const penultimo = lista[lista.length - 2]

  if (ultimo?.p === caminho) {
    if (titulo && ultimo.t !== titulo) {
      lista[lista.length - 1] = { p: caminho, t: titulo }
      gravar(lista)
    }
    return
  }

  if (penultimo?.p === caminho) {
    lista.pop()
    gravar(lista)
    return
  }

  lista.push({ p: caminho, t: titulo })
  gravar(lista)
}

/** A tela anterior, se ela existir e for daqui de dentro. */
export function passoAnterior(): PassoDaTrilha | null {
  const lista = lerTrilha()
  const anterior = lista[lista.length - 2]
  if (!anterior?.p) return null
  // Só volta para dentro da plataforma. Um caminho estranho na trilha
  // (versão antiga, aba reaproveitada) não pode virar um salto para fora.
  if (!anterior.p.startsWith('/')) return null
  return anterior
}
