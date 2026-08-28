/* ============================================================
   A MATRIZ CURRICULAR — TODOS OS CASOS

   Roda com:  node lib/nucleo/matrizCurricular.teste.mjs

   Compila e importa o arquivo DE VERDADE (mesmo padrão de
   recuperacaoDeSenha e recadoDaLumi).
   ============================================================ */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = resolve(aqui, '..', '..')
const pasta = mkdtempSync(join(tmpdir(), 'ibau-matriz-'))
try {
  execFileSync(
    process.execPath,
    [
      join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'),
      join(aqui, 'matrizCurricular.ts'),
      '--outDir', pasta, '--target', 'es2020', '--module', 'esnext',
      '--moduleResolution', 'bundler', '--skipLibCheck',
    ],
    { stdio: 'pipe' }
  )
} catch (e) {
  console.error('Falhou ao compilar:\n' + (e.stdout?.toString() || e.message))
  process.exit(1)
}
writeFileSync(join(pasta, 'package.json'), '{"type":"module"}')
const M = await import(pathToFileURL(join(pasta, 'matrizCurricular.js')).href)

const provas = []
const prova = (nome, ok, extra = '') => provas.push([nome, ok, extra])
const forma = (m) =>
  m.modulos.map((x) => `${x.nome}[${x.disciplinas.map((d) => `${d.nome ?? '*'}:${d.aulas.length}`).join(',')}]`).join(' | ')

/* ================= O CASO QUE ELA DESCREVEU ================= */

const dela = M.lerMatriz(`Módulo 1 — Fundamentos
  Bibliologia
    10 aulas
  Teologia Própria
    10 aulas
Módulo 2 — Discipulado
  Vida devocional
    10 aulas
  Relacionamentos
    10 aulas
Módulo 3 — Liderança
  Governo da igreja
    10 aulas
  Homilética
    10 aulas`)

prova('3 módulos, 2 disciplinas em cada, 10 aulas em cada disciplina',
  (() => {
    const r = M.resumoDaMatriz(dela)
    return r.modulos === 3 && r.disciplinas === 6 && r.aulas === 60
  })(),
  M.resumoDaMatriz(dela).frase)

prova('e a estrutura sai na ordem escrita',
  dela.modulos[0].nome === 'Fundamentos' &&
    dela.modulos[0].disciplinas[0].nome === 'Bibliologia' &&
    dela.modulos[2].disciplinas[1].nome === 'Homilética',
  forma(dela).slice(0, 90) + '…')

prova('a matriz dela passa na conferência', M.conferirMatriz(dela).ok === true)

/* ================= O NOME DE CADA AULA ================= */

const comNomes = M.lerMatriz(`Fundamentos
  Bibliologia
    A origem das Escrituras
    O cânon do Antigo Testamento
    Inspiração e inerrância`)

prova('cada aula guarda o SEU nome, e não "Aula 1"',
  comNomes.modulos[0].disciplinas[0].aulas.join(' | ') ===
    'A origem das Escrituras | O cânon do Antigo Testamento | Inspiração e inerrância',
  comNomes.modulos[0].disciplinas[0].aulas.join(' | '))

/* ================= O QUE VEM COLADO DO WORD ================= */

prova('marcador de lista é retirado',
  M.lerMatriz('- Fundamentos\n  • Bibliologia\n    * O cânon').modulos[0].disciplinas[0].aulas[0] === 'O cânon')

prova('numeração digitada à mão é retirada',
  (() => {
    const r = M.lerMatriz('1. Fundamentos\n  1.1 Bibliologia\n    1.1.1 O cânon')
    return r.modulos[0].nome === 'Fundamentos' &&
      r.modulos[0].disciplinas[0].nome === 'Bibliologia' &&
      r.modulos[0].disciplinas[0].aulas[0] === 'O cânon'
  })(),
  forma(M.lerMatriz('1. Fundamentos\n  1.1 Bibliologia\n    1.1.1 O cânon')))

