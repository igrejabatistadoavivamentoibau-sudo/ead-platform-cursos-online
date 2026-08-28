/* ============================================================
   MATRÍCULA — OS CASOS DO DEFEITO QUE QUEBROU EM PRODUÇÃO

   Roda com:  node lib/nucleo/matricula.teste.mjs

   Compila e importa o arquivo DE VERDADE, para o teste não ser uma cópia
   da regra que possa divergir dela.
   ============================================================ */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = resolve(aqui, '..', '..')
const pasta = mkdtempSync(join(tmpdir(), 'ibau-matricula-'))
try {
  execFileSync(
    process.execPath,
    [
      join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'),
      join(aqui, 'matricula.ts'),
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
const M = await import(pathToFileURL(join(pasta, 'matricula.js')).href)

const provas = []
const prova = (nome, ok, extra = '') => provas.push([nome, ok, extra])

/* Os dados reais da escola no dia do defeito: dois alunos ativos, os dois
   já matriculados na única turma. */
const ALUNOS = [
  { id: 'a-lumi', name: 'Lumi' },
  { id: 'a-rafael', name: 'RAFAEL MEDEIROS' },
]
const DENTRO = [
  { matriculaId: 'm1', id: 'a-lumi', name: 'Lumi', email: 'lumi@ibau.com.br' },
  { matriculaId: 'm2', id: 'a-rafael', name: 'RAFAEL MEDEIROS', email: 'r@h.com' },
]

/* ================= QUEM AINDA PODE ENTRAR ================= */

prova('com todos já matriculados, a lista fica VAZIA — que é o caso que quebrou',
  M.alunosQuePodemEntrar(ALUNOS, DENTRO).length === 0,
  'era exatamente isto: a tela oferecia os dois, e os dois já estavam lá')

prova('quem já está na turma não aparece para ser matriculado de novo',
  M.alunosQuePodemEntrar(ALUNOS, [DENTRO[0]]).map((a) => a.id).join() === 'a-rafael')

prova('com ninguém matriculado, todos aparecem',
  M.alunosQuePodemEntrar(ALUNOS, []).length === 2)

prova('a comparação é por id, não por nome — dois cadastros de mesmo nome são duas pessoas',
  (() => {
    const dois = [
      { id: 'x1', name: 'Rafael Medeiros' },
      { id: 'x2', name: 'Rafael Medeiros' },
    ]
    const r = M.alunosQuePodemEntrar(dois, [{ id: 'x1' }])
    return r.length === 1 && r[0].id === 'x2'
  })(),
  'a escola JÁ tem dois cadastros parecidos; esconder um deles seria perder uma pessoa')

prova('a ordem da lista original é preservada',
  M.alunosQuePodemEntrar(ALUNOS, []).map((a) => a.name).join('|') === 'Lumi|RAFAEL MEDEIROS')

prova('lista vazia de alunos não quebra',
  M.alunosQuePodemEntrar([], DENTRO).length === 0)

prova('matriculado que não está entre os disponíveis (aluno desativado) não atrapalha',
  M.alunosQuePodemEntrar(ALUNOS, [{ id: 'sumido' }]).length === 2,
  'quem foi desativado continua na turma, mas some da lista de escolha por outro caminho')

/* ================= A FRASE DO ERRO ================= */

const REAL =
  'duplicate key value violates unique constraint "turma_alunos_turma_id_aluno_id_key"'

prova('a frase EXATA que apareceu nos registros vira português',
  M.traduzirErroDeMatricula(REAL) === 'Esse aluno já está matriculado nesta turma.',
  M.traduzirErroDeMatricula(REAL))

prova('qualquer "duplicate key" cai na mesma explicação',
  /já está matriculado/.test(M.traduzirErroDeMatricula('duplicate key value violates')))

prova('turma que sumiu no meio do caminho é dita como turma',
  /turma não existe mais/i.test(
    M.traduzirErroDeMatricula(
      'insert violates foreign key constraint "turma_alunos_turma_id_fkey"'
    )
  ))

prova('aluno que sumiu é dito como aluno',
  /aluno não existe mais/i.test(
    M.traduzirErroDeMatricula('insert violates foreign key constraint "aluno_fkey"')
  ))

prova('recusa de permissão não vira "tente de novo" — tentar de novo não resolveria',
  /permissão/i.test(
    M.traduzirErroDeMatricula('new row violates row-level security policy for table')
  ))

prova('sessão vencida manda entrar de novo, que é a única saída',
  /sess[ãa]o expirou/i.test(M.traduzirErroDeMatricula('JWT expired')))

prova('erro desconhecido COM texto é mostrado como veio, em vez de ser engolido',
  M.traduzirErroDeMatricula('conexão recusada pelo banco') === 'conexão recusada pelo banco',
  'esconder o que não conhecemos é como se chega no parágrafo em inglês')

prova('erro desconhecido SEM texto cai na frase padrão',
  M.traduzirErroDeMatricula('') === 'Não consegui matricular. Tente de novo.')

prova('a frase padrão pode ser trocada por quem chama',
  M.traduzirErroDeMatricula('', 'Não deu.') === 'Não deu.')

/* ================= CONTROLE ================= */

prova('CONTROLE: a lista SEM filtro — o defeito de verdade — seria acusada aqui',
  (() => {
    const semFiltro = ALUNOS // era isto que a tela passava para o seletor
    const comFiltro = M.alunosQuePodemEntrar(ALUNOS, DENTRO)
    return semFiltro.length === 2 && comFiltro.length === 0
  })(),
  'se as duas listas fossem iguais, os casos acima passariam por acaso')

prova('CONTROLE: uma tradução que devolvesse tudo igual seria acusada aqui',
  (() => {
    const ingenua = (m) => m
    return ingenua(REAL) === REAL && M.traduzirErroDeMatricula(REAL) !== REAL
  })())

let falhas = 0
for (const [nome, ok, extra] of provas) {
  if (!ok) falhas++
  console.log(`  ${ok ? 'OK   ' : 'FALHA'} | ${nome}`)
  if (extra) console.log(`         ${extra}`)
}
rmSync(pasta, { recursive: true, force: true })
console.log(
  falhas === 0
    ? `\n${provas.length} casos: quem já está na turma não é oferecido, e o que der errado chega em português.`
    : `\n${falhas} FALHA(S) de ${provas.length}`
)
process.exit(falhas === 0 ? 0 : 1)
