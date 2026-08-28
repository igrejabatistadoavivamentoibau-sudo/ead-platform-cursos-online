/* ============================================================
   A LUMI DANDO O RECADO — A REGRA, E SÓ A REGRA

   A plataforma já guarda os avisos numa tabela só (`notificacoes`, desde
   a migração 015) e já tem cinco gatilhos escrevendo nela (028). Nada
   disso muda aqui.

   O QUE ESTE ARQUIVO FAZ É TRADUZIR.

   O que está guardado é seco, porque é registro: "Nova aula disponível",
   'Aula 1 — "O chamado do líder" (Módulo Um).' Serve para a central de
   notificações, que é uma lista para consultar.

   A LUMI não é uma lista. Quando ela aparece no canto da tela, ela está
   FALANDO com a pessoa — e por isso o mesmo fato vira "Uma nova aula foi
   liberada para você." A informação é idêntica; muda quem está contando.

   É por isso que isto é uma camada de voz, e não um segundo sistema: o
   dado continua sendo um só, e se amanhã a LUMI sumir, os avisos
   continuam todos lá.

   E É SÓ RECADO. Não há campo de escrever, não há conversa, não há
   pergunta — a LUMI avisa e sai da frente. Um botão, um caminho.
   ============================================================ */

/** Um aviso como ele está guardado no banco. */
export interface AvisoGuardado {
  id: string
  titulo: string
  corpo: string | null
  tipo: string
  link: string | null
  created_at: string
}

/** O mesmo aviso, na voz da LUMI. */
export interface RecadoDaLumi {
  id: string
  /** Rótulo curto — o assunto, para a pessoa reconhecer de relance. */
  titulo: string
  /** A frase da LUMI, falando com a pessoa. */
  mensagem: string
  /** O que exatamente aconteceu: qual aula, qual atividade, qual nota. */
  detalhe: string | null
  /** O que o botão diz. Verbo, nunca "OK". */
  acao: string
  /** Para onde o botão leva, dentro da plataforma. */
  link: string | null
  tipo: string
}

/* ------------------------------------------------------------------
   QUAIS AVISOS A LUMI ANUNCIA — e, principalmente, quais NÃO

   Ela não repete o que já disse de outro jeito:

   * `novidade` já aparece na SAUDAÇÃO DO DIA, que é a novidade contada
     com calma, uma vez por dia.
   * `atualizacao` já tem a pastilha de "nova versão disponível".

   Anunciar esses dois aqui seria a LUMI falando duas vezes a mesma
   coisa — que é o caminho mais curto para a pessoa parar de ler o que
   ela diz.

   `geral` e `inscricao` ficam de fora por outro motivo: são recados
   escritos à mão ou de secretaria, sem uma frase própria da LUMI. Eles
   continuam no sino, que é onde recado de registro vive.
   ------------------------------------------------------------------ */
const ANUNCIADOS = new Set(['aula', 'atividade', 'prazo', 'nota', 'pedido', 'aviso_turma'])

export function aLumiAnuncia(tipo: string): boolean {
  return ANUNCIADOS.has(tipo)
}

/** Quantos recados a LUMI mostra de uma vez. Um. */
export const RECADOS_DE_CADA_VEZ = 1

/** Quanto do detalhe cabe no canto da tela sem virar parágrafo. */
const LIMITE_DO_DETALHE = 96

function encurtar(texto: string | null, limite = LIMITE_DO_DETALHE): string | null {
  if (!texto) return null
  const limpo = texto.trim()
  if (limpo.length <= limite) return limpo
  /* Corta na última palavra inteira: cortar no meio de uma palavra é o
     detalhe que faz um recado parecer defeito. */
  const pedaco = limpo.slice(0, limite)
  const ultimoEspaco = pedaco.lastIndexOf(' ')
  return (ultimoEspaco > limite * 0.6 ? pedaco.slice(0, ultimoEspaco) : pedaco) + '…'
}

/**
 * Traduz um aviso guardado para a voz da LUMI.
 *
 * @param papel  quem está lendo. O MESMO aviso de pedido pago vai para o
 *               aluno e para a coordenação, e a frase não pode ser a
 *               mesma: "seu pagamento foi confirmado" na tela de quem só
 *               precisa separar o produto é informação errada.
 *
 * Devolve `null` quando este aviso não é da LUMI (ver `ANUNCIADOS`).
 */
export function recadoDaLumi(aviso: AvisoGuardado, papel: string): RecadoDaLumi | null {
  if (!aLumiAnuncia(aviso.tipo)) return null

  const base = { id: aviso.id, detalhe: encurtar(aviso.corpo), link: aviso.link, tipo: aviso.tipo }

  switch (aviso.tipo) {
    case 'aula':
      return {
        ...base,
        titulo: 'Nova aula',
        mensagem: 'Uma nova aula foi liberada para você.',
        acao: 'Assistir',
      }

    case 'atividade':
      return {
        ...base,
        titulo: 'Nova atividade',
        mensagem: 'Você possui uma nova atividade.',
        acao: 'Ver atividade',
      }

    case 'nota':
      return {
        ...base,
        titulo: 'Sua nota',
        mensagem: 'Sua nota foi lançada.',
        acao: 'Ver nota',
      }

    case 'prazo':
      return {
        ...base,
        titulo: 'Prazo chegando',
        mensagem: 'Você tem uma atividade próxima do prazo.',
        /* "Ver" seria mais suave e mais fraco. Quem lê isto tem uma coisa
           para fazer, e o botão diz qual é. */
        acao: 'Entregar agora',
      }

    case 'pedido':
      return papel === 'aluno'
        ? {
            ...base,
            titulo: 'Pedido pago',
            mensagem: 'O pagamento do seu pedido foi confirmado.',
            acao: 'Ver pedido',
          }
        : {
            ...base,
            titulo: 'Pedido pago',
            mensagem: 'Um pedido foi pago e está esperando separação.',
            acao: 'Ver pedidos',
          }

    case 'aviso_turma':
      return {
        ...base,
        titulo: 'Recado da turma',
        mensagem: 'Seu professor deixou um aviso na turma.',
        acao: 'Ler recado',
      }

    default:
      return null
  }
}

/**
 * Escolhe o que a LUMI diz agora, entre os avisos ainda não lidos.
 *
 * @param avisos    já em ordem, do mais novo para o mais velho
 * @param jaMostrados  ids que esta pessoa já viu a LUMI mostrar neste
 *                     navegador. Fechar o recado no X **não** marca como
 *                     lido — o aviso continua no sino —, então sem esta
 *                     lista ele voltaria a aparecer em cada troca de tela.
 *
 * Devolve o recado da vez e QUANTOS SOBRARAM. Mostrar um de cada vez é a
 * diferença entre uma assistente e uma fila de pop-ups; dizer que há
 * outros é o que impede a pessoa de achar que aquilo era tudo.
 */
export function proximoRecado(
  avisos: AvisoGuardado[],
  papel: string,
  jaMostrados: string[] = []
): { recado: RecadoDaLumi | null; restantes: number } {
  const vistos = new Set(jaMostrados)
  const candidatos = avisos
    .filter((a) => aLumiAnuncia(a.tipo))
    .filter((a) => !vistos.has(a.id))

  const primeiro = candidatos[0]
  if (!primeiro) return { recado: null, restantes: 0 }

  return {
    recado: recadoDaLumi(primeiro, papel),
    restantes: candidatos.length - 1,
  }
}
