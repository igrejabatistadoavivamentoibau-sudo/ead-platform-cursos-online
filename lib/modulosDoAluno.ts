/* ============================================================
   O CURSO EM MÓDULOS, DO PONTO DE VISTA DO ALUNO

   O PROBLEMA QUE ISTO RESOLVE
   Desde que o curso passou a ter módulos, a tela do aluno continuou
   pedindo "todas as aulas deste CURSO" e mostrando numa lista só. Três
   coisas quebraram de uma vez, e nenhuma delas dava erro na tela:

   1. Ele via — e podia assistir — as aulas do Módulo 2 e do 3 sem ter
      passado pelo 1. A regra de pré-requisito existia no banco, para
      matrícula, mas o vídeo estava lá, a um clique.
   2. A numeração passou a ser POR MÓDULO. Ordenar por número dentro do
      curso inteiro embaralhava tudo: Aula 1 do Módulo 1, Aula 1 do
      Módulo 2, Aula 2 do Módulo 1... nessa ordem.
   3. "40% do curso" contava aulas de módulos em que ele nem está
      matriculado. Quem está no Módulo 1 de três nunca passaria de 33%,
      por mais que fizesse tudo certo.

   POR QUE ISTO É UM ARQUIVO SEPARADO
   Porque é regra, não desenho. Quem pode ver o quê precisa dar para ler
   de uma vez e para conferir caso a caso — inclusive os casos que ninguém
   imagina: o aluno transferido que entrou direto no Módulo 2, o que
   repete o módulo, o que já foi aprovado e quer rever a aula.

   A REGRA, EM UMA LINHA
   O aluno abre o módulo em que ESTÁ MATRICULADO — em qualquer situação,
   inclusive reprovado, porque ele vai repetir e precisa do material — e
   os que já cursou. O resto fica fechado, dizendo por quê.
   ============================================================ */

/** Situação do aluno numa turma. Espelha `turma_alunos.situacao`. */
export type SituacaoNaTurma = 'cursando' | 'aprovado' | 'reprovado' | 'desistente'

export interface ModuloBruto {
  id: string
  nome: string
  descricao?: string | null
  ordem: number
}

/** Uma matrícula do aluno, já reduzida ao que importa aqui. */
export interface MatriculaNoModulo {
  moduloId: string
  situacao: SituacaoNaTurma
}

export type EstadoDoModulo =
  /** Está matriculado agora. É aqui que ele deve estar. */
  | 'cursando'
  /** Já foi aprovado. Continua aberto para rever. */
  | 'aprovado'
  /** Reprovou ou desistiu. Aberto, porque ele vai repetir. */
  | 'repetindo'
  /** Fechado. O motivo diz o que fazer a seguir. */
  | 'trancado'

export interface ModuloDoAluno extends ModuloBruto {
  estado: EstadoDoModulo
  aberto: boolean
  /** Onde ele está agora — o que a tela abre e o que o avanço mede. */
  atual: boolean
  /** Só quando trancado: uma frase que diz o que acontece a seguir. */
  motivo?: string
}

/* Aprovado vale mais que cursando, que vale mais que reprovado. Importa
   quando o aluno repetiu o módulo: a matrícula velha não pode apagar a
   nova, nem o contrário. */
const PESO: Record<SituacaoNaTurma, number> = {
  aprovado: 3,
  cursando: 2,
  reprovado: 1,
  desistente: 0,
}

const ESTADO_POR_SITUACAO: Record<SituacaoNaTurma, EstadoDoModulo> = {
  cursando: 'cursando',
  aprovado: 'aprovado',
  reprovado: 'repetindo',
  desistente: 'repetindo',
}

/**
 * Monta a lista de módulos do curso já resolvida para ESTE aluno.
 *
 * Devolve todos os módulos, em ordem — inclusive os fechados. Mostrar o
 * caminho inteiro é de propósito: quem termina o Módulo 1 precisa ver que
 * existe um 2, senão a conclusão parece o fim do curso.
 */
