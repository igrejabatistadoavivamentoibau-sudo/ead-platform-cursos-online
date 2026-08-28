/* ============================================================
   A VOZ DA LUMI — TODOS OS CASOS

   Roda com:  node lib/nucleo/recadoDaLumi.teste.mjs

   Compila e importa o arquivo DE VERDADE (mesmo padrão de
   recuperacaoDeSenha.teste.mjs) — nada de cópia colada que envelhece.
   ============================================================ */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = resolve(aqui, '..', '..')
const pasta = mkdtempSync(join(tmpdir(), 'ibau-lumi-'))
try {
  execFileSync(
    process.execPath,
    [
      join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'),
      join(aqui, 'recadoDaLumi.ts'),
      '--outDir', pasta,
      '--target', 'es2020',
      '--module', 'esnext',
      '--moduleResolution', 'bundler',
      '--skipLibCheck',
    ],
    { stdio: 'pipe' }
  )
} catch (e) {
  console.error('Falhou ao compilar:\n' + (e.stdout?.toString() || e.message))
  process.exit(1)
}
writeFileSync(join(pasta, 'package.json'), '{"type":"module"}')
const R = await import(pathToFileURL(join(pasta, 'recadoDaLumi.js')).href)

const provas = []
const prova = (nome, ok, extra = '') => provas.push([nome, ok, extra])

const aviso = (tipo, extra = {}) => ({
  id: 'id-' + tipo,
  titulo: 'titulo guardado',
  corpo: 'detalhe guardado',
  tipo,
  link: '/dashboard/aluno/x',
  created_at: '2026-08-27T10:00:00Z',
  ...extra,
})

/* ================= AS QUATRO FRASES PEDIDAS ================= */

const esperadas = [
  ['aula', 'Uma nova aula foi liberada para você.', 'Assistir'],
  ['atividade', 'Você possui uma nova atividade.', 'Ver atividade'],
  ['nota', 'Sua nota foi lançada.', 'Ver nota'],
  ['prazo', 'Você tem uma atividade próxima do prazo.', 'Entregar agora'],
]

for (const [tipo, frase, acao] of esperadas) {
  const r = R.recadoDaLumi(aviso(tipo), 'aluno')
  prova(`${tipo}: a frase é exatamente a pedida`, r?.mensagem === frase, r?.mensagem)
  prova(`${tipo}: tem título, ação e link`,
    !!r?.titulo && r?.acao === acao && r?.link === '/dashboard/aluno/x',
    `${r?.titulo} · ${r?.acao} · ${r?.link}`)
}

prova('todo recado tem os quatro campos que ela pediu',
  ['aula', 'atividade', 'nota', 'prazo', 'pedido', 'aviso_turma'].every((t) => {
    const r = R.recadoDaLumi(aviso(t), 'aluno')
    return r && r.titulo && r.mensagem && r.acao && 'link' in r
  }))

prova('a ação é sempre um verbo, nunca um "OK"',
  ['aula', 'atividade', 'nota', 'prazo', 'pedido', 'aviso_turma']
    .map((t) => R.recadoDaLumi(aviso(t), 'aluno').acao)
    .every((a) => !/^(ok|fechar|entendi)$/i.test(a)))

/* ================= O QUE ELA NÃO ANUNCIA ================= */

prova('novidade NÃO vira recado — já é a saudação do dia',
  R.recadoDaLumi(aviso('novidade'), 'aluno') === null)

prova('atualizacao NÃO vira recado — já é a pastilha de nova versão',
  R.recadoDaLumi(aviso('atualizacao'), 'aluno') === null)

prova('recado escrito à mão (geral) fica só no sino',
  R.recadoDaLumi(aviso('geral'), 'aluno') === null)

prova('inscricao fica só no sino',
  R.recadoDaLumi(aviso('inscricao'), 'aluno') === null)

prova('tipo desconhecido não quebra nada, só não é anunciado',
  R.recadoDaLumi(aviso('coisa_nova_do_futuro'), 'aluno') === null)

/* ================= O MESMO FATO, DUAS PESSOAS ================= */

prova('pedido pago fala com o ALUNO sobre o pedido dele',
  R.recadoDaLumi(aviso('pedido'), 'aluno').mensagem === 'O pagamento do seu pedido foi confirmado.')

