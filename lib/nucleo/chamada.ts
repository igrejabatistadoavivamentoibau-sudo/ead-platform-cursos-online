/* ============================================================
   QUEM APARECE NA LISTA DE CHAMADA

   O DEFEITO QUE ISTO CONSERTA

   A lista era montada a partir da tabela de `presencas`. E as presenças
   são criadas UMA VEZ, no instante em que o encontro nasce: a plataforma
   copia quem estava matriculado naquele momento e pronto.

   Consequência, nas palavras da coordenação: *"diz que está matriculado
   e não aparece ele nas listas de chamada"*. Ela matriculava o aluno
   depois de o encontro existir, o aluno entrava de verdade no banco, e
   a chamada continuava com a foto antiga. Não havia erro em lugar
   nenhum — só uma pessoa faltando numa lista.

   É o mesmo tipo de defeito da matrícula (`lib/nucleo/matricula.ts`): a
   tela lia a lista errada, e as duas listas existem. Por isso esta regra
   também saiu da tela e virou função com nome e teste.

   A LISTA É A TURMA, e a presença é só a marca que já foi feita nela.

   QUEM JÁ TEM MARCA MAS SAIU DA TURMA CONTINUA APARECENDO, sinalizado.
   Um aluno transferido em maio esteve presente nos encontros de março; se
   ele sumisse da lista, o encontro de março passaria a mostrar menos gente
   do que havia na sala — apagar registro de frequência é pior do que
   mostrar uma linha a mais com a explicação do lado.

   NADA AQUI IMPORTA NADA — é o que deixa o teste compilar este arquivo
   sozinho e provar cada caso sem subir servidor nenhum.
   ============================================================ */

export interface MatriculadoNaTurma {
  alunoId: string
  nome: string
  email: string
  /** `turma_alunos.status`: só 'ativo' entra na chamada de hoje. */
  status: string
}

export interface PresencaGravada {
  alunoId: string
  presente: boolean
  nome?: string
  email?: string
}

export interface LinhaDeChamada {
  alunoId: string
  nome: string
  email: string
  presente: boolean
  /** Ainda não há marca nenhuma para esta pessoa neste encontro. */
  semRegistro: boolean
  /** Tem marca, mas não está mais ativo na turma. */
  saiu: boolean
}

export function listaDeChamada(
  matriculados: MatriculadoNaTurma[],
  presencas: PresencaGravada[]
): LinhaDeChamada[] {
  const marca = new Map(presencas.map((p) => [p.alunoId, p]))
  const linhas: LinhaDeChamada[] = []
  const jaPosto = new Set<string>()

  for (const m of matriculados) {
    if (m.status !== 'ativo') continue
    const p = marca.get(m.alunoId)
    jaPosto.add(m.alunoId)
    linhas.push({
      alunoId: m.alunoId,
      nome: m.nome,
      email: m.email,
      /* Sem marca ainda, a pessoa entra como AUSENTE — nunca como
         presente. Chamada que nasce toda marcada é chamada que ninguém
         faz: bastaria salvar sem olhar para a turma inteira constar. */
      presente: p ? p.presente : false,
      semRegistro: !p,
      saiu: false,
    })
  }

  for (const p of presencas) {
    if (jaPosto.has(p.alunoId)) continue
    linhas.push({
      alunoId: p.alunoId,
      nome: p.nome ?? '',
      email: p.email ?? '',
      presente: p.presente,
      semRegistro: false,
      saiu: true,
    })
  }

  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Quantos ainda não têm marca — a frase que a tela mostra ao professor. */
export function quantosSemRegistro(linhas: LinhaDeChamada[]): number {
  return linhas.filter((l) => l.semRegistro).length
}
