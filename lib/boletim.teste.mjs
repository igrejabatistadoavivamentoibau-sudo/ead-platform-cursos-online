/* ============================================================
   A CONTA QUE DECIDE QUEM PASSA

   Rodar: npx tsx lib/boletim.teste.mjs  (ou node, depois de compilar)

   Esta é a única parte da plataforma onde um erro de conta reprova uma
   pessoa. Não dá para conferir "olhando o código": os casos que erram são
   justamente os que ninguém imagina — a atividade não entregue, a prova
   que vale 20, o aluno que entrou no meio do curso.

   Cada caso abaixo é escrito à mão com a resposta calculada à mão.
   ============================================================ */
import { montarBoletim, NOTA_DE_APROVACAO } from './boletim.ts'

const HORA = 3600_000
const agora = 1_700_000_000_000
const passado = new Date(agora - 48 * HORA).toISOString()
const futuro = new Date(agora + 48 * HORA).toISOString()

const casos = []
const caso = (nome, entrada, esperado) => casos.push({ nome, entrada, esperado })

caso(
  'duas provas na escala 0-10, pesos iguais',
  {
    avaliacoes: [
      { id: '1', titulo: 'P1', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 8 },
      { id: '2', titulo: 'P2', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 6 },
    ],
    atividades: [],
  },
  { media: 7, aprovado: true, contados: 2 }
)

caso(
  'prova que vale 20 nao pesa o dobro sozinha',
  {
    // 16/20 = 8 em dez;  5/10 = 5 em dez;  media = 6,5
    avaliacoes: [
      { id: '1', titulo: 'Prova grande', tipo: 'prova', peso: 1, nota_maxima: 20, valor: 16 },
      { id: '2', titulo: 'Prova pequena', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 5 },
    ],
    atividades: [],
  },
  { media: 6.5, aprovado: false, contados: 2 }
)

caso(
  'peso do professor e respeitado',
  {
    // 10*3 + 5*1 = 35 ; pesos 4 ; 8,75 -> 8,8
    avaliacoes: [
      { id: '1', titulo: 'Final', tipo: 'prova', peso: 3, nota_maxima: 10, valor: 10 },
      { id: '2', titulo: 'Participacao', tipo: 'participacao', peso: 1, nota_maxima: 10, valor: 5 },
    ],
    atividades: [],
  },
  { media: 8.8, aprovado: true, contados: 2 }
)

caso(
  'prova sem nota lancada NAO puxa a media para baixo',
  {
    avaliacoes: [
      { id: '1', titulo: 'P1', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 9 },
      { id: '2', titulo: 'P2 ainda nao corrigida', tipo: 'prova', peso: 1, nota_maxima: 10, valor: null },
    ],
    atividades: [],
  },
  { media: 9, aprovado: true, contados: 1 }
)

caso(
  'atividade NAO entregue com prazo vencido vale ZERO',
  {
    // 10 e 0 -> 5
    avaliacoes: [{ id: '1', titulo: 'P1', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 10 }],
    atividades: [
      { id: 'a', titulo: 'Trabalho perdido', nota_maxima: 10, vence_em: passado, entregue: false, nota: null },
    ],
  },
  { media: 5, aprovado: false, contados: 2 }
)

caso(
  'atividade nao entregue com prazo AINDA ABERTO nao conta',
  {
    avaliacoes: [{ id: '1', titulo: 'P1', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 10 }],
    atividades: [
      { id: 'a', titulo: 'Trabalho da semana', nota_maxima: 10, vence_em: futuro, entregue: false, nota: null },
    ],
  },
  { media: 10, aprovado: true, contados: 1 }
)

caso(
  'atividade entregue e ainda nao corrigida nao conta',
  {
    avaliacoes: [{ id: '1', titulo: 'P1', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 6 }],
    atividades: [
      { id: 'a', titulo: 'Entregue ontem', nota_maxima: 10, vence_em: passado, entregue: true, nota: null },
    ],
  },
  { media: 6, aprovado: false, contados: 1 }
)

caso(
  'atividade que vale 5 e normalizada',
  {
    // 4/5 = 8 em dez ; com uma prova 6 -> media 7
    avaliacoes: [{ id: '1', titulo: 'P1', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 6 }],
    atividades: [
      { id: 'a', titulo: 'Resumo', nota_maxima: 5, vence_em: passado, entregue: true, nota: 4 },
    ],
  },
  { media: 7, aprovado: true, contados: 2 }
)

caso(
  'aluno sem nenhuma nota fica pendente, nao reprovado',
  { avaliacoes: [{ id: '1', titulo: 'P1', tipo: 'prova', peso: 1, nota_maxima: 10, valor: null }], atividades: [] },
  { media: null, aprovado: null, contados: 0 }
)

caso(
  'a fronteira: exatamente 7 aprova',
  {
    avaliacoes: [
      { id: '1', titulo: 'P1', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 7 },
    ],
    atividades: [],
  },
  { media: 7, aprovado: true, contados: 1 }
)

caso(
  'a fronteira: 6,9 reprova',
  {
    avaliacoes: [
      { id: '1', titulo: 'P1', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 6.9 },
    ],
    atividades: [],
  },
  { media: 6.9, aprovado: false, contados: 1 }
)

caso(
  'arredondamento a favor: 6,95 vira 7,0 e aprova',
  {
    // 6,9 e 7,0 -> 6,95 -> arredonda para 7,0
    avaliacoes: [
      { id: '1', titulo: 'P1', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 6.9 },
      { id: '2', titulo: 'P2', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 7 },
    ],
    atividades: [],
  },
  { media: 7, aprovado: true, contados: 2 }
)

caso(
  'frequencia sai em porcentagem inteira',
  {
    avaliacoes: [{ id: '1', titulo: 'P1', tipo: 'prova', peso: 1, nota_maxima: 10, valor: 8 }],
    atividades: [],
    presencas: 7,
    encontros: 9,
  },
  { media: 8, aprovado: true, contados: 1, frequencia: 78 }
)

let falhas = 0
console.log(`Nota de aprovacao configurada: ${NOTA_DE_APROVACAO}\n`)
for (const c of casos) {
  const r = montarBoletim({ alunoId: 'x', alunoNome: 'Fulano', agora, ...c.entrada })
  const obtido = {
    media: r.media,
    aprovado: r.aprovado,
    contados: r.itensContados,
    ...(c.esperado.frequencia !== undefined ? { frequencia: r.frequencia } : {}),
  }
  const ok = JSON.stringify(obtido) === JSON.stringify(c.esperado)
  if (!ok) falhas++
  console.log(`  ${ok ? 'OK   ' : 'FALHA'} | ${c.nome}`)
  if (!ok) {
    console.log('         esperado:', JSON.stringify(c.esperado))
    console.log('         obtido  :', JSON.stringify(obtido))
  }
}
console.log(falhas === 0 ? '\nA conta do boletim esta correta.' : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