prova('pedido pago fala com a COORDENAÇÃO sobre separar',
  (() => {
    const r = R.recadoDaLumi(aviso('pedido'), 'admin')
    return /esperando separação/.test(r.mensagem) && r.acao === 'Ver pedidos'
  })(),
  R.recadoDaLumi(aviso('pedido'), 'admin').mensagem)

prova('e as duas frases NÃO são a mesma',
  R.recadoDaLumi(aviso('pedido'), 'aluno').mensagem !==
    R.recadoDaLumi(aviso('pedido'), 'admin').mensagem)

/* ================= O DETALHE ================= */

prova('o detalhe específico vem junto com a frase genérica',
  R.recadoDaLumi(aviso('aula', { corpo: 'Aula 1 — "O chamado do líder" (Módulo Um).' }), 'aluno')
    .detalhe === 'Aula 1 — "O chamado do líder" (Módulo Um).')

prova('detalhe comprido é cortado em palavra inteira, com reticências',
  (() => {
    const longo = 'Esta é uma descrição muito comprida que jamais caberia no canto da tela sem virar um parágrafo inteiro atrapalhando a aula'
    const d = R.recadoDaLumi(aviso('aula', { corpo: longo }), 'aluno').detalhe
    return d.length <= 100 && d.endsWith('…') && !d.slice(0, -1).endsWith(' ') &&
      longo.startsWith(d.slice(0, -1))
  })(),
  R.recadoDaLumi(aviso('aula', { corpo: 'x'.repeat(200) }), 'aluno').detalhe.slice(0, 40) + '...')

prova('aviso sem corpo não inventa detalhe',
  R.recadoDaLumi(aviso('nota', { corpo: null }), 'aluno').detalhe === null)

prova('aviso sem link continua valendo (o botão é que some)',
  R.recadoDaLumi(aviso('nota', { link: null }), 'aluno').link === null)

/* ================= UM DE CADA VEZ ================= */

const fila = [aviso('aula', { id: 'a' }), aviso('nota', { id: 'b' }), aviso('prazo', { id: 'c' })]

prova('mostra UM recado, e diz quantos sobraram',
  (() => {
    const r = R.proximoRecado(fila, 'aluno')
    return r.recado.id === 'a' && r.restantes === 2
  })())

prova('o já mostrado não volta: o próximo é o seguinte da fila',
  (() => {
    const r = R.proximoRecado(fila, 'aluno', ['a'])
    return r.recado.id === 'b' && r.restantes === 1
  })())

prova('quando todos já foram mostrados, a LUMI fica quieta',
  (() => {
    const r = R.proximoRecado(fila, 'aluno', ['a', 'b', 'c'])
    return r.recado === null && r.restantes === 0
  })())

prova('avisos que não são da LUMI não entram na conta de "restantes"',
  (() => {
    const r = R.proximoRecado(
      [aviso('aula', { id: 'a' }), aviso('novidade', { id: 'n' }), aviso('geral', { id: 'g' })],
      'aluno'
    )
    return r.recado.id === 'a' && r.restantes === 0
  })(),
  'senão a LUMI diria "+2 avisos" e mostraria zero ao clicar')

prova('lista vazia não quebra',
  R.proximoRecado([], 'aluno').recado === null)

/* ================= CONTROLE ================= */

prova('CONTROLE: uma regra que anunciasse tudo seria acusada aqui',
  (() => {
    const anunciaTudo = () => ({ titulo: 'x', mensagem: 'x', acao: 'x', link: null })
    return anunciaTudo(aviso('novidade')).titulo === 'x' &&
      R.recadoDaLumi(aviso('novidade'), 'aluno') === null
  })())

prova('CONTROLE: uma fila que ignorasse o "já mostrado" repetiria para sempre',
  (() => {
    const semMemoria = (l) => l[0]
    return semMemoria(fila).id === 'a' && R.proximoRecado(fila, 'aluno', ['a']).recado.id === 'b'
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
    ? `\n${provas.length} casos: a LUMI fala o que precisa, uma vez, e não repete o que já disse.`
    : `\n${falhas} FALHA(S) de ${provas.length}`
)
process.exit(falhas === 0 ? 0 : 1)
