import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirPermissao } from '@/lib/auth'
import { PageHeader, Selo } from '@/components/ui'
import AbasTurma from '@/components/Turma/AbasTurma'
import AtividadesManager, {
  type AtividadeItem,
  type EntregaItem,
  type AnexoEntrega,
} from '@/components/Turma/AtividadesManager'

export default async function AtividadesDaTurmaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sessao = await exigirPermissao('ver_alunos')
  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('turmas')
    .select('id, nome, professor_id, cursos(modalidade)')
    .eq('id', id)
    .single()

  if (!turma) notFound()
  if (sessao.role !== 'admin' && turma.professor_id !== sessao.id) {
    redirect('/dashboard/professor')
  }

  const curso = turma.cursos as unknown as { modalidade?: string } | null
  const presencial = curso?.modalidade === 'presencial'

  const [{ data: atividades }, { count: totalAlunos }] = await Promise.all([
    supabase
      .from('atividades')
      .select(
        'id, titulo, descricao, aviso, abre_em, vence_em, nota_maxima, criada_por, criada:users!atividades_criada_por_fkey(name)'
      )
      .eq('turma_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('turma_alunos')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', id)
      .eq('status', 'ativo'),
  ])

  const lista: AtividadeItem[] = (atividades ?? []).map((a) => {
    const autor = a.criada as unknown as { name?: string } | null
    return {
      id: a.id as string,
      titulo: a.titulo as string,
      descricao: (a.descricao as string) ?? null,
      aviso: (a.aviso as string) ?? null,
      abre_em: (a.abre_em as string) ?? null,
      vence_em: (a.vence_em as string) ?? null,
      nota_maxima: Number(a.nota_maxima),
      criada_por: (a.criada_por as string) ?? null,
      criada_por_nome: autor?.name ?? null,
    }
  })

  const ids = lista.map((a) => a.id)
  const { data: entregasBanco } = ids.length
    ? await supabase
        .from('entregas')
        .select(
          'id, atividade_id, aluno_id, texto, entregue_em, nota, feedback, users:users!entregas_aluno_id_fkey(name)'
        )
        .in('atividade_id', ids)
    : { data: [] }

  const idsDeEntrega = (entregasBanco ?? []).map((e) => e.id as string)
  const { data: anexosBanco } = idsDeEntrega.length
    ? await supabase
        .from('entrega_arquivos')
        .select('id, entrega_id, path, nome, tipo')
        .in('entrega_id', idsDeEntrega)
        .order('enviado_em')
    : { data: [] }

  /* O bucket de entregas é privado. O link temporário é gerado com o
     cliente administrativo, que passa por cima das regras do bucket — é
     assim que o professor consegue abrir o arquivo de um aluno sem que a
     regra do bucket precise ser frouxa para todo mundo.

     Os links são gerados em paralelo: numa turma com 30 alunos e 3 fotos
     cada, um de cada vez seriam 90 idas em fila e a página demoraria. */
  const admin = createAdminClient()
  const anexos = await Promise.all(
    (anexosBanco ?? []).map(async (a) => {
      const { data } = await admin.storage
        .from('entregas')
        .createSignedUrl(a.path as string, 60 * 60)
      return {
        entrega_id: a.entrega_id as string,
        id: a.id as string,
        nome: a.nome as string,
        tipo: a.tipo as string,
        url: data?.signedUrl ?? null,
      }
    })
  )

  const anexosPorEntrega = new Map<string, AnexoEntrega[]>()
  for (const a of anexos) {
    const atual = anexosPorEntrega.get(a.entrega_id) ?? []
    atual.push({ id: a.id, nome: a.nome, tipo: a.tipo, url: a.url })
    anexosPorEntrega.set(a.entrega_id, atual)
  }

  const entregas: EntregaItem[] = (entregasBanco ?? []).map((e) => {
    const u = e.users as unknown as { name?: string } | null
    return {
      id: e.id as string,
      atividade_id: e.atividade_id as string,
      aluno_id: e.aluno_id as string,
      aluno_nome: u?.name ?? '',
      texto: (e.texto as string) ?? null,
      entregue_em: e.entregue_em as string,
      nota: e.nota === null ? null : Number(e.nota),
      feedback: (e.feedback as string) ?? null,
      anexos: anexosPorEntrega.get(e.id as string) ?? [],
    }
  })

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        voltar={{ href: '/dashboard/professor', label: 'Minhas turmas' }}
        titulo="Atividades da turma"
        descricao="Defina trabalhos complementares, receba as entregas dos alunos e corrija por aqui."
        selo={<Selo tom="neutro">{turma.nome}</Selo>}
      />

      <AbasTurma
        turmaId={id}
        atual="atividades"
        presencial={presencial}
        contadores={{ atividades: lista.length }}
      />

      <AtividadesManager
        turmaId={id}
        atividades={lista}
        entregas={entregas}
        totalAlunos={totalAlunos ?? 0}
        usuarioId={sessao.id}
        ehAdmin={sessao.role === 'admin'}
      />
    </div>
  )
}
