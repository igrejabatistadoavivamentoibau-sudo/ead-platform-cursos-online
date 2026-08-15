import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Carrega os dados da pré-visualização de um curso.
 *
 * Compartilhado entre a rota do admin e a do professor para as duas se
 * comportarem de forma idêntica. Por padrão traz só as aulas publicadas —
 * ou seja, exatamente o que o aluno vê. Com `incluirRascunhos`, traz também
 * as não publicadas, marcadas, para conferir o material antes de liberar.
 */
export async function montarPreview(
  supabase: SupabaseClient,
  cursoId: string,
  aulaSelecionada: string | undefined,
  incluirRascunhos: boolean
) {
  const [{ data: curso }, { data: todas }] = await Promise.all([
    supabase.from('cursos').select('*').eq('id', cursoId).single(),
    supabase
      .from('aulas')
      .select('id, numero, titulo, descricao, video_url, video_path, duracao_minutos, publicada')
      .eq('curso_id', cursoId)
      .order('numero', { ascending: true }),
  ])

  if (!curso) return null

  const lista = todas ?? []
  const totalRascunhos = lista.filter((a) => !a.publicada).length
  const aulas = incluirRascunhos ? lista : lista.filter((a) => a.publicada)
  const aulaAtual = aulas.find((a) => a.id === aulaSelecionada) ?? aulas[0] ?? null

  // Link que inverte o estado do botão de rascunhos.
  // Só mantemos a aula aberta se ela ainda vai existir na próxima listagem —
  // ao desligar os rascunhos, uma aula não publicada deixaria de existir e o
  // link levaria a uma aula inexistente.
  const proximoIncluir = !incluirRascunhos
  const params = new URLSearchParams()
  if (aulaAtual && (proximoIncluir || aulaAtual.publicada)) {
    params.set('aula', aulaAtual.id)
  }
  if (proximoIncluir) params.set('rascunhos', '1')

  return {
    curso,
    aulas,
    aulaAtual,
    totalRascunhos,
    incluirRascunhos,
    paramsAlternar: params.toString(),
  }
}
