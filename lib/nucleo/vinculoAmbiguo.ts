/* ============================================================
   O VÍNCULO AMBÍGUO — A ARMADILHA QUE JÁ QUEBROU TRÊS TELAS

   O QUE ACONTECE

   Quando uma tabela tem DOIS caminhos para outra, pedir o vínculo sem
   dizer qual faz o servidor recusar a consulta INTEIRA:

       .select('id, aluno_id, users(name)')     <- ambíguo, recusado
       .select('id, aluno_id, users:users!turma_alunos_aluno_id_fkey(name)')

   E o modo de falhar é o pior possível: quem chama faz
   `const { data } = await ...`, o `error` é jogado fora, `data` volta
   nulo, e a tela mostra **uma lista vazia**. Não há erro na tela, não há
   nada no console do navegador. O sistema diz "não tem ninguém" quando
   na verdade está quebrado.

   O HISTÓRICO NESTE PROJETO, que é o motivo deste arquivo existir:

   1. `entregas → users` ficou ambíguo quando a migração 020 criou
      `corrigida_por`. A caixa "esperando correção" do professor passou a
      aparecer VAZIA com entregas esperando.
   2. `turma_alunos → users` ficou ambíguo quando a migração 022 criou
      `concluida_por`. A tela da turma passou a dizer "Alunos matriculados
      (0)" — e, no clique, "esse aluno já está matriculado nesta turma".
      A mesma tela afirmando as duas coisas.
   3. `presencas → users` ficou ambíguo quando a migração 021 criou
      `justificativa_decidida_por`. O aluno matriculado não aparecia na
      lista de chamada.

   Em todos os três, a coluna nova não tinha nada a ver com a consulta
   quebrada. É por isso que releitura de código não pega: quem escreve
   `concluida_por` numa migração não está olhando para a tela da turma.

   ESTA LISTA É TIRADA DO BANCO DE VERDADE, não escrita de memória.
   Para atualizá-la, rode a consulta que está no comentário abaixo e
   substitua o conteúdo. O teste `vinculoAmbiguo.teste.mjs` varre o
   projeto inteiro e acusa qualquer consulta que peça um destes vínculos
   sem dizer o caminho.

       select c.conrelid::regclass::text as pai,
              c.confrelid::regclass::text as filho,
              array_agg(c.conname order by c.conname) as nomes
         from pg_constraint c
         join pg_class r on r.oid = c.conrelid
         join pg_namespace n on n.oid = r.relnamespace
        where c.contype = 'f' and n.nspname = 'public'
        group by 1, 2
       having count(*) > 1;

   NADA AQUI IMPORTA NADA — é o que deixa o teste compilar este arquivo
   sozinho.
   ============================================================ */

export interface ParAmbiguo {
  /** A tabela do `.from(...)`. */
  pai: string
  /** A tabela pedida como vínculo dentro do `select`. */
  filho: string
  /** Os caminhos possíveis — um deles tem de ser escolhido no select. */
  caminhos: string[]
}

/** Levantado do banco de produção em 30/08/2026. */
export const PARES_AMBIGUOS: ParAmbiguo[] = [
  { pai: 'cobrancas', filho: 'users', caminhos: ['cobrancas_aluno_id_fkey', 'cobrancas_registrada_por_fkey'] },
  { pai: 'entregas', filho: 'users', caminhos: ['entregas_aluno_id_fkey', 'entregas_corrigida_por_fkey'] },
  { pai: 'liberacoes_de_aula', filho: 'users', caminhos: ['liberacoes_de_aula_aluno_id_fkey', 'liberacoes_de_aula_decidida_por_fkey'] },
  { pai: 'notas', filho: 'users', caminhos: ['notas_aluno_id_fkey', 'notas_lancada_por_fkey'] },
  { pai: 'pedidos', filho: 'users', caminhos: ['pedidos_comprador_id_fkey', 'pedidos_retirado_por_fkey'] },
  { pai: 'presencas', filho: 'users', caminhos: ['presencas_aluno_id_fkey', 'presencas_justificativa_decidida_por_fkey'] },
  { pai: 'turma_alunos', filho: 'users', caminhos: ['turma_alunos_aluno_id_fkey', 'turma_alunos_concluida_por_fkey'] },
]

export interface ConsultaLida {
  /** A tabela do `.from('...')`. */
  tabela: string
  /** O conteúdo do `.select('...')`. */
  select: string
  /** Linha onde ela começa, para a mensagem do teste. */
  linha: number
}

/**
 * Acha os `.from('x')...select('...')` de um arquivo.
 *
 * Deliberadamente simples: só reconhece o `select` que vem DEPOIS do
 * `from`, na mesma cadeia, com a string escrita à mão. É o que 100% das
 * consultas deste projeto fazem, e uma leitura simples que acerta tudo
 * vale mais do que uma leitura esperta que erra em silêncio.
 */
export function lerConsultas(codigo: string): ConsultaLida[] {
  const achadas: ConsultaLida[] = []
  const from = /\.from\(\s*['"]([a-z_]+)['"]\s*\)/g
  let m: RegExpExecArray | null

  while ((m = from.exec(codigo)) !== null) {
    const tabela = m[1]
    /* A partir daqui, o primeiro `.select(` até o próximo `.from(`. */
    const resto = codigo.slice(m.index + m[0].length)
    const ateOProximoFrom = resto.split(/\.from\(\s*['"]/)[0]
    const sel = ateOProximoFrom.match(/\.select\(\s*(['"`])([\s\S]*?)\1/)
    if (!sel) continue
    achadas.push({
      tabela,
      select: sel[2],
      linha: codigo.slice(0, m.index).split('\n').length,
    })
  }
  return achadas
}

export interface Acusacao {
  tabela: string
  vinculo: string
  linha: number
  caminhos: string[]
}

/**
 * As consultas que pedem um vínculo ambíguo sem escolher o caminho.
 *
 * O que conta como "escolheu": `filho!nome_da_fk(` em qualquer forma —
 * com apelido (`users:users!fk(`) ou sem (`users!fk(`).
 */
export function acusarAmbiguos(
  consultas: ConsultaLida[],
  pares: ParAmbiguo[] = PARES_AMBIGUOS
): Acusacao[] {
  const acusadas: Acusacao[] = []

  for (const c of consultas) {
    for (const par of pares) {
      if (par.pai !== c.tabela) continue

      /* Procura o filho sendo aberto como vínculo: "users(" ou "users!x(".
         O `(?<![:!\w])` evita casar o "users" que é só o apelido em
         "users:users!fk(" — ali quem abre o vínculo é o segundo. */
      const pedido = new RegExp(`(?<![:!\\w])${par.filho}(\\s*!\\s*[a-z_]+)?\\s*\\(`, 'g')
      let achou: RegExpExecArray | null
      while ((achou = pedido.exec(c.select)) !== null) {
        if (achou[1]) continue // escolheu o caminho
        acusadas.push({
          tabela: c.tabela,
          vinculo: par.filho,
          linha: c.linha,
          caminhos: par.caminhos,
        })
      }
    }
  }
  return acusadas
}