prova('rótulo redundante ("Módulo 1:", "Aula 3 -") é retirado',
  (() => {
    const r = M.lerMatriz('Módulo 1: Fundamentos\n  Disciplina - Bibliologia\n    Aula 3 — O cânon')
    return r.modulos[0].nome === 'Fundamentos' &&
      r.modulos[0].disciplinas[0].nome === 'Bibliologia' &&
      r.modulos[0].disciplinas[0].aulas[0] === 'O cânon'
  })(),
  'senão o curso teria "Módulo 1: Fundamentos" e "Aula 3 - O cânon" com dois números brigando')

prova('tabulação, 2 espaços e 4 espaços dão o MESMO resultado',
  (() => {
    const a = forma(M.lerMatriz('A\n  B\n    C'))
    const b = forma(M.lerMatriz('A\n\tB\n\t\tC'))
    const c = forma(M.lerMatriz('A\n    B\n        C'))
    return a === b && b === c
  })(),
  forma(M.lerMatriz('A\n\tB\n\t\tC')))

prova('linhas em branco no meio não atrapalham',
  forma(M.lerMatriz('A\n\n  B\n\n\n    C')) === forma(M.lerMatriz('A\n  B\n    C')))

/* ================= GERAR AULAS NUMERADAS ================= */

prova('"10 aulas" gera dez aulas numeradas',
  (() => {
    const r = M.lerMatriz('A\n  B\n    10 aulas')
    const aulas = r.modulos[0].disciplinas[0].aulas
    return aulas.length === 10 && aulas[0] === 'Aula 1' && aulas[9] === 'Aula 10'
  })())

prova('"x10" e "10" também geram',
  M.lerMatriz('A\n  B\n    x10').modulos[0].disciplinas[0].aulas.length === 10 &&
    M.lerMatriz('A\n  B\n    10').modulos[0].disciplinas[0].aulas.length === 10)

prova('e avisa que as aulas geradas ainda estão sem nome',
  M.lerMatriz('A\n  B\n    10 aulas').avisos.some((a) => /d[êe] o nome/i.test(a)),
  M.lerMatriz('A\n  B\n    10 aulas').avisos[0])

prova('gerar duas vezes continua a numeração em vez de recomeçar',
  (() => {
    const aulas = M.lerMatriz('A\n  B\n    3 aulas\n    2 aulas').modulos[0].disciplinas[0].aulas
    return aulas.length === 5 && aulas[4] === 'Aula 5'
  })())

/* ================= CURSO SIMPLES, SEM DISCIPLINA ================= */

const simples = M.lerMatriz(`Módulo 1
  Primeira aula
  Segunda aula`)

prova('curso simples: módulo + linhas recuadas viram AULAS, não disciplinas vazias',
  simples.modulos[0].disciplinas.length === 1 &&
    simples.modulos[0].disciplinas[0].nome === null &&
    simples.modulos[0].disciplinas[0].aulas.length === 2,
  forma(simples))

prova('e a prévia NÃO promete disciplina que ninguém escreveu',
  M.resumoDaMatriz(simples).disciplinas === 0 &&
    !/disciplina/.test(M.resumoDaMatriz(simples).frase),
  M.resumoDaMatriz(simples).frase)

prova('e o aviso conta o palpite, para ela poder desfazer se quiser',
  simples.avisos.some((a) => /li 2 linhas como aula/i.test(a)),
  simples.avisos[0])

prova('mas com UMA aula recuada embaixo, elas voltam a ser disciplinas',
  (() => {
    const r = M.lerMatriz('Módulo 1\n  Bibliologia\n    O cânon\n  Teologia')
    return r.modulos[0].disciplinas.length === 2 &&
      r.modulos[0].disciplinas[0].nome === 'Bibliologia' &&
      r.modulos[0].disciplinas[1].nome === 'Teologia'
  })(),
  forma(M.lerMatriz('Módulo 1\n  Bibliologia\n    O cânon\n  Teologia')))

prova('módulo escrito e deixado vazio não é erro',
  (() => {
    const r = M.lerMatriz('Módulo 1\nMódulo 2\nMódulo 3')
    return r.modulos.length === 3 && M.conferirMatriz(r).ok === true &&
      M.resumoDaMatriz(r).aulas === 0
  })(),
  'é a pessoa montando a estrutura primeiro e o conteúdo depois')

