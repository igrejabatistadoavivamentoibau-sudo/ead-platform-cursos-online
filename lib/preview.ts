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
  const [{ data: curso }, { data: todas }, { data: modulos }] = await Promise.all([
    supabase.from('cursos').select('*').eq('id', cursoId).single(),
    supabase
      .from('aulas')
      .select(
        'id, numero, titulo, descricao, video_url, video_path, duracao_minutos, publicada, modulo_id'
      )
      .eq('curso_id', cursoId)
      .order('numero', { ascending: true }),
    supabase
      .from('modulos')
      .select('id, nome, descricao, ordem, video_boas_vindas')
      .eq('curso_id', cursoId)
      .order('ordem', { ascending: true }),
  ])

  if (!curso) return null

  const lista = todas ?? []
  const totalRascunhos = lista.filter((a) => !a.publicada).length
  const aulas = incluirRascunhos ? lista : lista.filter((a) => a.publicada)

  /* A pré-visualização mostra o curso agrupado por módulo, igual ao aluno —
     mas com TODOS os módulos abertos. Ela existe para conferir o material,
     e trancar o conteúdo justamente para quem precisa revisá-lo seria o
     contrário do que ela serve. O que ela precisa reproduzir fielmente é a
     ORDEM e o agrupamento, que é onde um erro de cadastro aparece. */
  const grupos = (modulos ?? []).map((m) => ({
    id: m.id as string,
    nome: m.nome as string,
    descricao: (m.descricao as string) ?? null,
    ordem: Number(m.ordem),
    video_boas_vindas: (m.video_boas_vindas as string) ?? null,
    estado: 'cursando' as const,
    aberto: true,
    atual: false,
    aulas: aulas
      .filter((a) => a.modulo_id === m.id)
      .sort((x, y) => Number(x.numero) - Number(y.numero)),
  }))

  // Na ordem em que o aluno veria: módulo, depois número dentro dele.
  const emOrdem = grupos.flatMap((g) => g.aulas)
  const aulaAtual = emOrdem.find((a) => a.id === aulaSelecionada) ?? emOrdem[0] ?? aulas[0] ?? null

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
    aulas: emOrdem.length > 0 ? emOrdem : aulas,
    modulos: grupos,
    aulaAtual,
    totalRascunhos,
    incluirRascunhos,
    paramsAlternar: params.toString(),
  }
}
