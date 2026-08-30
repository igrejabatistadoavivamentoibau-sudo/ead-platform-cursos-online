/* ============================================================
   A LISTA DE CHAMADA — OS CASOS DA QUEIXA

   Roda com:  node lib/nucleo/chamada.teste.mjs

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
const pasta = mkdtempSync(join(tmpdir(), 'ibau-chamada-'))
try {
  execFileSync(
    process.execPath,
    [
      join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'),
      join(aqui, 'chamada.ts'),
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
const M = await import(pathToFileURL(join(pasta, 'chamada.js')).href)

const provas = []
const prova = (nome, ok, extra = '') => provas.push([nome, ok, extra])

const m = (id, nome, status = 'ativo') => ({
  alunoId: id, nome, email: `${id}@ibau.test`, status,
})
const p = (id, presente, nome = '') => ({ alunoId: id, presente, nome, email: '' })

/* ===== O CASO DA QUEIXA ===== */

prova('quem foi matriculado DEPOIS do encontro aparece na chamada',
  (() => {
    /* O encontro nasceu com Lumi só. Rafael entrou depois. */
    const r = M.listaDeChamada(
      [m('lumi', 'Lumi'), m('rafael', 'RAFAEL MEDEIROS')],
      [p('lumi', true, 'Lumi')]
    )
    return r.length === 2 && r.some((l) => l.alunoId === 'rafael')
  })(),
  'era exatamente isto: matriculado no banco, invisível na lista')

prova('e vem marcado como "entrou depois", em vez de virar falta',
  (() => {
    const r = M.listaDeChamada(
      [m('lumi', 'Lumi'), m('rafael', 'RAFAEL MEDEIROS')],
      [p('lumi', true, 'Lumi')]
    )
    const rafael = r.find((l) => l.alunoId === 'rafael')
    return rafael.semRegistro === true && rafael.presente === false
  })(),
  'ele não estava na sala no dia — falta seria acusação, "sem marca" é o fato')

prova('quem já tinha marca continua com a marca que tinha',
  (() => {
    const r = M.listaDeChamada([m('lumi', 'Lumi')], [p('lumi', true, 'Lumi')])
    return r[0].presente === true && r[0].semRegistro === false
  })())

/* ===== QUEM SAIU ===== */

prova('quem foi transferido mas esteve neste encontro NÃO some do registro',
  (() => {
    const r = M.listaDeChamada([m('lumi', 'Lumi')], [p('ana', true, 'ANA PAULA')])
    const ana = r.find((l) => l.alunoId === 'ana')
    return !!ana && ana.saiu === true && ana.presente === true
  })(),
  'ela esteve na sala em março; apagá-la faria o encontro de março mostrar menos gente do que havia')

prova('quem está inativo na turma e não tem marca não aparece',
  M.listaDeChamada([m('lumi', 'Lumi'), m('sumido', 'Sumido', 'inativo')], []).length === 1)

prova('inativo COM marca aparece, sinalizado',
  (() => {
    const r = M.listaDeChamada([m('sumido', 'Sumido', 'inativo')], [p('sumido', true, 'Sumido')])
    return r.length === 1 && r[0].saiu === true
  })())

/* ===== O RESTO ===== */

prova('turma sem ninguém dá lista vazia, e não quebra',
  M.listaDeChamada([], []).length === 0)

prova('encontro novo, sem marca nenhuma: todos aparecem sem marca',
  (() => {
    const r = M.listaDeChamada([m('a', 'Ana'), m('b', 'Bruno')], [])
    return r.length === 2 && r.every((l) => l.semRegistro && !l.presente)
  })(),
  'chamada que nasce toda marcada é chamada que ninguém faz')

prova('a ordem é alfabética em português',
  M.listaDeChamada(
    [m('c', 'Ângela'), m('a', 'Bruno'), m('b', 'Ana')],
    []
  ).map((l) => l.nome).join('|') === 'Ana|Ângela|Bruno')

prova('a contagem de quem ainda não tem marca é a que a tela mostra',
  M.quantosSemRegistro(
    M.listaDeChamada([m('a', 'Ana'), m('b', 'Bruno')], [p('a', true)])
  ) === 1)

prova('ninguém aparece duas vezes',
  (() => {
    const r = M.listaDeChamada([m('a', 'Ana')], [p('a', true, 'Ana')])
    return r.length === 1
  })())

/* ===== CONTROLE ===== */

prova('CONTROLE: a lista montada SÓ das presenças — o defeito — seria acusada aqui',
  (() => {
    const soPresencas = [p('lumi', true, 'Lumi')] // era isto que a tela lia
    const certa = M.listaDeChamada(
      [m('lumi', 'Lumi'), m('rafael', 'RAFAEL MEDEIROS')],
      soPresencas
    )
    return soPresencas.length === 1 && certa.length === 2
  })(),
  'se as duas listas tivessem o mesmo tamanho, os casos acima passariam por acaso')

let falhas = 0
for (const [nome, ok, extra] of provas) {
  if (!ok) falhas++
  console.log(`  ${ok ? 'OK   ' : 'FALHA'} | ${nome}`)
  if (extra) console.log(`         ${extra}`)
}
rmSync(pasta, { recursive: true, force: true })
console.log(
  falhas === 0
    ? `\n${provas.length} casos: a chamada é a turma de hoje, não a foto do dia em que o encontro nasceu.`
    : `\n${falhas} FALHA(S) de ${provas.length}`
)
process.exit(falhas === 0 ? 0 : 1)