/* ================= ESCRITO FORA DE ORDEM ================= */

prova('bloco inteiro recuado (colado de dentro de um documento) é normalizado',
  (() => {
    const dentro = M.lerMatriz('      Fundamentos\n        Bibliologia\n          O cânon')
    const fora = M.lerMatriz('Fundamentos\n  Bibliologia\n    O cânon')
    return forma(dentro) === forma(fora)
  })(),
  'o que importa é a diferença entre os recuos, não a margem em que o texto começa')

prova('recuo fundo demais entra como aula, com aviso',
  (() => {
    const r = M.lerMatriz('A\n  B\n    C\n      D')
    return r.modulos[0].disciplinas[0].aulas.includes('D') &&
      r.avisos.some((a) => /recuada demais/i.test(a))
  })())

prova('texto vazio não quebra e não cria nada',
  (() => {
    const r = M.lerMatriz('')
    return r.modulos.length === 0 && M.conferirMatriz(r).ok === false
  })())

prova('só espaços em branco também não cria nada',
  M.lerMatriz('   \n\t\n  ').modulos.length === 0)

/* ================= OS TETOS ================= */

prova('colar um livro por engano é recusado, com o número na frase',
  (() => {
    const texto = 'A\n' + Array.from({ length: 4 }, (_, i) => `  D${i}\n    200 aulas`).join('\n')
    const r = M.conferirMatriz(M.lerMatriz(texto))
    return r.ok === false && /limite é 600/.test(r.erro)
  })(),
  M.conferirMatriz(M.lerMatriz('A\n' + Array.from({ length: 4 }, (_, i) => `  D${i}\n    200 aulas`).join('\n'))).erro)

prova('mais módulos que o teto: para e avisa, em vez de criar tudo',
  (() => {
    const r = M.lerMatriz(Array.from({ length: 30 }, (_, i) => `Modulo ${i + 1}`).join('\n'))
    return r.modulos.length === M.TETO.modulos && r.avisos.some((a) => /máximo por curso/i.test(a))
  })())

/* ================= NOME REPETIDO ================= */

prova('duas disciplinas com o mesmo nome no MESMO módulo são recusadas',
  (() => {
    const r = M.conferirMatriz(M.lerMatriz('A\n  Bibliologia\n    X\n  Bibliologia\n    Y'))
    return r.ok === false && /duas disciplinas/.test(r.erro)
  })(),
  M.conferirMatriz(M.lerMatriz('A\n  Bibliologia\n    X\n  Bibliologia\n    Y')).erro)

prova('o MESMO nome em módulos diferentes é aceito',
  M.conferirMatriz(M.lerMatriz('A\n  Introdução\n    X\nB\n  Introdução\n    Y')).ok === true,
  '"Introdução" pode existir em duas matérias — recusar seria inventar regra que a escola não tem')

prova('duas aulas com o mesmo nome na mesma disciplina são recusadas',
  M.conferirMatriz(M.lerMatriz('A\n  B\n    O cânon\n    O cânon')).ok === false)

prova('dois módulos com o mesmo nome são recusados',
  M.conferirMatriz(M.lerMatriz('Fundamentos\nFundamentos')).ok === false)

/* ================= CONTROLE ================= */

prova('CONTROLE: uma leitura que ignorasse o recuo seria acusada aqui',
  (() => {
    const tudoModulo = (t) => ({ modulos: t.split('\n').map((l) => ({ nome: l, disciplinas: [] })) })
    const ingenua = tudoModulo('A\n  B\n    C')
    const real = M.lerMatriz('A\n  B\n    C')
    return ingenua.modulos.length === 3 && real.modulos.length === 1
  })())

prova('CONTROLE: uma conferência que aceitasse tudo seria acusada aqui',
  (() => {
    const aceitaTudo = () => ({ ok: true })
    return aceitaTudo().ok === true && M.conferirMatriz(M.lerMatriz('')).ok === false
  })())

