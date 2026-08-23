/* ============================================================
   A CONTA DO DINHEIRO, CASO A CASO

   Rodar: node lib/precos.teste.mjs (depois de compilar).

   Regra de dinheiro errada não dá erro na tela: ela cobra o valor errado
   de alguém e ninguém percebe até a pessoa reclamar. Por isso cada caso
   aqui é um valor de verdade da loja da igreja — livro de R$ 49,90,
   apostila de R$ 25,00 — e não número redondo escolhido para facilitar.
   ============================================================ */
import {
  opcoesDePagamento,
  escolherOpcao,
  repartir,
  reais,
  centavosDoTexto,
} from '/tmp/ibau/precos.js'

const REGRA_BASE = {
  parcelas_sem_juros: 1,
  parcelas_max: 1,
  juros_ao_mes_pct: 0,
  desconto_avista_pct: 0,
  parcela_minima_centavos: 2000,
  aceita_pix: true,
  aceita_boleto: true,
  aceita_cartao: true,
}
const regra = (mudancas) => ({ ...REGRA_BASE, ...mudancas })

const casos = []
const caso = (nome, executar, esperado) => casos.push({ nome, executar, esperado })

/* ---------------- dinheiro em texto ---------------- */

caso('R$ 49,90 vira 4990 centavos', () => centavosDoTexto('49,90'), 4990)
caso('quem digita com ponto tambem e entendido', () => centavosDoTexto('49.90'), 4990)
caso('com o "R$" na frente', () => centavosDoTexto('R$ 49,90'), 4990)
caso('milhar com ponto e decimal com virgula', () => centavosDoTexto('1.234,56'), 123456)
caso('sem centavos', () => centavosDoTexto('40'), 4000)
caso('"49,9" e quarenta e nove e noventa, nao quarenta e nove e nove', () => centavosDoTexto('49,9'), 4990)
caso('campo vazio nao vira zero por engano', () => centavosDoTexto(''), null)
caso('4990 centavos vira "R$ 49,90"', () => reais(4990), 'R$ 49,90')
caso('e o milhar sai com ponto', () => reais(123456), 'R$ 1.234,56')
caso('centavo redondo nao perde o zero', () => reais(4900), 'R$ 49,00')

/* ---------------- repartir sem perder centavo ---------------- */

caso(
  'R$ 100,00 em 3 fecha exatamente em R$ 100,00',
  () => {
    const { parcelaCentavos: p, ultimaParcelaCentavos: u } = repartir(10000, 3)
    return `${p}+${p}+${u} = ${p * 2 + u}`
  },
  '3333+3333+3334 = 10000'
)

caso(
  'R$ 49,90 em 7 tambem fecha',
  () => {
    const { parcelaCentavos: p, ultimaParcelaCentavos: u } = repartir(4990, 7)
    return p * 6 + u
  },
  4990
)

caso(
  'nenhuma divisao de 1 a 24 perde ou inventa centavo',
  () => {
    const valores = [4990, 2500, 10000, 123456, 1, 999, 7777]
    for (const total of valores) {
      for (let n = 1; n <= 24; n++) {
        const { parcelaCentavos: p, ultimaParcelaCentavos: u } = repartir(total, n)
        if (p * (n - 1) + u !== total) return `ERRO em ${total} / ${n}x`
      }
    }
    return 'todas fecham'
  },
  'todas fecham'
)

/* ---------------- desconto à vista ---------------- */

caso(
  'sem desconto, o pix cobra o preco cheio',
  () => opcoesDePagamento(4990, regra({})).find((o) => o.meio === 'pix').totalCentavos,
  4990
)

caso(
  '10% de desconto no pix: R$ 49,90 vira R$ 44,91',
  () => {
    const o = opcoesDePagamento(4990, regra({ desconto_avista_pct: 10 })).find(
      (x) => x.meio === 'pix'
    )
    return `${o.totalCentavos} | desconto ${o.descontoCentavos}`
  },
  '4491 | desconto 499'
)

caso(
  'o desconto aparece escrito para a pessoa',
  () =>
    opcoesDePagamento(4990, regra({ desconto_avista_pct: 10 })).find((x) => x.meio === 'pix')
      .detalhe,
  '10% de desconto à vista (economia de R$ 4,99)'
)

