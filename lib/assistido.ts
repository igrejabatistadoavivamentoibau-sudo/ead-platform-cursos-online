/**
 * O CADERNO DE PRESENÇA DO VÍDEO
 *
 * O PROBLEMA
 * A conta antiga era `tempoAtual / duração`. Ela responde "onde está a
 * agulha?", não "quanto a pessoa assistiu?". Arrastar a barrinha para o
 * final leva a agulha a 100% num piscar — e a plataforma computava a aula
 * inteira e a presença junto.
 *
 * A IDEIA
 * Em vez de olhar a posição, este caderno anota os SEGUNDOS que passaram
 * de fato pela tela. Cada segundo do vídeo é uma linha do caderno; ela só
 * é marcada quando o vídeo estava rodando naquele ponto. Pular não marca
 * nada, porque nenhum segundo daquele trecho chegou a ser exibido.
 *
 * O avanço, então, é simplesmente: linhas marcadas ÷ duração.
 *
 * O DETALHE QUE FAZ FUNCIONAR
 * A leitura acontece de tempos em tempos (a cada segundo). Entre uma
 * leitura e a seguinte, a agulha pode ter andado 1 segundo (assistindo) ou
 * 400 (pulou). Por isso o caderno só preenche o intervalo entre duas
 * leituras quando ele é pequeno o bastante para ter sido tempo real de
 * vídeo. Salto grande é entendido como pulo e não marca nada — nem sequer
 * o ponto de chegada.
 */
export class CadernoDoVideo {
  /** Segundos do vídeo que realmente passaram pela tela. */
  private vistos = new Set<number>()
  private ultimaPosicao: number | null = null

  /** Maior salto, em segundos de vídeo, ainda aceito como reprodução normal. */
  private readonly TOLERANCIA: number

  constructor(toleranciaSegundos = 3) {
    this.TOLERANCIA = toleranciaSegundos
  }

  /** Avisa que a agulha está em `posicao` e o vídeo está rodando. */
  marcar(posicao: number) {
    const atual = Math.floor(Math.max(0, posicao))
    const anterior = this.ultimaPosicao

    if (anterior === null) {
      this.vistos.add(atual)
    } else {
      const salto = atual - anterior
      if (salto >= 0 && salto <= this.TOLERANCIA) {
        for (let s = anterior; s <= atual; s++) this.vistos.add(s)
      }
      // Salto grande (para frente ou para trás) = a pessoa moveu a barra.
      // Não marca nada: só volta a contar da próxima leitura em diante.
    }

    this.ultimaPosicao = atual
  }

  /** A reprodução parou (pausa, buffer, fim). Reinicia a costura. */
  pausar() {
    this.ultimaPosicao = null
  }

  /** Quantos segundos distintos do vídeo já foram assistidos. */
  get segundos() {
    return this.vistos.size
  }

  /** Avanço real, de 0 a 100. */
  percentual(duracao: number) {
    if (!duracao || duracao <= 0) return 0
    return Math.min(100, (this.vistos.size / Math.floor(duracao)) * 100)
  }

  /**
   * Até onde a pessoa pode adiantar o vídeo.
   *
   * É o fim do primeiro trecho contínuo já assistido. Voltar é livre;
   * pular para frente só até onde ela já chegou. Sem isso, a trava de
   * contagem existiria mas a barra continuaria convidando ao pulo.
   */
  get limiteDeAvanco() {
    let s = 0
    while (this.vistos.has(s)) s++
    return s
  }

  /** Recupera o que já havia sido assistido em sessões anteriores. */
  restaurar(segundosJaVistos: number) {
    for (let s = 0; s < Math.floor(segundosJaVistos); s++) this.vistos.add(s)
  }
}