prova('quando o rótulo sai da frente do nome, ela é avisada — uma vez só',
  (() => {
    const r = M.lerMatriz('Módulo 1 - CRER\n  Bibliologia\n    AULA 01 - A história\n    AULA 02 - O pecado')
    const doRotulo = r.avisos.filter((a) => /numera sozinha/.test(a))
    return doRotulo.length === 1 &&
      r.modulos[0].disciplinas[0].aulas.join('|') === 'A história|O pecado'
  })(),
  'a escola escreve "AULA 01 - ..."; sem o aviso, ela acharia que a plataforma comeu parte do nome')

prova('sem rótulo nenhum, não há aviso sobrando',
  M.lerMatriz('Fundamentos\n  Bibliologia\n    O cânon').avisos.filter((a) => /numera sozinha/.test(a)).length === 0)

/* ================================================================
   A MATRIZ NUM CURSO QUE JÁ EXISTE

   O caso dela, com os nomes reais: o "Módulo 1 - CRER" existe, com aulas
   soltas na matéria automática. Ela cola a matriz separando em
   Bibliologia e Teologia Própria.
   ================================================================ */

const ANTIGO = {
  modulos: [
    {
      nome: 'Módulo 1 - CRER',
      disciplinas: [
        {
          nome: 'Conteúdo do módulo',
          padrao: true,
          aulas: ['A origem das Escrituras', 'O cânon do Antigo Testamento', 'Quem é Deus'],
        },
      ],
    },
  ],
}

const MATRIZ_NOVA = `Módulo 1 - CRER
  Bibliologia
    A origem das Escrituras
    O cânon do Antigo Testamento
    A inspiração das Escrituras
  Teologia Própria
    Quem é Deus
Módulo 2 - VIVER
  Vida devocional
    A oração`

const c = M.compararComOQueExiste(M.lerMatriz(MATRIZ_NOVA), ANTIGO)

prova('o módulo que JÁ EXISTE é reaproveitado, não duplicado',
  c.manter.modulos === 1 && c.criar.modulos === 1,
  'sem isto o curso ficaria com dois "Módulo 1 - CRER", um com as aulas e outro com as matérias')

prova('as aulas que já existiam MUDAM DE MATÉRIA em vez de nascer de novo',
  c.mover === 3,
  'as três aulas soltas viram Bibliologia e Teologia — levando vídeo, material e o progresso de quem assistiu')

prova('e a comparação diz DE ONDE cada uma vem',
  c.modulos[0].disciplinas[0].aulas[0].de === 'Conteúdo do módulo',
  JSON.stringify(c.modulos[0].disciplinas[0].aulas[0]))

prova('só a aula realmente nova é criada',
  c.criar.aulas === 2,
  '"A inspiração das Escrituras" (nova no módulo 1) e "A oração" (no módulo 2 que ainda não existe)')

prova('as disciplinas escritas são criadas — o módulo antigo não tinha nenhuma com nome',
  c.criar.disciplinas === 3 && c.manter.disciplinas === 0,
  'Bibliologia, Teologia Própria e Vida devocional')

prova('colar a MESMA matriz duas vezes não faz nada na segunda',
  (() => {
    /* Depois da primeira colagem o curso ficaria assim: */
    const depois = {
      modulos: [
        {
          nome: 'Módulo 1 - CRER',
          disciplinas: [
            { nome: 'Conteúdo do módulo', padrao: true, aulas: [] },
            { nome: 'Bibliologia', padrao: false, aulas: ['A origem das Escrituras', 'O cânon do Antigo Testamento', 'A inspiração das Escrituras'] },
            { nome: 'Teologia Própria', padrao: false, aulas: ['Quem é Deus'] },
          ],
        },
        {
          nome: 'Módulo 2 - VIVER',
          disciplinas: [{ nome: 'Vida devocional', padrao: false, aulas: ['A oração'] }],
        },
      ],
    }
    const r = M.compararComOQueExiste(M.lerMatriz(MATRIZ_NOVA), depois)
    return r.criar.modulos === 0 && r.criar.disciplinas === 0 && r.criar.aulas === 0 && r.mover === 0
  })(),
  'é o erro mais fácil de cometer: corrigir uma linha da matriz e colar de novo')

