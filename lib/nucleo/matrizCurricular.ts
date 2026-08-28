/* ============================================================
   A MATRIZ CURRICULAR ESCRITA DE UMA VEZ

   O pedido, nas palavras dela: um curso pode ter 3 módulos, com 2
   disciplinas dentro de cada um, e 10 aulas em cada disciplina, cada aula
   com o seu nome. Depois é só entrar no módulo, na disciplina, e anexar o
   vídeo e o material na aula certa.

   POR QUE UM TEXTO, E NÃO UMA TELA DE "ADICIONAR + ADICIONAR + ADICIONAR"

   Três módulos vezes duas disciplinas vezes dez aulas são SESSENTA nomes.
   Numa tela de formulário, são sessenta cliques em "adicionar", sessenta
   campos abrindo, e a estrutura inteira só existindo depois do último. Se
   o navegador fechar no meio, recomeça.

   Escrevendo, é uma lista — a mesma lista que ela já tem no plano de
   ensino, no Word, no caderno. Cola, confere na prévia, cria. E dá para
   preparar antes, offline, por quem organiza o curso.

   O RECUO É QUEM DIZ O QUE É CADA COISA:

       Fundamentos                      <- módulo (sem recuo)
         Bibliologia                    <- disciplina (um recuo)
           A origem das Escrituras      <- aula (dois recuos)
           O cânon do Antigo Testamento
         Teologia Própria
           10 aulas                     <- gera 10 aulas numeradas
       Discipulado
         ...

   NADA AQUI FALA COM BANCO NEM COM TELA. Entra texto, sai a estrutura
   entendida mais os avisos do que foi interpretado. É isso que permite
   conferir, caso a caso, coisas que dariam trabalho para reproduzir
   clicando: recuo com tabulação misturada com espaço, lista colada do
   Word com marcadores, numeração "1.1", aula escrita antes de existir
   disciplina.
   ============================================================ */

export interface DisciplinaPlanejada {
  /**
   * `null` significa "as aulas ficam direto no módulo" — ou seja, na
   * disciplina automática que todo módulo tem. É o caso do curso simples,
   * que não precisa inventar matéria para poder cadastrar aula.
   */
  nome: string | null
  aulas: string[]
}

export interface ModuloPlanejado {
  nome: string
  disciplinas: DisciplinaPlanejada[]
}

export interface MatrizLida {
  modulos: ModuloPlanejado[]
  /** O que foi interpretado de um jeito que vale avisar antes de criar. */
  avisos: string[]
}

/* ------------------------------------------------------------------
   TETOS

   Não são limites técnicos: são a diferença entre uma matriz e um livro
   colado por engano. Sem eles, um Ctrl+V errado cria mil aulas e a única
   saída é apagar de uma em uma.
   ------------------------------------------------------------------ */
export const TETO = {
  modulos: 20,
  disciplinasPorModulo: 20,
  aulasPorDisciplina: 200,
  aulasNoTotal: 600,
  tamanhoDoNome: 160,
} as const

/** O texto que aparece de exemplo na tela, para não começar do vazio. */
export const MATRIZ_DE_EXEMPLO = `Módulo 1 — Fundamentos
  Bibliologia
    A origem das Escrituras
    O cânon do Antigo Testamento
    Inspiração e inerrância
  Teologia Própria
    Os atributos de Deus
    A Trindade
Módulo 2 — Discipulado
  Vida devocional
    10 aulas`

/* ------------------------------------------------------------------
   LIMPEZA DE UMA LINHA

   O texto vem de gente, e gente cola de tudo. As três coisas que
   aparecem sempre:

   * MARCADOR de lista do Word ou do Google Docs: “- ”, “• ”, “* ”.
   * NUMERAÇÃO que a pessoa digitou junto: “1.”, “2)”, “1.3 -”.
   * RÓTULO redundante: “Módulo 1: Fundamentos”, “Aula 3 - O cânon”.

   Tirar isso não é frescura. Se ficasse, o curso teria um módulo chamado
   "1. Módulo 1 — Fundamentos" e uma aula chamada "Aula 3 - O cânon"
   dentro de uma numeração que a plataforma já faz sozinha — dois números
   brigando na mesma linha.
   ------------------------------------------------------------------ */
