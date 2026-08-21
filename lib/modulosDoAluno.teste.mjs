/* ============================================================
   QUEM VÊ O QUÊ, CASO A CASO

   Rodar: node lib/modulosDoAluno.teste.mjs (depois de compilar) — ou pelo
   script em /tmp/ibau que compila na hora.

   Cada caso abaixo é uma pessoa de verdade da escola: a que está no
   Módulo 1, a que repetiu, a que foi transferida e entrou direto no 2, a
   que terminou o 1 e está esperando turma do 2. É onde a regra erra se
   ninguém olhar — e o erro não aparece na tela, aparece no atendimento.
   ============================================================ */
import { modulosDoAluno, aulaParaAbrir } from '/tmp/ibau/modulosDoAluno.js'

const MODULOS = [
  { id: 'm1', nome: 'Módulo 1', ordem: 1 },
  { id: 'm2', nome: 'Módulo 2', ordem: 2 },
  { id: 'm3', nome: 'Módulo 3', ordem: 3 },
]

const resumo = (lista) =>
  lista.map((m) => `${m.nome.replace('Módulo ', 'M')}:${m.estado}${m.atual ? '*' : ''}`).join(' ')

const casos = []
const caso = (nome, executar, esperado) => casos.push({ nome, executar, esperado })

caso(
  'cursando o Modulo 1: abre o 1, fecha os outros dois',
  () => resumo(modulosDoAluno(MODULOS, [{ moduloId: 'm1', situacao: 'cursando' }])),
  'M1:cursando* M2:trancado M3:trancado'
)

caso(
  'o cadeado do Modulo 2 diz de quem depende',
  () =>
    modulosDoAluno(MODULOS, [{ moduloId: 'm1', situacao: 'cursando' }]).find((m) => m.id === 'm2')
      .motivo,
  'Libera quando você for aprovado em "Módulo 1".'
)

caso(
  'aprovado no 1 e ainda sem turma no 2: a bola esta com a secretaria',
  () => {
    const r = modulosDoAluno(MODULOS, [{ moduloId: 'm1', situacao: 'aprovado' }])
    return `${resumo(r)} | ${r.find((m) => m.id === 'm2').motivo}`
  },
  'M1:aprovado* M2:trancado M3:trancado | Você concluiu "Módulo 1". A secretaria vai colocar você numa turma deste módulo.'
)

caso(
  'cursando o 2 depois de aprovado no 1: os dois abertos, o 2 e o atual',
  () =>
    resumo(
      modulosDoAluno(MODULOS, [
        { moduloId: 'm1', situacao: 'aprovado' },
        { moduloId: 'm2', situacao: 'cursando' },
      ])
    ),
  'M1:aprovado M2:cursando* M3:trancado'
)

caso(
  'reprovado no 1: continua com o material, porque vai repetir',
  () => resumo(modulosDoAluno(MODULOS, [{ moduloId: 'm1', situacao: 'reprovado' }])),
  'M1:repetindo* M2:trancado M3:trancado'
)

caso(
  'repetiu e passou: a matricula velha nao apaga a nova',
  () =>
    resumo(
      modulosDoAluno(MODULOS, [
        { moduloId: 'm1', situacao: 'reprovado' },
        { moduloId: 'm1', situacao: 'aprovado' },
      ])
    ),
  'M1:aprovado* M2:trancado M3:trancado'
)

caso(
  'transferido: entrou direto no 2, e o 1 nao promete liberar',
  () => {
    const r = modulosDoAluno(MODULOS, [{ moduloId: 'm2', situacao: 'cursando' }])
    return `${resumo(r)} | ${r.find((m) => m.id === 'm1').motivo}`
  },
  'M1:trancado M2:cursando* M3:trancado | Você não cursou este módulo.'
)