prova('acento e maiúscula não criam matéria repetida',
  (() => {
    const existe = {
      modulos: [{ nome: 'Módulo 1', disciplinas: [{ nome: 'Homilética', padrao: false, aulas: [] }] }],
    }
    const r = M.compararComOQueExiste(M.lerMatriz('modulo 1\n  HOMILETICA\n    Aula'), existe)
    return r.criar.disciplinas === 0 && r.manter.disciplinas === 1
  })(),
  'quem digita no celular escreve "Homiletica" — duas Homiléticas na tela seria pior que exigir o acento')

prova('nomes diferentes de verdade continuam sendo coisas diferentes',
  M.mesmoNome('Bibliologia', 'Bibliologia II') === false)

prova('um curso VAZIO cria tudo, e nada é dado como existente',
  (() => {
    const r = M.compararComOQueExiste(M.lerMatriz(MATRIZ_NOVA), { modulos: [] })
    return r.criar.modulos === 2 && r.criar.aulas === 5 && r.mover === 0 &&
      r.manter.modulos === 0 && r.manter.aulas === 0
  })())

prova('a aula que já está NA MATÉRIA CERTA não é mexida',
  (() => {
    const existe = {
      modulos: [{ nome: 'M', disciplinas: [{ nome: 'Bibliologia', padrao: false, aulas: ['O cânon'] }] }],
    }
    const r = M.compararComOQueExiste(M.lerMatriz('M\n  Bibliologia\n    O cânon'), existe)
    return r.manter.aulas === 1 && r.mover === 0 && r.criar.aulas === 0 &&
      r.modulos[0].disciplinas[0].aulas[0].destino === 'manter'
  })(),
  'mover uma aula que já está no lugar renumeraria ela sem motivo')

prova('uma aula existente não é reclamada por duas matérias ao mesmo tempo',
  (() => {
    const existe = {
      modulos: [{ nome: 'M', disciplinas: [{ nome: 'Velha', padrao: true, aulas: ['Aula X'] }] }],
    }
    const r = M.compararComOQueExiste(M.lerMatriz('M\n  A\n    Aula X\n  B\n    Aula X'), existe)
    const destinos = r.modulos[0].disciplinas.map((d) => d.aulas[0].destino)
    return destinos.join() === 'mover,criar'
  })(),
  'sem a marcação de "já usada", a segunda matéria roubaria a aula da primeira')

prova('a frase diz as três coisas: o que nasce, o que se muda e o que fica',
  (() => {
    const f = M.fraseDoQueVaiAcontecer(c)
    return /Criar/.test(f) && /mover 3 aulas/.test(f) && /já existe/.test(f)
  })(),
  M.fraseDoQueVaiAcontecer(c))

prova('quando não há nada a fazer, a frase diz isso com todas as letras',
  /nada a fazer/i.test(
    M.fraseDoQueVaiAcontecer({
      modulos: [], criar: { modulos: 0, disciplinas: 0, aulas: 0 },
      manter: { modulos: 1, disciplinas: 1, aulas: 3 }, mover: 0,
    })
  ))

prova('CONTROLE: uma comparação que ignorasse o que existe seria acusada aqui',
  (() => {
    const cega = M.compararComOQueExiste(M.lerMatriz(MATRIZ_NOVA), { modulos: [] })
    return cega.criar.aulas === 5 && c.criar.aulas === 2
  })(),
  'se juntar por nome não fizesse diferença, os casos acima passariam por acaso')

let falhas = 0
for (const [nome, ok, extra] of provas) {
  if (!ok) falhas++
  console.log(`  ${ok ? 'OK   ' : 'FALHA'} | ${nome}`)
  if (extra) console.log(`         ${extra}`)
}
rmSync(pasta, { recursive: true, force: true })
console.log(
  falhas === 0
    ? `\n${provas.length} casos: a matriz sai do papel para a plataforma do jeito que foi escrita.`
    : `\n${falhas} FALHA(S) de ${provas.length}`
)
process.exit(falhas === 0 ? 0 : 1)