caso(
  'o desconto NAO se acumula com o parcelamento',
  () => {
    const o = opcoesDePagamento(10000, regra({ desconto_avista_pct: 10, parcelas_sem_juros: 3, parcelas_max: 3 })).find(
      (x) => x.parcelas === 3
    )
    return `${o.totalCentavos} | desconto ${o.descontoCentavos}`
  },
  '10000 | desconto 0'
)

/* ---------------- parcelas ---------------- */

caso(
  'regra padrao (1x): cartao aparece so a vista',
  () => opcoesDePagamento(10000, regra({})).filter((o) => o.meio === 'cartao').length,
  1
)

caso(
  '3x sem juros: aparecem 1x, 2x e 3x no cartao',
  () =>
    opcoesDePagamento(10000, regra({ parcelas_sem_juros: 3, parcelas_max: 3 }))
      .filter((o) => o.meio === 'cartao')
      .map((o) => `${o.parcelas}x`)
      .join(' '),
  '1x 2x 3x'
)

caso(
  'e a etiqueta diz "sem juros"',
  () =>
    opcoesDePagamento(10000, regra({ parcelas_sem_juros: 3, parcelas_max: 3 })).find(
      (o) => o.parcelas === 3
    ).rotulo,
  'Cartão — 3x de R$ 33,33 sem juros'
)

caso(
  'a ultima parcela diferente e avisada, nao escondida',
  () =>
    opcoesDePagamento(10000, regra({ parcelas_sem_juros: 3, parcelas_max: 3 })).find(
      (o) => o.parcelas === 3
    ).detalhe,
  'Última parcela de R$ 33,34. Total de R$ 100,00'
)

caso(
  'parcela minima de R$ 20 corta o parcelamento de um livro de R$ 49,90',
  () =>
    opcoesDePagamento(4990, regra({ parcelas_sem_juros: 6, parcelas_max: 6, parcela_minima_centavos: 2000 }))
      .filter((o) => o.meio === 'cartao')
      .map((o) => `${o.parcelas}x`)
      .join(' '),
  '1x 2x'
)

caso(
  'sem juros configurado, nao oferece nada alem do sem juros',
  () =>
    opcoesDePagamento(100000, regra({ parcelas_sem_juros: 3, parcelas_max: 12, juros_ao_mes_pct: 0 }))
      .filter((o) => o.meio === 'cartao')
      .map((o) => `${o.parcelas}x`)
      .join(' '),
  '1x 2x 3x'
)

caso(
  'com juros, a parcela alem do sem juros sai mais cara e o total sobe',
  () => {
    const o = opcoesDePagamento(
      100000,
      regra({ parcelas_sem_juros: 3, parcelas_max: 4, juros_ao_mes_pct: 2 })
    ).find((x) => x.parcelas === 4)
    return `${o.totalCentavos} | juros ${o.jurosCentavos}`
  },
  '108243 | juros 8243'
)

/* ---------------- meios desligados ---------------- */

caso(
  'a escola que so aceita pix ve so pix',
  () =>
    opcoesDePagamento(4990, regra({ aceita_boleto: false, aceita_cartao: false }))
      .map((o) => o.meio)
      .join(' '),
  'pix'
)

caso(
  'sem cartao, parcelamento nem e oferecido',
  () =>
    opcoesDePagamento(10000, regra({ aceita_cartao: false, parcelas_sem_juros: 6, parcelas_max: 6 }))
      .filter((o) => o.parcelas > 1).length,
  0
)

/* ---------------- a conferencia do servidor ---------------- */

caso(
  'o servidor reencontra a opcao que a pessoa escolheu',
  () => {
    const o = escolherOpcao(10000, regra({ parcelas_sem_juros: 3, parcelas_max: 3 }), 'cartao', 3)
    return o.totalCentavos
  },
  10000
)

caso(
  'e RECUSA uma combinacao que a regra nao oferece',
  () => escolherOpcao(10000, regra({ parcelas_sem_juros: 3, parcelas_max: 3 }), 'cartao', 10),
  null
)

caso(
  'recusa tambem o meio desligado',
  () => escolherOpcao(4990, regra({ aceita_boleto: false }), 'boleto', 1),
  null
)

caso(
  'pix parcelado nao existe',
  () => escolherOpcao(10000, regra({ parcelas_sem_juros: 6, parcelas_max: 6 }), 'pix', 3),
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
console.log(falhas === 0 ? '\nA conta fecha, ate o ultimo centavo.' : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
