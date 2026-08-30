import { createClient } from '@/lib/supabase/server'
import { montarBoletim, type BoletimDoAluno } from '@/lib/boletim'

/* ============================================================
   DE ONDE VÊM OS NÚMEROS DO BOLETIM

   Tudo é lido com o cliente de SESSÃO, nunca com a chave administrativa.
   Não é descuido: é o que faz as permissões valerem sem eu precisar
   escrever "se for professor faça isto, se for aluno faça aquilo" em mais
   um lugar. O aluno só enxerga as notas dele porque as regras do banco
   dizem isso; o professor enxerga a turma dele pelo mesmo motivo. Se um
   dia a regra mudar, o boletim acompanha sozinho.

   Se alguém pedir o boletim de uma turma que não é dele, não volta erro
   de permissão: volta vazio. E vazio, aqui, vira "não encontrado".
   ============================================================ */

export interface DadosDoBoletim {
  turma: { id: string; nome: string; curso: string | null; professor: string | null }
  boletins: BoletimDoAluno[]
}

export async function carregarBoletim(
  turmaId: string,
  alunoId?: string
): Promise<DadosDoBoletim | null> {
  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('turmas')
    .select('id, nome, cursos(titulo), professor:users!turmas_professor_id_fkey(name)')
    .eq('id', turmaId)
    .maybeSingle()

  if (!turma) return null

  const curso = turma.cursos as unknown as { titulo?: string } | null
  const prof = turma.professor as unknown as { name?: string } | null

  let alunosQuery = supabase
    .from('turma_alunos')
    .select('aluno_id, status, users:users!turma_alunos_aluno_id_fkey(name)')
    .eq('turma_id', turmaId)
    .eq('status', 'ativo')
  if (alunoId) alunosQuery = alunosQuery.eq('aluno_id', alunoId)

  const { data: matriculas } = await alunosQuery
  if (!matriculas?.length) return null

  const idsAlunos = matriculas.map((m) => m.aluno_id as string)

  const [{ data: avaliacoes }, { data: atividades }, { data: encontros }] = await Promise.all([
    supabase
      .from('avaliacoes')
      .select('id, titulo, tipo, peso, nota_maxima')
      .eq('turma_id', turmaId)
      .order('ordem', { ascending: true }),
    supabase
      .from('atividades')
      .select('id, titulo, nota_maxima, vence_em')
      .eq('turma_id', turmaId)
      .eq('publicada', true)
      .order('vence_em', { ascending: true, nullsFirst: false }),
    supabase.from('encontros').select('id').eq('turma_id', turmaId),
  ])

  const idsAvaliacoes = (avaliacoes ?? []).map((a) => a.id as string)
  const idsAtividades = (atividades ?? []).map((a) => a.id as string)
  const idsEncontros = (encontros ?? []).map((e) => e.id as string)

  const [{ data: notas }, { data: entregas }, { data: presencas }] = await Promise.all([
    idsAvaliacoes.length
      ? supabase
          .from('notas')
          .select('avaliacao_id, aluno_id, valor, observacao')
          .in('avaliacao_id', idsAvaliacoes)
          .in('aluno_id', idsAlunos)
      : Promise.resolve({ data: [] }),
    idsAtividades.length
      ? supabase
          .from('entregas')
          .select('atividade_id, aluno_id, nota, feedback')
          .in('atividade_id', idsAtividades)
          .in('aluno_id', idsAlunos)
      : Promise.resolve({ data: [] }),
    idsEncontros.length
      ? supabase
          .from('presencas')
          .select('encontro_id, aluno_id, presente')
          .in('encontro_id', idsEncontros)
          .in('aluno_id', idsAlunos)
      : Promise.resolve({ data: [] }),
  ])

  const chave = (a: string, b: string) => `${a}|${b}`
  const notaPor = new Map(
    (notas ?? []).map((n) => [
      chave(n.avaliacao_id as string, n.aluno_id as string),
      { valor: n.valor === null ? null : Number(n.valor), observacao: n.observacao as string },
    ])
  )
  const entregaPor = new Map(
    (entregas ?? []).map((e) => [
      chave(e.atividade_id as string, e.aluno_id as string),
      { nota: e.nota === null ? null : Number(e.nota), feedback: e.feedback as string },
    ])
  )
  const presencasPor = new Map<string, number>()
  for (const p of presencas ?? []) {
    if (!p.presente) continue
    const id = p.aluno_id as string
    presencasPor.set(id, (presencasPor.get(id) ?? 0) + 1)
  }

  const boletins = matriculas.map((m) => {
    const id = m.aluno_id as string
    const u = m.users as unknown as { name?: string } | null
    return montarBoletim({
      alunoId: id,
      alunoNome: u?.name ?? '',
      avaliacoes: (avaliacoes ?? []).map((av) => {
        const n = notaPor.get(chave(av.id as string, id))
        return {
          id: av.id as string,
          titulo: av.titulo as string,
          tipo: av.tipo as string,
          peso: Number(av.peso),
          nota_maxima: Number(av.nota_maxima),
          valor: n?.valor ?? null,
          observacao: n?.observacao ?? null,
        }
      }),
      atividades: (atividades ?? []).map((at) => {
        const e = entregaPor.get(chave(at.id as string, id))
        return {
          id: at.id as string,
          titulo: at.titulo as string,
          nota_maxima: Number(at.nota_maxima),
          vence_em: (at.vence_em as string) ?? null,
          entregue: !!e,
          nota: e?.nota ?? null,
          feedback: e?.feedback ?? null,
        }
      }),
      presencas: presencasPor.get(id) ?? 0,
      encontros: idsEncontros.length,
    })
  })

  boletins.sort((a, b) => a.alunoNome.localeCompare(b.alunoNome, 'pt-BR'))

  return {
    turma: {
      id: turma.id as string,
      nome: turma.nome as string,
      curso: curso?.titulo ?? null,
      professor: prof?.name ?? null,
    },
    boletins,
  }
}
