import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import { PageHeader, Selo } from '@/components/ui'
import AbasTurma from '@/components/Turma/AbasTurma'
import ChamadaManager, {
  type EncontroItem,
  type LinhaPresenca,
} from '@/components/Turma/ChamadaManager'
import Justificativas, { type JustificativaPendente } from '@/components/Turma/Justificativas'
import { listaDeChamada } from '@/lib/nucleo/chamada'
import { exigirDados } from '@/lib/consulta'

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
    .select('id, nome, professor_id, curso_id, modalidade, cursos(titulo, modalidade)')
    .eq('id', id)
    .single()

  if (!turma) notFound()
  if (sessao.role !== 'admin' && turma.professor_id !== sessao.id) {
    redirect('/dashboard/professor')
  }

  /* A MODALIDADE É DA TURMA, não do curso — mudou de dono na migração
     022, e esta tela ficou para trás. O mesmo módulo pode ter uma turma
     presencial e uma EAD; lendo do curso, a turma presencial dentro de
     um curso EAD via a tela errada (frequência automática por vídeo, sem
     lista de chamada) e a coordenação não tinha onde marcar presença.
     O curso continua como queda para as turmas antigas, sem modalidade. */
  const curso = turma.cursos as unknown as { titulo?: string; modalidade?: string } | null
  const presencial =
    (turma.modalidade as string | null) === 'presencial' ||
    ((turma.modalidade as string | null) == null && curso?.modalidade === 'presencial')

  const [{ data: encontros }, { count: totalAtividades }] = await Promise.all([
    supabase
      .from('encontros')
      .select('id, titulo, data, automatico')
      .eq('turma_id', id)
      .order('data', { ascending: false }),
    supabase.from('atividades').select('id', { count: 'exact', head: true }).eq('turma_id', id),
  ])

  const lista = (encontros ?? []) as EncontroItem[]

  /* AS JUSTIFICATIVAS DE TODA A TURMA, DE UMA VEZ.
     Não por encontro: espalhadas por quinze encontros, o professor só
     acharia a justificativa se por acaso abrisse o encontro certo — ou
     seja, quase nunca. Aqui a fila inteira aparece junta. */
  const idsEncontros = lista.map((e) => e.id)
  const { data: justificadas } = idsEncontros.length
    ? await supabase
        .from('presencas')
        .select(
          'id, justificativa, justificativa_status, justificativa_resposta, justificativa_em, encontro_id, users:users!presencas_aluno_id_fkey(name)'
        )
        .in('encontro_id', idsEncontros)
        .not('justificativa', 'is', null)
        .order('justificativa_em', { ascending: true })
    : { data: [] }

  const encontroPorId = new Map(lista.map((e) => [e.id, e]))
  const justificativas: JustificativaPendente[] = (justificadas ?? []).map((j) => {
    const u = j.users as unknown as { name?: string } | null
    const e = encontroPorId.get(j.encontro_id as string)
    return {
      presencaId: j.id as string,
      alunoNome: u?.name ?? 'Aluno',
      encontroTitulo: e?.titulo ?? 'Encontro',
      data: e?.data ?? '',
      texto: j.justificativa as string,
      status: (j.justificativa_status as 'pendente' | 'aceita' | 'recusada') ?? 'pendente',
      resposta: (j.justificativa_resposta as string) ?? null,
    }
  })
  const atual = lista.find((e) => e.id === encontroSelecionado) ?? lista[0] ?? null

  /* A LISTA DE CHAMADA É A TURMA DE HOJE, não a foto do dia em que o
     encontro foi criado.

     Antes esta consulta lia só `presencas`, e as presenças nascem uma
     vez, na criação do encontro. Quem fosse matriculado depois nunca
     aparecia — matriculado no banco, invisível na lista. Era esta a
     queixa: "diz que está matriculado e não aparece na chamada".

     Quem decide o que aparece é `listaDeChamada`, com teste próprio. */
  let linhas: LinhaPresenca[] = []
  if (atual) {
    /* Também por `exigirDados`: era a MESMA armadilha aqui. `presencas`
       tem dois caminhos para a tabela de pessoas (`aluno_id` e
       `justificativa_decidida_por`, da migração 021), e a consulta
       ambígua voltava erro que ninguém conferia — a chamada aparecia
       vazia como se a turma não tivesse ninguém. */
    const [matriculadosR, presencasR] = await Promise.all([
      supabase
        .from('turma_alunos')
        .select('aluno_id, status, users:users!turma_alunos_aluno_id_fkey(name, email)')
        .eq('turma_id', id),
      supabase
        .from('presencas')
        .select('aluno_id, presente, users:users!presencas_aluno_id_fkey(name, email)')
        .eq('encontro_id', atual.id),
    ])

    const matriculados = exigirDados<
      { aluno_id: string; status: string; users: unknown }[]
    >(matriculadosR, 'os alunos desta turma')
    const presencas = exigirDados<
      { aluno_id: string; presente: boolean; users: unknown }[]
    >(presencasR, 'as presenças deste encontro')

    linhas = listaDeChamada(
      (matriculados ?? []).map((m) => {
        const u = m.users as unknown as { name?: string; email?: string } | null
        return {
          alunoId: m.aluno_id as string,
          nome: u?.name ?? '',
          email: u?.email ?? '',
          status: (m.status as string) ?? 'ativo',
        }
      }),
      (presencas ?? []).map((p) => {
        const u = p.users as unknown as { name?: string; email?: string } | null
        return {
          alunoId: p.aluno_id as string,
          presente: Boolean(p.presente),
          nome: u?.name ?? '',
          email: u?.email ?? '',
        }
      })
    ).map((l) => ({
      aluno_id: l.alunoId,
      nome: l.nome,
      email: l.email,
      presente: l.presente,
      semRegistro: l.semRegistro,
      saiu: l.saiu,
    }))
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

      <Justificativas turmaId={id} justificativas={justificativas} />

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
