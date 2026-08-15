import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader, EstadoVazio, Indicador } from '@/components/ui'
import EntregaAtividade, { type AtividadeAluno } from '@/components/Aluno/EntregaAtividade'

export default async function MinhasAtividadesPage() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: matriculas } = await supabase
    .from('turma_alunos')
    .select('turma_id, turmas(id, nome)')
    .eq('aluno_id', sessao.id)

  const nomeDaTurma = new Map<string, string>()
  for (const m of matriculas ?? []) {
    const t = m.turmas as unknown as { id?: string; nome?: string } | null
    if (t?.id) nomeDaTurma.set(t.id, t.nome ?? '')
  }

  const ids = [...nomeDaTurma.keys()]

  const [{ data: atividades }, { data: entregas }] = await Promise.all([
    ids.length
      ? supabase
          .from('atividades')
          .select('id, turma_id, titulo, descricao, prazo, nota_maxima')
          .in('turma_id', ids)
          .eq('publicada', true)
          .order('prazo', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from('entregas')
      .select('atividade_id, texto, arquivo_nome, nota, feedback, entregue_em')
      .eq('aluno_id', sessao.id),
  ])

  const entregaPorAtividade = new Map(
    (entregas ?? []).map((e) => [
      e.atividade_id,
      {
        texto: (e.texto as string) ?? null,
        arquivo_nome: (e.arquivo_nome as string) ?? null,
        nota: e.nota === null ? null : Number(e.nota),
        feedback: (e.feedback as string) ?? null,
        entregue_em: e.entregue_em as string,
      },
    ])
  )

  const lista: AtividadeAluno[] = (atividades ?? []).map((a) => ({
    id: a.id as string,
    titulo: a.titulo as string,
    descricao: (a.descricao as string) ?? null,
    prazo: (a.prazo as string) ?? null,
    nota_maxima: Number(a.nota_maxima),
    turma: nomeDaTurma.get(a.turma_id as string) ?? '',
    entrega: entregaPorAtividade.get(a.id as string) ?? null,
  }))

  const entregues = lista.filter((a) => a.entrega).length
  const corrigidas = lista.filter((a) => a.entrega?.nota !== null && a.entrega?.nota !== undefined).length
  const pendentes = lista.length - entregues

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Minhas atividades"
        descricao="Trabalhos complementares definidos pelos seus professores. Entregue por aqui."
      />

      {lista.length === 0 ? (
        <EstadoVazio
          icone="FileText"
          titulo="Nenhuma atividade por enquanto"
          descricao="Quando seu professor publicar um trabalho, ele aparece aqui com o prazo de entrega."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <Indicador icone="Clock" valor={pendentes} label="A entregar" />
            <Indicador icone="Upload" valor={entregues} label="Entregues" />
            <Indicador icone="Check" valor={corrigidas} label="Corrigidas" />
          </div>

          <div className="space-y-3">
            {lista.map((a) => (
              <EntregaAtividade key={a.id} atividade={a} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