export function modulosDoAluno(
  modulos: ModuloBruto[],
  matriculas: MatriculaNoModulo[]
): ModuloDoAluno[] {
  const emOrdem = [...modulos].sort((a, b) => a.ordem - b.ordem)

  /* A melhor situação do aluno em cada módulo. */
  const melhor = new Map<string, SituacaoNaTurma>()
  for (const m of matriculas) {
    const atual = melhor.get(m.moduloId)
    if (!atual || PESO[m.situacao] > PESO[atual]) melhor.set(m.moduloId, m.situacao)
  }

  /* Onde ele está. Preferimos o que ele CURSA agora; se não cursa nenhum,
     o mais adiantado por onde passou — é dali que ele retoma. */
  const matriculado = emOrdem.filter((m) => melhor.has(m.id))
  const cursando = matriculado.filter((m) => melhor.get(m.id) === 'cursando')
  const moduloAtual =
    cursando.length > 0
      ? cursando[cursando.length - 1]
      : matriculado.length > 0
        ? matriculado[matriculado.length - 1]
        : null

  return emOrdem.map((m, i) => {
    const situacao = melhor.get(m.id)

    if (situacao) {
      return {
        ...m,
        estado: ESTADO_POR_SITUACAO[situacao],
        aberto: true,
        atual: m.id === moduloAtual?.id,
      }
    }

    return {
      ...m,
      estado: 'trancado' as const,
      aberto: false,
      atual: false,
      motivo: motivoDaTranca(emOrdem, i, melhor, moduloAtual),
    }
  })
}

/**
 * Por que este módulo está fechado — e, principalmente, o que acontece
 * depois. Um cadeado sem explicação vira ligação para a secretaria.
 */
function motivoDaTranca(
  emOrdem: ModuloBruto[],
  i: number,
  melhor: Map<string, SituacaoNaTurma>,
  moduloAtual: ModuloBruto | null
): string {
  const anterior = i > 0 ? emOrdem[i - 1] : null

  /* Módulo que ficou para trás e ele nunca cursou. Acontece com quem foi
     transferido de outra escola e entrou direto num módulo adiantado.
     Prometer que "libera depois" seria mentira: não libera, já passou. */
  if (moduloAtual && emOrdem[i].ordem < moduloAtual.ordem) {
    return 'Você não cursou este módulo.'
  }

  if (!anterior) {
    return 'Você ainda não está matriculado neste módulo. A secretaria coloca você numa turma.'
  }

  /* Passou no anterior e ainda não foi posto numa turma daqui. Aprovar
     NÃO matricula ninguém automaticamente — quem decide a turma é a
     coordenação —, então a frase precisa dizer que a bola está com ela,
     e não com o aluno. */
  if (melhor.get(anterior.id) === 'aprovado') {
    return `Você concluiu "${anterior.nome}". A secretaria vai colocar você numa turma deste módulo.`
  }

  return `Libera quando você for aprovado em "${anterior.nome}".`
}

/**
 * Qual aula abrir quando o aluno entra no curso.
 *
 * A primeira que ele ainda não concluiu, dentro do módulo em que está.
 * Se já concluiu todas, a primeira do módulo — porque aí ele está
 * revendo, e começar do começo é o que faz sentido.
 *
 * `pedida` é o `?aula=` da barra de endereço, e por isso é CONFERIDA e não
 * obedecida: sem essa conferência, colar o endereço de uma aula do Módulo
 * 3 abriria o vídeo para quem nem entrou no Módulo 1 — e o cadeado da tela
 * viraria enfeite.
 */
export function aulaParaAbrir<T extends { id: string; moduloId: string | null }>(
  aulas: T[],
  modulos: ModuloDoAluno[],
  concluida: (aulaId: string) => boolean,
  pedida?: string | null
): T | null {
  const abertos = new Set(modulos.filter((m) => m.aberto).map((m) => m.id))
  const disponiveis = aulas.filter((a) => a.moduloId !== null && abertos.has(a.moduloId))
  if (disponiveis.length === 0) return null

  if (pedida) {
    const escolhida = disponiveis.find((a) => a.id === pedida)
    if (escolhida) return escolhida
  }

  const atual = modulos.find((m) => m.atual)
  const doAtual = atual ? disponiveis.filter((a) => a.moduloId === atual.id) : []
  const lista = doAtual.length > 0 ? doAtual : disponiveis

  return lista.find((a) => !concluida(a.id)) ?? lista[0]
}
