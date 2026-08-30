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
        'id, numero, titulo, descricao, video_url, video_path, duracao_minutos, publicada, modulo_id, disciplina_id'
      )
      .eq('curso_id', cursoId)
      .order('numero', { ascending: true }),
    supabase
      .from('modulos')
      .select('id, nome, descricao, ordem, video_boas_vindas')
      .eq('curso_id', cursoId)
      .order('ordem', { ascending: true }),
  ])

  /* As matérias, para a pré-visualização mostrar as MESMAS portas que o
     aluno vê. Sem isto o professor conferiria uma tela que não existe
     para ninguém — e a pré-visualização deixaria de servir para o que
     ela serve. */
  const { data: disciplinas } = await supabase
    .from('disciplinas')
    .select('id, nome, ordem, padrao, modulo_id, modulos!disciplinas_modulo_id_fkey!inner(curso_id)')
    .eq('modulos.curso_id', cursoId)
    .order('ordem', { ascending: true })

  if (!curso) return null

  const lista = todas ?? []
  const totalRascunhos = lista.filter((a) => !a.publicada).length
  const aulas = incluirRascunhos ? lista : lista.filter((a) => a.publicada)

  /* A pré-visualização mostra o curso agrupado por módulo, igual ao aluno —
     mas com TODOS os módulos abertos. Ela existe para conferir o material,
     e trancar o conteúdo justamente para quem precisa revisá-lo seria o
     contrário do que ela serve. O que ela precisa reproduzir fielmente é a
     ORDEM e o agrupamento, que é onde um erro de cadastro aparece. */
  const ordemDaDisciplina = new Map<string, number>(
    (disciplinas ?? []).map((d) => [d.id as string, Number(d.ordem)])
  )
  /* Matéria, depois número — a numeração recomeça em cada matéria, e
     ordenar só por número trança as duas uma na outra. */
  const emOrdemDeAula = (x: { disciplina_id?: string | null; numero: number | string },
                         y: { disciplina_id?: string | null; numero: number | string }) => {
    const dx = ordemDaDisciplina.get((x.disciplina_id as string) ?? '') ?? 0
    const dy = ordemDaDisciplina.get((y.disciplina_id as string) ?? '') ?? 0
    return dx !== dy ? dx - dy : Number(x.numero) - Number(y.numero)
  }

  const grupos = (modulos ?? []).map((m) => {
    const doModulo = aulas.filter((a) => a.modulo_id === m.id).sort(emOrdemDeAula)
    return {
      id: m.id as string,
      nome: m.nome as string,
      descricao: (m.descricao as string) ?? null,
      ordem: Number(m.ordem),
      video_boas_vindas: (m.video_boas_vindas as string) ?? null,
      estado: 'cursando' as const,
      aberto: true,
      atual: false,
      disciplinas: (disciplinas ?? [])
        .filter((d) => d.modulo_id === m.id)
        .map((d) => ({
          id: d.id as string,
          nome: d.nome as string,
          ordem: Number(d.ordem),
          padrao: Boolean(d.padrao),
          aulas: doModulo.filter((a) => a.disciplina_id === d.id),
        }))
        .filter((d) => d.aulas.length > 0)
        .sort((a, b) => a.ordem - b.ordem),
      aulas: doModulo,
    }
  })

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
