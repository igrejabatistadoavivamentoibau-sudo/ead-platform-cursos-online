/* ============================================================
   QUEM AINDA PODE ENTRAR NA TURMA — E O QUE DIZER QUANDO NÃO DÁ

   POR QUE ISTO VIROU UM ARQUIVO PRÓPRIO

   A tela de matrícula quebrou em produção quatorze vezes seguidas, sempre
   com a mesma frase do banco:

       duplicate key value violates unique constraint
       "turma_alunos_turma_id_aluno_id_key"

   O banco estava certo: existe uma trava para ninguém ser matriculado duas
   vezes na mesma turma. Quem estava errado era a tela, que oferecia na
   lista TODOS os alunos ativos — inclusive os que já estavam matriculados
   ali. Como a escola tinha dois alunos e os dois já estavam na turma,
   qualquer clique no botão dava erro.

   O filtro certo existia na tela, calculado e nunca usado: a lista de
   opções recebia a lista errada. É o tipo de defeito que nenhuma leitura
   de código pega, porque as duas variáveis têm nomes parecidos e as duas
   existem.

   Então o filtro saiu da tela e virou função com nome e teste. A tela
   passa a não ter uma segunda lista para escolher por engano.

   NADA AQUI IMPORTA NADA. É o que permite o teste compilar este arquivo
   sozinho e provar cada regra sem subir servidor nenhum.
   ============================================================ */

export interface AlunoDaLista {
  id: string
  name: string
}

export interface JaMatriculado {
  /** O id da MATRÍCULA, que é o que se remove. */
  matriculaId: string
  /** O id do ALUNO, que é o que se compara. */
  id: string
  name: string
  email: string
}

/**
 * Os alunos que ainda cabem nesta turma.
 *
 * A comparação é por `id` do aluno, nunca por nome: dois "Rafael Medeiros"
 * são duas pessoas, e a escola já tem dois cadastros parecidos. Comparar
 * por nome esconderia uma pessoa de verdade da lista.
 */
export function alunosQuePodemEntrar(
  disponiveis: AlunoDaLista[],
  matriculados: { id: string }[]
): AlunoDaLista[] {
  const dentro = new Set(matriculados.map((m) => m.id))
  return disponiveis.filter((a) => !dentro.has(a.id))
}

/**
 * A frase do banco vira a frase da escola.
 *
 * O texto do Postgres é correto e ilegível. Mostrar "duplicate key value
 * violates unique constraint" para a coordenação não informa nada: não diz
 * o que aconteceu nem o que fazer. Pior, some em produção — o Next apaga a
 * mensagem de exceção — e vira um parágrafo em inglês sobre React.
 *
 * Aqui a mensagem é traduzida ANTES de sair do servidor, e devolvida como
 * dado. Dado atravessa.
 */
export function traduzirErroDeMatricula(
  mensagem: string,
  padrao = 'Não consegui matricular. Tente de novo.'
): string {
  const m = (mensagem ?? '').toLowerCase()

  if (m.includes('turma_alunos_turma_id_aluno_id_key') || m.includes('duplicate key')) {
    return 'Esse aluno já está matriculado nesta turma.'
  }
  if (m.includes('violates foreign key') && m.includes('turma')) {
    return 'Essa turma não existe mais. Atualize a tela.'
  }
  if (m.includes('violates foreign key')) {
    return 'Esse aluno não existe mais. Atualize a tela.'
  }
  if (m.includes('violates row-level security') || m.includes('permission denied')) {
    return 'Você não tem permissão para matricular nesta turma.'
  }
  if (m.includes('jwt') || m.includes('expired')) {
    return 'Sua sessão expirou. Entre de novo e tente outra vez.'
  }

  return mensagem?.trim() ? mensagem : padrao
}
