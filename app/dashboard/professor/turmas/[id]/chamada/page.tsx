import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import { PageHeader, Selo } from '@/components/ui'
import AbasTurma from '@/components/Turma/AbasTurma'
import ChamadaManager, {
  type EncontroItem,
  type LinhaPresenca,
} from '@/components/Turma/ChamadaManager'

export default async function ChamadaDaTurmaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ encontro?: string }>
}) {
  const { id } = await params
  const { encontro: encontroSelecionado } = await searchParams
  const sessao = await exigirPermissao('fazer_chamada')
  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('turmas')
    .select('id, nome, professor_id, curso_id, cursos(titulo, modalidade)')
    .eq('id', id)
    .single()

  if (!turma) notFound()
  if (sessao.role !== 'admin' && turma.professor_id !== sessao.id) {
    redirect('/dashboard/professor')
  }

  const curso = turma.cursos as unknown as { titulo?: string; modalidade?: string } | null
  const presencial = curso?.modalidade === 'presencial'

  const [{ data: encontros }, { count: totalAtividades }] = await Promise.all([
    supabase
      .from('encontros')
      .select('id, titulo, data, automatico')
      .eq('turma_id', id)
      .order('data', { ascending: false }),
    supabase.from('atividades').select('id', { count: 'exact', head: true }).eq('turma_id', id),
  ])

  const lista = (encontros ?? []) as EncontroItem[]
  const atual = lista.find((e) => e.id === encontroSelecionado) ?? lista[0] ?? null

  let linhas: LinhaPresenca[] = []
  if (atual) {
    const { data: presencas } = await supabase
      .from('presencas')
      .select('aluno_id, presente, users(name, email)')
      .eq('encontro_id', atual.id)

    linhas = (presencas ?? [])
      .map((p) => {
        const u = p.users as unknown as { name?: string; email?: string } | null
        return {
          aluno_id: p.aluno_id as string,
          nome: u?.name ?? '',
          email: u?.email ?? '',
          presente: p.presente as boolean,
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        voltar={{ href: '/dashboard/professor', label: 'Minhas turmas' }}
        titulo={presencial ? 'Lista de chamada' : 'Frequência da turma'}
        descricao={
          presencial
            ? 'Marque a presença em sala e exporte em PDF timbrado ou planilha.'
            : 'A presença é registrada automaticamente quando o aluno conclui cada vídeo aula.'
        }
        selo={
          <div className="flex flex-wrap items-center gap-2">
            <Selo tom="neutro">{turma.nome}</Selo>
            <Selo tom={presencial ? 'ambar' : 'azul'} icone={presencial ? 'Users' : 'Monitor'}>
              {presencial ? 'Presencial' : 'EAD'}
            </Selo>
          </div>
        }
      />

      <AbasTurma
        turmaId={id}
        atual="chamada"
        presencial={presencial}
        contadores={{ atividades: totalAtividades ?? 0 }}
      />

      <ChamadaManager
        turmaId={id}
        presencial={presencial}
        encontros={lista}
        encontroAtual={atual}
        linhas={linhas}
      />
    </div>
  )
}
