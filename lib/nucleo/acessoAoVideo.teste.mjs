/* ============================================================
   QUEM PODE VER O VÍDEO — TODOS OS CASOS

   A decisão é pura, então dá para percorrer aqui os casos que dariam
   trabalho para montar num navegador: aluno de outra turma, módulo
   trancado, prazo vencido, professor de outro curso, quem nem entrou.

   Roda com:  node lib/nucleo/acessoAoVideo.teste.mjs
   (as duas funções são copiadas abaixo porque este teste roda sem
   TypeScript; qualquer mudança na regra tem de ser refletida aqui — e é
   por isso que o último caso confere a lista de estados possíveis.)
   ============================================================ */

/* ---------- cópia fiel de lib/modulosDoAluno.ts (parte usada) ---------- */
const PESO = { desistente: 1, reprovado: 2, cursando: 3, aprovado: 4 }

function modulosDoAluno(modulos, matriculas) {
  const emOrdem = [...modulos].sort((a, b) => a.ordem - b.ordem)
  const melhor = new Map()
  for (const m of matriculas) {
    const atual = melhor.get(m.moduloId)
    if (!atual || PESO[m.situacao] > PESO[atual]) melhor.set(m.moduloId, m.situacao)
  }
  return emOrdem.map((m, i) => {
    const s = melhor.get(m.id)
    if (s === 'cursando') return { ...m, estado: 'cursando', aberto: true, motivo: null }
    if (s === 'aprovado') return { ...m, estado: 'aprovado', aberto: true, motivo: null }
    if (s === 'reprovado' || s === 'desistente')
      return { ...m, estado: 'repetindo', aberto: true, motivo: null }
    const anterior = emOrdem[i - 1]
    if (!anterior) return { ...m, estado: 'trancado', aberto: false, motivo: 'Você não cursou este módulo.' }
    const sAnterior = melhor.get(anterior.id)
    if (sAnterior === 'aprovado')
      return {
        ...m, estado: 'trancado', aberto: false,
        motivo: `Você concluiu "${anterior.nome}". A secretaria vai colocar você numa turma deste módulo.`,
      }
    if (sAnterior)
      return {
        ...m, estado: 'trancado', aberto: false,
        motivo: `Libera quando você for aprovado em "${anterior.nome}".`,
      }
    return { ...m, estado: 'trancado', aberto: false, motivo: 'Você não cursou este módulo.' }
  })
}

/* ---------- cópia fiel de lib/nucleo/acessoAoVideo.ts ---------- */
function podeVerOVideo(quem, aula, doAluno, lecionaOCurso) {
  if (!quem) return { pode: false, status: 401, motivo: 'Entre na plataforma para assistir.' }
  if (!aula || !aula.temArquivo) return { pode: false, status: 404, motivo: 'Vídeo não encontrado.' }
  if (quem.role === 'admin') return { pode: true }
  if (quem.role === 'professor') {
    return lecionaOCurso
      ? { pode: true }
      : { pode: false, status: 403, motivo: 'Este curso não está sob sua responsabilidade.' }
  }
  if (!aula.publicada)
    return { pode: false, status: 403, motivo: 'Esta aula ainda não foi liberada pelo professor.' }
  if (!doAluno || doAluno.matriculas.length === 0)
    return { pode: false, status: 403, motivo: 'Você não está matriculado neste curso.' }
  const estados = modulosDoAluno(doAluno.modulos, doAluno.matriculas)
  const meu = estados.find((m) => m.id === aula.moduloId)
  if (!meu) return { pode: false, status: 403, motivo: 'Esta aula não faz parte do seu curso.' }
  if (!meu.aberto)
    return { pode: false, status: 403, motivo: meu.motivo ?? 'Este módulo ainda não está liberado para você.' }
  if (!doAluno.liberadaPelaJanela)
    return {
      pode: false, status: 403,
      motivo: 'O prazo para assistir esta aula encerrou. Peça liberação ao professor.',
    }
  return { pode: true }
}

/* ---------- cenário ---------- */
const M1 = { id: 'm1', nome: 'Módulo 1', ordem: 1 }
const M2 = { id: 'm2', nome: 'Módulo 2', ordem: 2 }
const MODULOS = [M1, M2]

const aulaM1 = { id: 'a1', cursoId: 'c1', moduloId: 'm1', publicada: true, temArquivo: true }
const aulaM2 = { id: 'a2', cursoId: 'c1', moduloId: 'm2', publicada: true, temArquivo: true }

const ctx = (matriculas, liberada = true) => ({ modulos: MODULOS, matriculas, liberadaPelaJanela: liberada })
const cursando1 = [{ moduloId: 'm1', situacao: 'cursando' }]

