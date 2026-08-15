import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Por que este arquivo existe.
 *
 * Todas as telas faziam `const { data } = await supabase...` e ignoravam o
 * `error`. Quando a consulta falhava — por permissão, por relacionamento
 * ambíguo, por coluna inexistente — `data` voltava nulo e a tela mostrava
 * "Nenhum registro ainda". Ou seja: o sistema dizia que estava vazio quando
 * na verdade estava quebrado, e o defeito ficava invisível.
 *
 * `exigirDados` transforma esse silêncio em erro visível. É melhor a tela
 * mostrar uma mensagem clara do que mentir que não há nada.
 */
export function exigirDados<T>(
  resultado: { data: T | null; error: PostgrestError | null },
  ondeFoi: string
): T {
  if (resultado.error) {
    throw new Error(`Falha ao carregar ${ondeFoi}: ${resultado.error.message}`)
  }
  return (resultado.data ?? []) as T
}

/**
 * Monta um índice id -> nome a partir da tabela de pessoas.
 *
 * Existe para substituir os joins embutidos (ex.: `turmas(..., users(name))`).
 * Entre `turmas` e `users` há dois caminhos possíveis — o professor da turma
 * e os alunos matriculados via `turma_alunos` — e a API não sabe qual usar,
 * devolvendo erro em vez de dados. Buscar os nomes em uma consulta separada
 * é imune a esse tipo de ambiguidade e continua sendo uma única ida ao banco.
 */
export function indicePorId<T extends { id: string }>(lista: T[] | null): Map<string, T> {
  const mapa = new Map<string, T>()
  for (const item of lista ?? []) mapa.set(item.id, item)
  return mapa
}
