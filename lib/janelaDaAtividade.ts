/* ============================================================
   A JANELA DA ATIVIDADE, DO LADO DE CÁ

   Três lugares precisam responder à mesma pergunta — "esta atividade
   está aberta agora?": a tela do aluno, a tela do professor e o servidor.
   Se cada um responder do seu jeito, mais cedo ou mais tarde a tela diz
   uma coisa e o servidor faz outra, e a culpa cai na plataforma.

   Então a resposta mora aqui, num arquivo só, sem React e sem Supabase,
   para poder ser usada dos dois lados e testada sozinha.

   SOBRE FUSO HORÁRIO — o detalhe que estraga tudo em silêncio
   Os instantes vêm do banco em UTC. Se forem formatados com o relógio do
   servidor (que na nuvem é UTC), uma atividade que vence domingo às 23:59
   aparece para o aluno como "domingo às 20:59" e ele acha que perdeu o
   prazo. Toda formatação aqui é forçada em America/Sao_Paulo. E toda
   COMPARAÇÃO é feita em milissegundos absolutos, onde fuso não existe.
   ============================================================ */

export type EstadoDaJanela = 'ainda_nao_abriu' | 'aberta' | 'encerrada'

export interface Janela {
  estado: EstadoDaJanela
  /** Frase pronta para a tela, do jeito que a pessoa entende. */
  recado: string
  /** Pode anexar agora? É esta a resposta que o botão obedece. */
  podeEntregar: boolean
  /** Faltam menos de 24 horas para vencer — vale destacar. */
  correndo: boolean
}

const FUSO = 'America/Sao_Paulo'

/** "17/09/2026 às 23:59", sempre no horário de Brasília. */
export function momentoPorExtenso(iso: string): string {
  const d = new Date(iso)
  const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: FUSO }).format(d)
  const hora = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO,
  }).format(d)
  return `${data} às ${hora}`
}

/** "em 3 dias", "em 5 horas", "em 20 minutos" — para dar noção de urgência. */
export function quantoFalta(iso: string, agora = Date.now()): string {
  const ms = new Date(iso).getTime() - agora
  if (ms <= 0) return 'agora'
  const minutos = Math.round(ms / 60000)
  if (minutos < 60) return `em ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.round(minutos / 60)
  if (horas < 48) return `em ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.round(horas / 24)
  return `em ${dias} dias`
}

export function lerJanela(
  abreEm: string | null | undefined,
  venceEm: string | null | undefined,
  agora: number = Date.now()
): Janela {
  const abre = abreEm ? new Date(abreEm).getTime() : null
  const vence = venceEm ? new Date(venceEm).getTime() : null

  if (abre !== null && agora < abre) {
    return {
      estado: 'ainda_nao_abriu',
      recado: `Abre em ${momentoPorExtenso(abreEm!)}`,
      podeEntregar: false,
      correndo: false,
    }
  }

  if (vence !== null && agora > vence) {
    return {
      estado: 'encerrada',
      recado: `Prazo encerrado em ${momentoPorExtenso(venceEm!)}`,
      podeEntregar: false,
      correndo: false,
    }
  }

  if (vence !== null) {
    return {
      estado: 'aberta',
      recado: `Entregar até ${momentoPorExtenso(venceEm!)} · ${quantoFalta(venceEm!, agora)}`,
      podeEntregar: true,
      correndo: vence - agora < 24 * 60 * 60 * 1000,
    }
  }

  return { estado: 'aberta', recado: 'Sem prazo definido', podeEntregar: true, correndo: false }
}

/* ------------------------------------------------------------------
   CONVERSA COM O CAMPO `datetime-local` DO NAVEGADOR

   O campo devolve texto solto, tipo "2026-09-17T23:59", SEM fuso — ele
   quer dizer "no relógio de quem está preenchendo". O banco guarda
   instante absoluto. A conversão entre os dois é onde nasce o bug
   clássico de "marquei 23:59 e o sistema fechou às 20:59".

   `new Date('2026-09-17T23:59')` já interpreta no fuso do navegador, que
   é o do professor. É exatamente o que se quer: ele marcou a hora dele.
   ------------------------------------------------------------------ */

/** Do campo da tela para o formato que o banco guarda. */
export function doCampoParaISO(valor: string): string | null {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Do banco de volta para o campo, para o professor poder editar. */
export function doISOParaCampo(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const doisDigitos = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}` +
    `T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`
  )
}

/**
 * O fim do dia escolhido, para o botão de atalho.
 *
 * Quem digita "vence dia 17" quer dizer "até o fim do 17". Deixar o campo
 * cair em 00:00 fecharia a atividade um dia inteiro antes do que o
 * professor pretendia — e ele só descobriria pela reclamação dos alunos.
 */
export function fimDoDia(valorDoCampoDeData: string): string {
  return `${valorDoCampoDeData}T23:59`
}