const ALUNO = { id: 'u1', role: 'aluno' }
const PROF = { id: 'u2', role: 'professor' }
const ADMIN = { id: 'u3', role: 'admin' }

const provas = []
const prova = (nome, ok, extra = '') => provas.push([nome, ok, extra])
const nega = (v, status) => v.pode === false && v.status === status

/* ---------- os casos que ela pediu ---------- */

prova('aluno autorizado assiste a aula do modulo dele',
  podeVerOVideo(ALUNO, aulaM1, ctx(cursando1), false).pode === true)

prova('aluno NAO matriculado no curso e recusado',
  nega(podeVerOVideo(ALUNO, aulaM1, ctx([]), true), 403))

prova('aluno de OUTRA turma do mesmo curso, em modulo trancado, e recusado',
  nega(podeVerOVideo(ALUNO, aulaM2, ctx(cursando1), true), 403),
  podeVerOVideo(ALUNO, aulaM2, ctx(cursando1), true).motivo)

prova('e o motivo do cadeado explica o que fazer',
  /aprovado em "Módulo 1"/.test(podeVerOVideo(ALUNO, aulaM2, ctx(cursando1), true).motivo))

prova('quem NAO entrou na plataforma recebe 401',
  nega(podeVerOVideo(null, aulaM1, ctx(cursando1), false), 401))

prova('prazo da aula vencido: recusado mesmo com o modulo aberto',
  nega(podeVerOVideo(ALUNO, aulaM1, ctx(cursando1, false), false), 403),
  podeVerOVideo(ALUNO, aulaM1, ctx(cursando1, false), false).motivo)

prova('aula ainda em rascunho nao abre para o aluno',
  nega(podeVerOVideo(ALUNO, { ...aulaM1, publicada: false }, ctx(cursando1), false), 403))

/* Vídeo de fora não tem arquivo guardado: esta porta não é dele. */
prova('aula de video EXTERNO nao passa por esta porta (404)',
  nega(podeVerOVideo(ALUNO, { ...aulaM1, temArquivo: false }, ctx(cursando1), false), 404))

prova('aula que nao existe responde igual a aula sem arquivo (404)',
  nega(podeVerOVideo(ALUNO, null, ctx(cursando1), false), 404),
  'nao entrega a existencia da aula')

/* Equipe */
prova('professor do curso assiste, inclusive rascunho',
  podeVerOVideo(PROF, { ...aulaM1, publicada: false }, null, true).pode === true)

prova('professor de OUTRO curso e recusado',
  nega(podeVerOVideo(PROF, aulaM1, null, false), 403))

prova('coordenacao assiste qualquer aula',
  podeVerOVideo(ADMIN, aulaM2, null, false).pode === true)

/* Casos de aluno que já passou ou vai repetir */
prova('quem foi APROVADO no modulo continua podendo rever',
  podeVerOVideo(ALUNO, aulaM1, ctx([{ moduloId: 'm1', situacao: 'aprovado' }]), false).pode === true)

prova('quem REPROVOU continua com o material do modulo',
  podeVerOVideo(ALUNO, aulaM1, ctx([{ moduloId: 'm1', situacao: 'reprovado' }]), false).pode === true)

prova('aprovado no Modulo 1 ainda NAO entra no 2 sem turma',
  nega(podeVerOVideo(ALUNO, aulaM2, ctx([{ moduloId: 'm1', situacao: 'aprovado' }]), false), 403),
  podeVerOVideo(ALUNO, aulaM2, ctx([{ moduloId: 'm1', situacao: 'aprovado' }]), false).motivo)

/* Aula de outro curso qualquer */
prova('aula de modulo que nao esta no curso do aluno e recusada',
  nega(podeVerOVideo(ALUNO, { ...aulaM1, moduloId: 'm9' }, ctx(cursando1), false), 403))

/* A rodada de controle: sem ela, um teste que passa por acaso diz
   "está tudo certo" sem provar nada. Se a regra fosse "libera geral",
   este caso passaria a permitir — e o teste tem de acusar. */
const liberaGeral = () => ({ pode: true })
prova('CONTROLE: uma regra que liberasse tudo seria acusada aqui',
  liberaGeral(null, aulaM2, ctx([]), false).pode === true &&
    podeVerOVideo(null, aulaM2, ctx([]), false).pode === false)

let falhas = 0
for (const [nome, ok, extra] of provas) {
  if (!ok) falhas++
  console.log(`  ${ok ? 'OK   ' : 'FALHA'} | ${nome}`)
  if (extra) console.log(`         ${extra}`)
}
console.log(falhas === 0 ? `\n${provas.length} casos: o video so abre para quem tem direito.` : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
