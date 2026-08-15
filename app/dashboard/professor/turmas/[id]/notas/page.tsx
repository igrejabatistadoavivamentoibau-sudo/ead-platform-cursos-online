import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import { PageHeader, Selo } from '@/components/ui'
import AbasTurma from '@/components/Turma/AbasTurma'
import NotasManager, { type Avaliacao, type AlunoNota } from '@/components/Turma/NotasManager'

export default async function NotasDaTurmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessao = await exigirPermissao('ver_alunos')
  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('turmas')
    .select('id, nome, professor_id, cursos(titulo, modalidade)')
    .eq('id', id)
    .single()

  if (!turma) notFound()
  if (sessao.role !== 'admin' && turma.professor_id !== sessao.id) {
    redirect('/dashboard/professor')
  }

  const curso = turma.cursos as unknown as { modalidade?: string } | null
  const presencial = curso?.modalidade === 'presencial'

  const [{ data: avaliacoes }, { data: matriculas }, { count: totalAtividades }] =
    await Promise.all([
      supabase
        .from('avaliacoes')
        .select('id, titulo, tipo, peso, nota_maxima, data')
        .eq('turma_id', id)
        .order('ordem', { ascending: true }),
      supabase
        .from('turma_alunos')
        .select('aluno_id, users(id, name, email)')
        .eq('turma_id', id)
        .eq('status', 'ativo'),
      supabase.from('atividades').select('id', { count: 'exact', head: true }).eq('turma_id', id),
    ])

  const alunos: AlunoNota[] = (matriculas ?? [])
    .map((m) => {
      const u = m.users as unknown as { id?: string; name?: string; email?: string } | null
      return { id: u?.id as string, nome: u?.name ?? '', email: u?.email ?? '' }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const idsAvaliacoes = (avaliacoes ?? []).map((a) => a.id)
  const { data: notasBanco } = idsAvaliacoes.length
    ? await supabase.from('notas').select('avaliacao_id, aluno_id, valor').in('avaliacao_id', idsAvaliacoes)
    : { data: [] }

  const notas: Record<string, number | null> = {}
  for (const n of notasBanco ?? []) {
    notas[`${n.aluno_id}|${n.avaliacao_id}`] = n.valor === null ? null : Number(n.valor)
  }

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        voltar={{ href: '/dashboard/professor', label: 'Minhas turmas' }}
        titulo="Notas da turma"
        descricao="Crie avaliações com peso e lance as notas. A média é calculada automaticamente."
        selo={<Selo tom="neutro">{turma.nome}</Selo>}
      />

      <AbasTurma
        turmaId={id}
        atual="notas"
        presencial={presencial}
        contadores={{ atividades: totalAtividades ?? 0 }}
      />

      <NotasManager
        turmaId={id}
        avaliacoes={(avaliacoes ?? []) as Avaliacao[]}
        alunos={alunos}
        notas={notas}
      />
    </div>
  )
}
