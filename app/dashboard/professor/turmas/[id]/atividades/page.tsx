import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirPermissao } from '@/lib/auth'
import { PageHeader, Selo } from '@/components/ui'
import AbasTurma from '@/components/Turma/AbasTurma'
import AtividadesManager, {
  type AtividadeItem,
  type EntregaItem,
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
      .select('id, titulo, descricao, prazo, nota_maxima')
      .eq('turma_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('turma_alunos')
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', id)
      .eq('status', 'ativo'),
  ])

  const ids = (atividades ?? []).map((a) => a.id)
  const { data: entregasBanco } = ids.length
    ? await supabase
        .from('entregas')
        .select('id, atividade_id, aluno_id, texto, arquivo_path, arquivo_nome, entregue_em, nota, feedback, users(name)')
        .in('atividade_id', ids)
    : { data: [] }

  // O bucket de entregas é privado: geramos um link temporário por arquivo
  const admin = createAdminClient()
  const entregas: EntregaItem[] = await Promise.all(
    (entregasBanco ?? []).map(async (e) => {
      const u = e.users as unknown as { name?: string } | null
      let url: string | null = null
      if (e.arquivo_path) {
        const { data } = await admin.storage
          .from('entregas')
          .createSignedUrl(e.arquivo_path as string, 60 * 60)
        url = data?.signedUrl ?? null
      }
      return {
        id: e.id as string,
        atividade_id: e.atividade_id as string,
        aluno_id: e.aluno_id as string,
        aluno_nome: u?.name ?? '',
        texto: (e.texto as string) ?? null,
        arquivo_nome: (e.arquivo_nome as string) ?? null,
        arquivo_url: url,
        entregue_em: e.entregue_em as string,
        nota: e.nota === null ? null : Number(e.nota),
        feedback: (e.feedback as string) ?? null,
      }
    })
  )

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
        contadores={{ atividades: atividades?.length ?? 0 }}
      />

      <AtividadesManager
        turmaId={id}
        atividades={(atividades ?? []) as AtividadeItem[]}
        entregas={entregas}
        totalAlunos={totalAlunos ?? 0}
      />
    </div>
  )
}
