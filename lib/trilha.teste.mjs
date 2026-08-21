/* ============================================================
   A LÓGICA DO BOTÃO VOLTAR, CONFERIDA CASO A CASO

   Rodar: node lib/trilha.teste.mjs (depois de compilar) — ou pelo script
   em /tmp/ibau que faz a compilação na hora.

   Não dá para "olhar o código e ver que está certo": os casos que erram
   são justamente os que ninguém imagina — a pessoa que volta duas vezes,
   a que aperta F5 no meio, a que chegou por um link de fora. Cada um
   deles está escrito abaixo com a resposta esperada.
   ============================================================ */
import { registrarPasso, passoAnterior, lerTrilha } from '/tmp/ibau/trilha.js'

/* sessionStorage de mentira: o teste roda fora do navegador. */
const memoria = new Map()
globalThis.sessionStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, v),
  removeItem: (k) => memoria.delete(k),
}

const zerar = () => memoria.clear()
const caminhos = () => lerTrilha().map((x) => x.p)

const casos = []
const caso = (nome, executar, esperado) => casos.push({ nome, executar, esperado })

caso(
  'primeira tela: nao ha para onde voltar',
  () => {
    registrarPasso('/dashboard/professor', 'Minhas turmas')
    return passoAnterior()?.p ?? null
  },
  null
)

caso(
  'duas telas: volta para a primeira, com o nome dela',
  () => {
    registrarPasso('/dashboard/professor', 'Minhas turmas')
    registrarPasso('/dashboard/professor/turmas/1/notas', 'Notas da turma')
    const a = passoAnterior()
    return `${a?.p} | ${a?.t}`
  },
  '/dashboard/professor | Minhas turmas'
)

caso(
  'tres telas: volta para a do meio, nao para o inicio',
  () => {
    registrarPasso('/dashboard/professor', 'Minhas turmas')
    registrarPasso('/dashboard/professor/turmas/1/notas', 'Notas')
    registrarPasso('/dashboard/professor/turmas/1/atividades', 'Atividades')
    return passoAnterior()?.p ?? null
  },
  '/dashboard/professor/turmas/1/notas'
)

caso(
  'F5 na mesma tela nao empilha nada',
  () => {
    registrarPasso('/dashboard/professor', 'Minhas turmas')
    registrarPasso('/dashboard/professor/turmas/1/notas', 'Notas')
    registrarPasso('/dashboard/professor/turmas/1/notas', 'Notas')
    registrarPasso('/dashboard/professor/turmas/1/notas', 'Notas')
    return caminhos().join(' > ')
  },
  '/dashboard/professor > /dashboard/professor/turmas/1/notas'
)

caso(
  'ao VOLTAR, a trilha encolhe em vez de crescer',
  () => {
    registrarPasso('/a', 'A')
    registrarPasso('/b', 'B')
    registrarPasso('/c', 'C')
    registrarPasso('/b', 'B') // clicou em voltar
    return caminhos().join(' > ')
  },
  '/a > /b'
)

caso(
  'voltar duas vezes NAO fica preso indo e vindo',
  () => {
    registrarPasso('/a', 'A')
    registrarPasso('/b', 'B')
    registrarPasso('/c', 'C')
    registrarPasso('/b', 'B') // voltar
    registrarPasso('/a', 'A') // voltar de novo
    return `${caminhos().join(' > ')} | anterior: ${passoAnterior()?.p ?? 'nenhum'}`
  },
  '/a | anterior: nenhum'
)

caso(
  'ir para uma tela NOVA depois de voltar empilha normalmente',
  () => {
    registrarPasso('/a', 'A')
    registrarPasso('/b', 'B')
    registrarPasso('/a', 'A') // voltou
    registrarPasso('/c', 'C') // foi para outro lugar
    return `${caminhos().join(' > ')} | anterior: ${passoAnterior()?.p}`
  },
  '/a > /c | anterior: /a'
)

caso(
  'o titulo chega depois e atualiza o passo, sem duplicar',
  () => {
    registrarPasso('/a', undefined)
    registrarPasso('/a', 'Titulo que chegou depois')
    return `${caminhos().length} | ${lerTrilha()[0].t}`
  },
  '1 | Titulo que chegou depois'
)

caso(
  'tela sem cabecalho NAO abre buraco na trilha',
  () => {
    /* O layout do painel registra toda tela, tenha ela cabeçalho ou não.
       Sem isso a do meio ficaria de fora, e o "voltar" da última diria o
       nome da PRIMEIRA enquanto o navegador voltaria para a do meio —
       promete um lugar, entrega outro. */
    registrarPasso('/dashboard/admin/cursos', 'Todos os cursos')
    registrarPasso('/dashboard/admin/permissoes') // sem título: sem cabeçalho
    registrarPasso('/dashboard/admin/cursos/9', 'Escola de Líderes')
    const a = passoAnterior()
    return `${a?.p} | ${a?.t ?? 'sem nome'}`
  },
  '/dashboard/admin/permissoes | sem nome'
)

caso(
  'a trilha nao cresce sem limite',
  () => {
    for (let i = 0; i < 40; i++) registrarPasso(`/tela-${i}`, `T${i}`)
    return lerTrilha().length
  },
  12
)

caso(
  'caminho estranho na trilha nao vira salto para fora',
  () => {
    memoria.set('ibau:trilha', JSON.stringify([{ p: 'https://outro-site.com' }, { p: '/agora' }]))
    return passoAnterior()
  },
  null
)

let falhas = 0
for (const c of casos) {
  zerar()
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
console.log(falhas === 0 ? '\nO botao voltar volta para o lugar certo.' : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