function limparNome(bruto: string): string {
  /* O marcador de lista sai sempre — ele nunca é parte do nome. */
  const original = bruto.trim().replace(/^[-*•–—·]\s+/, '')
  let t = original

  /* Rótulo redundante. EXIGE um separador depois, e é isso que faz a
     diferença entre "Módulo 1 — Fundamentos" (vira "Fundamentos") e
     "Módulo 1" sozinho, que É o nome do módulo e não pode virar nada. */
  t = t.replace(/^(m[óo]dulo|disciplina|mat[ée]ria|aula|unidade)\s*\d*\s*[:.\-–—]\s*/i, '')

  /* Numeração digitada à mão. Duas formas, e as duas exigem mais do que
     um número solto:
       "1.1 Bibliologia"  → numeração com ponto, seguida de espaço
       "1. X", "2) X", "3 - X" → número seguido de separador
     Um número sem separador NÃO é retirado, de propósito: "1948 e o
     retorno de Israel" é nome de aula, não numeração. */
  t = t.replace(/^\d+(\.\d+)+\s+/, '')
  t = t.replace(/^\d+\s*[.)\-–—:]\s*/, '')

  /* Se a limpeza comeu a linha inteira, o nome era exatamente aquilo. */
  return t.trim() || original
}

/** "10 aulas", "x10", "10x", "10 aulas numeradas" → 10. Senão, null. */
function quantasAulasGerar(texto: string): number | null {
  const t = texto.trim().toLowerCase()
  const m =
    t.match(/^(\d{1,3})\s*(aulas?|x)?$/) ||
    t.match(/^x\s*(\d{1,3})$/) ||
    t.match(/^(\d{1,3})\s*aulas?\b.*$/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Quanto uma linha está recuada. Tabulação vale 4 — é o que o olho vê. */
function recuoDe(linha: string): number {
  const m = linha.match(/^[ \t]*/)
  if (!m) return 0
  let largura = 0
  for (const c of m[0]) largura += c === '\t' ? 4 : 1
  return largura
}

/**
 * Lê a matriz escrita em texto.
 *
 * NUNCA LANÇA ERRO. Devolve o que entendeu e uma lista de avisos — porque
 * quem escreve isto está olhando para a prévia, e uma tela que apaga tudo
 * e diz "formato inválido" faz a pessoa perder o que digitou.
 */
export function lerMatriz(texto: string): MatrizLida {
  const avisos: string[] = []
  const modulos: ModuloPlanejado[] = []

  const linhas = (texto ?? '')
    .split(/\r?\n/)
    .map((l, i) => ({ bruta: l, numero: i + 1 }))
    .filter((l) => l.bruta.trim().length > 0)

  /* Os níveis são descobertos, e não fixados em "2 espaços".
     Cada recuo novo e maior abre um nível; um recuo menor fecha os que
     passaram. É assim que funciona tanto o texto com 2 espaços quanto o
     com 4, quanto o com tabulação — e quanto o que mistura os três,
     que é o que acontece quando se cola de dois lugares diferentes. */
  const pilha: number[] = []
  let rotuloAvisado = false

  const moduloAtual = () => modulos[modulos.length - 1]
  const disciplinaAtual = () => {
    const m = moduloAtual()
    return m ? m.disciplinas[m.disciplinas.length - 1] : undefined
  }

  const garantirModulo = (motivo?: string) => {
    if (!moduloAtual()) {
      modulos.push({ nome: 'Módulo 1', disciplinas: [] })
      if (motivo) avisos.push(motivo)
    }
    return moduloAtual()!
  }

  const garantirDisciplina = (motivo?: string) => {
    const m = garantirModulo()
    if (m.disciplinas.length === 0) {
      /* Sem disciplina escrita, as aulas ficam direto no módulo. É o
         curso simples, e forçar uma matéria inventada aqui seria pior. */
      m.disciplinas.push({ nome: null, aulas: [] })
      if (motivo) avisos.push(motivo)
    }
    return disciplinaAtual()!
  }

  for (const { bruta, numero } of linhas) {
    const recuo = recuoDe(bruta)

    /* O gerador é lido do texto CRU, antes de qualquer limpeza. Foi o
       teste que pegou: "10 aulas" passava pela retirada de numeração e
       chegava aqui como "aulas" — virava uma aula chamada "aulas" em vez
       de dez aulas. */
    const gerar = quantasAulasGerar(bruta.trim().replace(/^[-*•–—·]\s+/, ''))

    const nome = limparNome(bruta)
    if (!nome) continue

    /* AVISAR QUANDO O RÓTULO SAIU.

       A escola dela escreve "AULA 01 - A história que começou com Deus".
       A limpeza tira o "AULA 01 - " de propósito (a plataforma numera
       sozinha, e dois números na mesma linha brigam) — mas o nome que
       nasce fica diferente do que ela digitou.

       Ela vê o resultado na prévia de qualquer jeito. O aviso existe
       para ela entender POR QUE ficou diferente, em vez de achar que a
       plataforma comeu parte do nome. Uma vez só, por mais linhas que
       tenham rótulo. */
    if (nome !== bruta.trim().replace(/^[-*•–—·]\s+/, '') && !rotuloAvisado) {
      rotuloAvisado = true
      avisos.push(
        'Tirei o "Módulo 1 -", "Aula 3 -" e a numeração da frente dos nomes: a plataforma já numera sozinha. Os nomes ficam como aparecem na prévia.'
      )
    }

    while (pilha.length > 0 && recuo < pilha[pilha.length - 1]) pilha.pop()
    if (pilha.length === 0 || recuo > pilha[pilha.length - 1]) pilha.push(recuo)

    let nivel = pilha.length - 1
    if (nivel > 2) {
      avisos.push(
        `Linha ${numero} ("${nome}") estava recuada demais e entrou como aula.`
      )
      nivel = 2
    }

    if (nivel === 0) {
      if (modulos.length >= TETO.modulos) {
        avisos.push(`Parei no módulo ${TETO.modulos}: é o máximo por curso.`)
        break
      }
      modulos.push({ nome: nome.slice(0, TETO.tamanhoDoNome), disciplinas: [] })
      continue
    }

    if (nivel === 1) {
      const m = garantirModulo(
        `A linha ${numero} ("${nome}") veio antes de qualquer módulo — criei o "Módulo 1" para ela.`
      )
      if (m.disciplinas.length >= TETO.disciplinasPorModulo) {
        avisos.push(`"${m.nome}" já tem ${TETO.disciplinasPorModulo} disciplinas; parei nele.`)
        continue
      }
      m.disciplinas.push({ nome: nome.slice(0, TETO.tamanhoDoNome), aulas: [] })
      continue
    }

    // nível 2: aula
    const d = garantirDisciplina()

    if (gerar !== null) {
      const cabem = Math.min(gerar, TETO.aulasPorDisciplina - d.aulas.length)
      if (cabem < gerar) {
        avisos.push(
          `Pedi ${gerar} aulas em "${d.nome ?? moduloAtual()!.nome}" mas só cabem ${cabem}.`
        )
      }
      for (let i = 1; i <= cabem; i++) d.aulas.push(`Aula ${d.aulas.length + 1}`)
      if (cabem > 0) {
        avisos.push(
          `Gerei ${cabem} aulas numeradas em "${d.nome ?? moduloAtual()!.nome}" — dê o nome de cada uma depois.`
        )
      }
      continue
    }

    if (d.aulas.length >= TETO.aulasPorDisciplina) {
      avisos.push(`"${d.nome ?? moduloAtual()!.nome}" chegou ao limite de aulas; parei nela.`)
      continue
    }
    d.aulas.push(nome.slice(0, TETO.tamanhoDoNome))
  }

  /* ------------------------------------------------------------------
     O CASO AMBÍGUO, E POR QUE ELE PRECISA DE UM PALPITE

         Módulo 1
           Primeira aula
           Segunda aula

     Pela regra do recuo, essas duas linhas são DISCIPLINAS. Mas ninguém
     escreve um módulo com duas disciplinas vazias — quem escreve isso
     está listando as aulas de um curso simples, sem matérias separadas.

     Então: quando TODAS as linhas de um nível abaixo do módulo estão
     vazias, elas são lidas como aulas. O aviso conta o que foi decidido,
     e a prévia mostra o resultado antes de criar — quem quisesse mesmo
     disciplinas vazias vê na hora e põe uma aula embaixo de uma delas.

     Foi o teste que trouxe este caso à tona. A regra do recuo, sozinha,
     está certa e mesmo assim entrega o resultado errado para a forma mais
     simples de escrever. */
  for (const m of modulos) {
    if (m.disciplinas.length === 0) {
      /* Módulo escrito e deixado vazio não é erro: é a pessoa montando a
         estrutura primeiro e o conteúdo depois. */
      m.disciplinas.push({ nome: null, aulas: [] })
      continue
    }

    const todasVazias = m.disciplinas.every((d) => d.aulas.length === 0 && d.nome !== null)
    if (todasVazias) {
      const viraramAulas = m.disciplinas.map((d) => d.nome as string)
      m.disciplinas = [{ nome: null, aulas: viraramAulas }]
      avisos.push(
        `Em "${m.nome}", li ${viraramAulas.length} ${
          viraramAulas.length === 1 ? 'linha' : 'linhas'
        } como aula. Para que virem disciplinas, escreva pelo menos uma aula recuada embaixo de uma delas.`
      )
    }
  }

  return { modulos, avisos }
}

/* ------------------------------------------------------------------
   O RESUMO E A CONFERÊNCIA
   ------------------------------------------------------------------ */

export interface ResumoDaMatriz {
  modulos: number
  disciplinas: number
  aulas: number
  /** Frase pronta para a tela: "3 módulos · 6 disciplinas · 60 aulas". */
  frase: string
}

export function resumoDaMatriz(matriz: MatrizLida): ResumoDaMatriz {
  const modulos = matriz.modulos.length
  /* Disciplina automática (`nome: null`) NÃO é contada: ela não é uma
     matéria, é o lugar onde a aula fica quando não há matéria. Contá-la
     faria a prévia prometer "3 disciplinas" para quem não escreveu
     nenhuma. */
  const disciplinas = matriz.modulos.reduce(
    (t, m) => t + m.disciplinas.filter((d) => d.nome !== null).length,
    0
  )
  const aulas = matriz.modulos.reduce(
    (t, m) => t + m.disciplinas.reduce((s, d) => s + d.aulas.length, 0),
    0
  )

  const parte = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
  const partes = [parte(modulos, 'módulo', 'módulos')]
  if (disciplinas > 0) partes.push(parte(disciplinas, 'disciplina', 'disciplinas'))
  partes.push(parte(aulas, 'aula', 'aulas'))

  return { modulos, disciplinas, aulas, frase: partes.join(' · ') }
}

export type Conferencia = { ok: true } | { ok: false; erro: string }

export function conferirMatriz(matriz: MatrizLida): Conferencia {
  const r = resumoDaMatriz(matriz)

  if (r.modulos === 0) {
    return { ok: false, erro: 'Escreva pelo menos um módulo para montar a matriz.' }
  }
  if (matriz.modulos.some((m) => !m.nome.trim())) {
    return { ok: false, erro: 'Há um módulo sem nome. Todo módulo precisa de um.' }
  }
  if (r.aulas > TETO.aulasNoTotal) {
    return {
      ok: false,
      erro: `São ${r.aulas} aulas de uma vez — o limite é ${TETO.aulasNoTotal}. Monte a matriz em partes.`,
    }
  }

  /* Nome repetido dentro do MESMO pai. Entre pais diferentes é normal e
     esperado: "Introdução" pode existir em Bibliologia e em Homilética, e
     recusar isso seria inventar uma regra que a escola não tem. */
  for (const m of matriz.modulos) {
    const nomes = m.disciplinas.map((d) => d.nome).filter((n): n is string => !!n)
    const repetido = nomes.find((n, i) => nomes.indexOf(n) !== i)
    if (repetido) {
      return { ok: false, erro: `"${m.nome}" tem duas disciplinas chamadas "${repetido}".` }
    }
    for (const d of m.disciplinas) {
      const repetida = d.aulas.find((a, i) => d.aulas.indexOf(a) !== i)
      if (repetida) {
        return {
          ok: false,
          erro: `"${d.nome ?? m.nome}" tem duas aulas chamadas "${repetida}".`,
        }
      }
    }
  }

  const nomesDeModulo = matriz.modulos.map((m) => m.nome)
  const moduloRepetido = nomesDeModulo.find((n, i) => nomesDeModulo.indexOf(n) !== i)
  if (moduloRepetido) {
    return { ok: false, erro: `Há dois módulos chamados "${moduloRepetido}".` }
  }

  return { ok: true }
}

/* ==================================================================
   A MATRIZ NUM CURSO QUE JÁ EXISTE

   Pedido dela: *"os cursos já criados precisam ser editáveis para as
   novas alterações também, não só os antigos."*

   O PROBLEMA REAL, COM NOMES

   O curso "Escola de Líderes" já tem o "Módulo 1 - CRER" com vinte aulas
   soltas. A escola quer separar em Bibliologia e Teologia Própria. Ela
   escreve a matriz nova e cola.

   Se a matriz sempre criasse do zero, o resultado seria um SEGUNDO
   "Módulo 1 - CRER" ao lado do primeiro: um com as vinte aulas antigas,
   outro com as matérias novas e vinte aulas repetidas. Vinte turmas
   apontando para o módulo errado, e ninguém entendendo por quê.

   Então a matriz JUNTA PELO NOME. O que já existe é reaproveitado, o que
   falta é criado, e a aula que já existe no módulo — mas na matéria
   errada — é MOVIDA em vez de duplicada.

   TRÊS DESTINOS, NÃO DOIS

   É essa terceira possibilidade que faz a coisa funcionar num curso
   antigo. "A origem das Escrituras" já existe no Módulo 1, dentro da
   matéria automática. Na matriz nova ela aparece dentro de Bibliologia.
   Não é aula nova (criar faria duas) e não é "já está certo" (ela está
   noutro lugar): é uma aula que MUDA DE MATÉRIA, levando junto o vídeo, o
   material de apoio e o progresso de quem já assistiu.

   E TUDO ISSO APARECE ANTES

   Juntar por nome sem mostrar o que vai acontecer seria pior do que
   duplicar: pelo menos duplicata se vê. Por isso a comparação é feita
   aqui, em memória, e a prévia marca cada linha com o seu destino.

   NADA AQUI IMPORTA NADA — é o que deixa o teste compilar este arquivo
   sozinho e provar caso a caso.
   ================================================================== */

/** A árvore do curso como ela está gravada hoje. */
export interface EstruturaExistente {
  modulos: {
    nome: string
    disciplinas: { nome: string; padrao: boolean; aulas: string[] }[]
  }[]
}

/** O que vai acontecer com uma aula da matriz escrita. */
export type DestinoDaAula =
  /** Não existe em lugar nenhum deste módulo: nasce. */
  | 'criar'
  /** Já está exatamente onde a matriz manda: não se toca. */
  | 'manter'
  /** Existe no módulo, noutra matéria: muda de matéria, sem perder nada. */
  | 'mover'

export interface MatrizComparada {
  modulos: {
    nome: string
    novo: boolean
    /** Como ele se chama HOJE no curso, quando já existe. */
    nomeAtual?: string
    disciplinas: {
      nome: string | null
      novo: boolean
      nomeAtual?: string
      aulas: { titulo: string; destino: DestinoDaAula; de?: string }[]
    }[]
  }[]
  criar: { modulos: number; disciplinas: number; aulas: number }
  manter: { modulos: number; disciplinas: number; aulas: number }
  mover: number
}

/**
 * Dois nomes são "o mesmo" quando só diferem no que ninguém enxerga:
 * espaço a mais, maiúscula, acento.
 *
 * IGNORAR ACENTO É DECISÃO, NÃO DESCUIDO. Quem digita a matriz no celular
 * escreve "Homiletica"; criar uma segunda matéria por causa do acento
 * seria um defeito difícil de entender depois — duas Homiléticas na tela,
 * com as aulas divididas entre elas.
 */
export function mesmoNome(a: string | null, b: string | null): boolean {
  const achatar = (t: string | null) =>
    (t ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()

  const x = achatar(a)
  const y = achatar(b)
  if (x === y) return true

  /* E TAMBÉM SEM O RÓTULO NA FRENTE — foi um teste com os dados REAIS da
     escola que obrigou esta segunda comparação.

     Os módulos dela chamam-se, no banco, "Módulo 1 - CRER" e "Módulo 2 -
     VIVER". Quando ela escreve a matriz, escreve exatamente isso — e a
     leitura, que tira rótulo repetido de propósito (senão o curso ganharia
     um módulo chamado "1. Módulo 1 - CRER"), entrega "CRER".

     "CRER" e "Módulo 1 - CRER" não batem como texto. Sem esta linha, colar
     a matriz do curso dela criaria um módulo novo ao lado de cada um dos
     que já existem — justamente o defeito que juntar por nome veio
     resolver, e justamente no curso que ela usa. */
  return achatar(limparNome(a ?? '')) === achatar(limparNome(b ?? ''))
}

export function compararComOQueExiste(
  matriz: MatrizLida,
  existente: EstruturaExistente
): MatrizComparada {
  const criar = { modulos: 0, disciplinas: 0, aulas: 0 }
  const manter = { modulos: 0, disciplinas: 0, aulas: 0 }
  let mover = 0

  const modulos = matriz.modulos.map((m) => {
    const jaExiste = existente.modulos.find((x) => mesmoNome(x.nome, m.nome))
    if (jaExiste) manter.modulos += 1
    else criar.modulos += 1

    /* Uma aula existente só pode ser reclamada UMA vez. Sem isto, uma
       matriz que repetisse o mesmo título em duas matérias do mesmo
       módulo diria "mover" para as duas — e a segunda acabaria roubando
       a aula da primeira, sem nunca ter sido criada. */
    const jaUsadas = new Set<string>()

    const disciplinas = m.disciplinas.map((d) => {
      /* A matéria automática do módulo é o "sem matéria": ela casa com a
         `padrao` de lá, e não com nenhum nome escrito. */
      const dExiste = jaExiste
        ? d.nome === null
          ? jaExiste.disciplinas.find((x) => x.padrao)
          : jaExiste.disciplinas.find((x) => mesmoNome(x.nome, d.nome))
        : undefined

      if (d.nome !== null) {
        if (dExiste) manter.disciplinas += 1
        else criar.disciplinas += 1
      }

      const aulas = d.aulas.map((titulo) => {
        /* 1. Já está nesta matéria? Então não se toca nela. */
        const aqui = dExiste?.aulas.findIndex(
          (t, i) => mesmoNome(t, titulo) && !jaUsadas.has(`${dExiste.nome}#${i}`)
        )
        if (dExiste && aqui !== undefined && aqui >= 0) {
          jaUsadas.add(`${dExiste.nome}#${aqui}`)
          manter.aulas += 1
          return { titulo, destino: 'manter' as const }
        }

        /* 2. Está no módulo, mas em OUTRA matéria? Então ela se muda —
              com vídeo, material e progresso de quem já assistiu. */
        if (jaExiste) {
          for (const outra of jaExiste.disciplinas) {
            if (outra === dExiste) continue
            const i = outra.aulas.findIndex(
              (t, k) => mesmoNome(t, titulo) && !jaUsadas.has(`${outra.nome}#${k}`)
            )
            if (i >= 0) {
              jaUsadas.add(`${outra.nome}#${i}`)
              mover += 1
              return { titulo, destino: 'mover' as const, de: outra.nome }
            }
          }
        }

        /* 3. Não existe: nasce. */
        criar.aulas += 1
        return { titulo, destino: 'criar' as const }
      })

      /* O nome ATUAL viaja junto porque a prévia precisa dele.
         A leitura tira o rótulo ("Módulo 1 - CRER" vira "CRER"), e a
         prévia mostrando "CRER — já existe" faria ela procurar na tela um
         módulo com esse nome, que não existe. Mostrando "Módulo 1 - CRER"
         ela reconhece o próprio curso. */
      return { nome: d.nome, novo: !dExiste, nomeAtual: dExiste?.nome, aulas }
    })

    return { nome: m.nome, novo: !jaExiste, nomeAtual: jaExiste?.nome, disciplinas }
  })

  return { modulos, criar, manter, mover }
}

/** A frase da prévia, quando parte da matriz já está no curso. */
export function fraseDoQueVaiAcontecer(c: MatrizComparada): string {
  const parte = (n: number, um: string, varios: string) =>
    `${n} ${n === 1 ? um : varios}`

  const novos: string[] = []
  if (c.criar.modulos > 0) novos.push(parte(c.criar.modulos, 'módulo', 'módulos'))
  if (c.criar.disciplinas > 0)
    novos.push(parte(c.criar.disciplinas, 'disciplina', 'disciplinas'))
  if (c.criar.aulas > 0) novos.push(parte(c.criar.aulas, 'aula', 'aulas'))

  const frases: string[] = []
  if (novos.length > 0) frases.push(`Criar ${novos.join(' · ')}`)
  if (c.mover > 0) frases.push(`mover ${parte(c.mover, 'aula', 'aulas')} de matéria`)

  const intactas = c.manter.modulos + c.manter.disciplinas + c.manter.aulas

  if (frases.length === 0) {
    return intactas > 0
      ? 'Tudo isso já existe no curso, exatamente assim — nada a fazer.'
      : 'Nada a criar.'
  }

  const frase = frases.join(' e ')
  return intactas > 0 ? `${frase}. O resto já existe e fica como está.` : `${frase}.`
}
