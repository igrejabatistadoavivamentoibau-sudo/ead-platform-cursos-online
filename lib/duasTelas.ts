/* ============================================================
   DUAS TELAS CONVERSANDO

   O PEDIDO
   "Caso o aluno tenha duas telas, que ele possa abrir em uma o vídeo e na
   outra o caderno."

   O PROBLEMA REAL
   Abrir o caderno noutra janela é a parte fácil (uma linha de código). O
   difícil é que, separadas, as duas janelas viram estranhas: o botão
   "marcar o minuto" no caderno não faz ideia de onde a aula está, e clicar
   num minuto anotado não leva o vídeo a lugar nenhum. Duas telas sem
   conversa são pior do que uma só.

   A SOLUÇÃO
   O navegador tem um canal de recados entre janelas do mesmo site
   (BroadcastChannel). O player publica onde a agulha está, de segundo em
   segundo; o caderno escuta. Quando o aluno clica num minuto anotado, o
   caderno pede — e o player, na outra tela, pula para lá.

   Nada disso passa pela internet: é conversa entre abas do mesmo
   navegador, na mesma máquina. Funciona até sem sinal.
   ============================================================ */

export type RecadoDaAula =
  /** O player avisando onde a aula está. */
  | { tipo: 'tempo'; segundos: number }
  /** O caderno pedindo para o player pular para um ponto. */
  | { tipo: 'ir'; segundos: number }
  /** O player respondendo que aquele ponto ainda não foi liberado. */
  | { tipo: 'travado'; ate: number }

function nomeDoCanal(aulaId: string) {
  return `ibau-aula-${aulaId}`
}

export interface CanalDaAula {
  publicar: (recado: RecadoDaAula) => void
  fechar: () => void
}

/**
 * Abre o canal daquela aula.
 *
 * `aoReceber` é chamado para cada recado que vier da OUTRA janela — o
 * BroadcastChannel não devolve para quem enviou, o que é exatamente o que
 * queremos: o player não deve reagir ao próprio aviso de tempo.
 *
 * Devolve um canal mudo se o navegador não tiver o recurso (versões bem
 * antigas). Nesse caso o caderno continua funcionando sozinho; só o pulo
 * entre janelas deixa de existir, sem quebrar nada.
 */
export function abrirCanalDaAula(
  aulaId: string,
  aoReceber?: (recado: RecadoDaAula) => void
): CanalDaAula {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return { publicar: () => {}, fechar: () => {} }
  }

  const canal = new BroadcastChannel(nomeDoCanal(aulaId))
  if (aoReceber) {
    canal.onmessage = (e) => aoReceber(e.data as RecadoDaAula)
  }

  return {
    publicar: (recado) => {
      try {
        canal.postMessage(recado)
      } catch {
        // Janela fechando no meio do envio: não é problema de ninguém.
      }
    },
    fechar: () => canal.close(),
  }
}

/** "1:05:20" para vídeo longo, "8:42" para o resto. */
export function minutoLegivel(segundos: number) {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(seg).padStart(2, '0')}`
}