caso(
  'matriculado em dois ao mesmo tempo: o atual e o mais adiantado',
  () =>
    resumo(
      modulosDoAluno(MODULOS, [
        { moduloId: 'm1', situacao: 'cursando' },
        { moduloId: 'm2', situacao: 'cursando' },
      ])
    ),
  'M1:cursando M2:cursando* M3:trancado'
)

caso(
  'curso de um modulo so continua funcionando como antes',
  () =>
    resumo(modulosDoAluno([{ id: 'm1', nome: 'Módulo 1', ordem: 1 }], [
      { moduloId: 'm1', situacao: 'cursando' },
    ])),
  'M1:cursando*'
)

caso(
  'modulos fora de ordem na consulta continuam saindo em ordem',
  () =>
    resumo(
      modulosDoAluno(
        [
          { id: 'm3', nome: 'Módulo 3', ordem: 3 },
          { id: 'm1', nome: 'Módulo 1', ordem: 1 },
          { id: 'm2', nome: 'Módulo 2', ordem: 2 },
        ],
        [{ moduloId: 'm1', situacao: 'cursando' }]
      )
    ),
  'M1:cursando* M2:trancado M3:trancado'
)

/* ---------------- Qual aula abre ---------------- */

const AULAS = [
  { id: 'a1', moduloId: 'm1' },
  { id: 'a2', moduloId: 'm1' },
  { id: 'a3', moduloId: 'm1' },
  { id: 'b1', moduloId: 'm2' },
  { id: 'b2', moduloId: 'm2' },
]

const noModulo1 = () => modulosDoAluno(MODULOS, [{ moduloId: 'm1', situacao: 'cursando' }])

caso(
  'abre a primeira aula que ele ainda nao concluiu',
  () => aulaParaAbrir(AULAS, noModulo1(), (id) => id === 'a1')?.id,
  'a2'
)

caso(
  'concluiu tudo: volta para a primeira, porque agora ele esta revendo',
  () => aulaParaAbrir(AULAS, noModulo1(), () => true)?.id,
  'a1'
)

caso(
  'o endereco com ?aula= de uma aula dele e obedecido',
  () => aulaParaAbrir(AULAS, noModulo1(), () => false, 'a3')?.id,
  'a3'
)

caso(
  'o ?aula= de um modulo TRANCADO nao abre o video',
  () => aulaParaAbrir(AULAS, noModulo1(), () => false, 'b1')?.id,
  'a1'
)

caso(
  'aula sem modulo nenhum nao entra pela porta dos fundos',
  () => aulaParaAbrir([{ id: 'orfa', moduloId: null }, ...AULAS], noModulo1(), () => false, 'orfa')?.id,
  'a1'
)

caso(
  'quem ja passou para o Modulo 2 retoma no 2, e nao no 1',
  () =>
    aulaParaAbrir(
      AULAS,
      modulosDoAluno(MODULOS, [
        { moduloId: 'm1', situacao: 'aprovado' },
        { moduloId: 'm2', situacao: 'cursando' },
      ]),
      () => false
    )?.id,
  'b1'
)

caso(
  'sem nenhum modulo aberto, nao abre aula nenhuma',
  () => aulaParaAbrir(AULAS, modulosDoAluno(MODULOS, []), () => false),
  null
)

let falhas = 0
for (const c of casos) {
  let obtido
  try {
    obtido = c.executar()
  } catch (e) {
    obtido = 'ERRO: ' + e.message
  }
  const ok = JSON.stringify(obtido) === JSON.stringify(c.esperado)
  if (!ok) falhas++
  console.log(`  ${ok ? 'OK   ' : 'FALHA'} | ${c.nome}`)
  if (!ok) {
    console.log('         esperado:', JSON.stringify(c.esperado))
    console.log('         obtido  :', JSON.stringify(obtido))
  }
}
console.log(
  falhas === 0
    ? '\nCada aluno ve o modulo dele, e so ele.'
    : `\n${falhas} FALHA(S)`
)
process.exit(falhas === 0 ? 0 : 1)
