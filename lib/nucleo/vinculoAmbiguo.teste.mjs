/* ============================================================
   A VARREDURA DOS VÍNCULOS AMBÍGUOS

   Roda com:  node lib/nucleo/vinculoAmbiguo.teste.mjs

   Faz duas coisas:

   1. Prova a regra caso a caso (inclusive uma rodada de controle).
   2. VARRE O PROJETO INTEIRO e falha se qualquer consulta pedir um
      vínculo ambíguo sem escolher o caminho.

   O item 2 é o que impede esta armadilha de voltar. Ela já derrubou três
   telas neste projeto — a caixa de correção do professor, a lista de
   matriculados da turma e a lista de chamada — e as três falharam do
   mesmo jeito: lista vazia, sem erro nenhum na tela.
   ============================================================ */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = resolve(aqui, '..', '..')
const pasta = mkdtempSync(join(tmpdir(), 'ibau-vinculo-'))
try {
  execFileSync(
    process.execPath,
    [
      join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'),
      join(aqui, 'vinculoAmbiguo.ts'),
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
const M = await import(pathToFileURL(join(pasta, 'vinculoAmbiguo.js')).href)

const provas = []
const prova = (nome, ok, extra = '') => provas.push([nome, ok, extra])

/* ================= A REGRA ================= */

const AMBIGUA = `const { data } = await supabase
  .from('turma_alunos')
  .select('id, aluno_id, users(id, name, email)')
  .eq('turma_id', id)`

const CERTA = `const { data } = await supabase
  .from('turma_alunos')
  .select('id, aluno_id, users:users!turma_alunos_aluno_id_fkey(id, name, email)')
  .eq('turma_id', id)`

prova('a consulta EXATA que quebrou a tela da turma é acusada',
  M.acusarAmbiguos(M.lerConsultas(AMBIGUA)).length === 1,
  '"Alunos matriculados (0)" com dois alunos no banco')

prova('e a mesma consulta com o caminho escolhido passa',
  M.acusarAmbiguos(M.lerConsultas(CERTA)).length === 0)

prova('a forma sem apelido também passa',
  M.acusarAmbiguos(M.lerConsultas(
    `.from('presencas').select('aluno_id, users!presencas_aluno_id_fkey(name)')`
  )).length === 0)

prova('a acusação diz quais são os caminhos, para não ter de procurar',
  (() => {
    const a = M.acusarAmbiguos(M.lerConsultas(AMBIGUA))[0]
    return a.caminhos.includes('turma_alunos_aluno_id_fkey') &&
      a.caminhos.includes('turma_alunos_concluida_por_fkey')
  })())

prova('tabela SEM caminho duplo não é acusada',
  M.acusarAmbiguos(M.lerConsultas(
    `.from('encontros').select('id, turmas(nome)')`
  )).length === 0,
  'acusar o que está certo faria a varredura ser desligada na primeira semana')

prova('o vínculo que nem é pedido não é acusado',
  M.acusarAmbiguos(M.lerConsultas(
    `.from('turma_alunos').select('id, aluno_id, status')`
  )).length === 0)

prova('duas consultas no mesmo arquivo são lidas separadamente',
  (() => {
    const c = M.lerConsultas(
      `.from('turma_alunos').select('a, users(name)')\n.from('presencas').select('b, users(name)')`
    )
    return c.length === 2 && M.acusarAmbiguos(c).length === 2
  })())

prova('o select de uma consulta não vaza para a seguinte',
  (() => {
    const c = M.lerConsultas(
      `.from('encontros').select('id')\n.from('turma_alunos').select('users(name)')`
    )
    return c[0].tabela === 'encontros' && c[0].select === 'id'
  })())

prova('CONTROLE: uma varredura que aceitasse tudo seria acusada aqui',
  (() => {
    const cega = () => []
    return cega().length === 0 && M.acusarAmbiguos(M.lerConsultas(AMBIGUA)).length === 1
  })())

/* ================= A VARREDURA DO PROJETO ================= */

const PASTAS = ['app', 'lib', 'components']
const IGNORAR = new Set(['node_modules', '.next', '.git'])
const arquivos = []
const andar = (dir) => {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) andar(p)
    else if (/\.(ts|tsx)$/.test(nome) && !/\.teste\./.test(nome)) arquivos.push(p)
  }
}
for (const d of PASTAS) andar(join(raiz, d))

const acusadas = []
for (const arq of arquivos) {
  const codigo = readFileSync(arq, 'utf-8')
  for (const a of M.acusarAmbiguos(M.lerConsultas(codigo))) {
    acusadas.push(`${relative(raiz, arq)}:${a.linha} — ${a.tabela} → ${a.vinculo}`)
  }
}

prova(`o projeto inteiro (${arquivos.length} arquivos) não tem nenhum vínculo ambíguo`,
  acusadas.length === 0,
  acusadas.length ? acusadas.join('\n         ') : 'nenhuma consulta pede vínculo sem dizer o caminho')

let falhas = 0
for (const [nome, ok, extra] of provas) {
  if (!ok) falhas++
  console.log(`  ${ok ? 'OK   ' : 'FALHA'} | ${nome}`)
  if (extra) console.log(`         ${extra}`)
}
rmSync(pasta, { recursive: true, force: true })
console.log(
  falhas === 0
    ? `\n${provas.length} casos: nenhuma tela pode voltar a dizer "vazio" quando na verdade quebrou.`
    : `\n${falhas} FALHA(S) de ${provas.length}`
)
process.exit(falhas === 0 ? 0 : 1)
