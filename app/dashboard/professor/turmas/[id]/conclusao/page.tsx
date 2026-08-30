import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import { carregarBoletim } from '@/lib/carregarBoletim'
import { PageHeader, Selo, BotaoLink } from '@/components/ui'
import AbasTurma from '@/components/Turma/AbasTurma'
import ConcluirTurma, { type AlunoParaConcluir } from '@/components/Turma/ConcluirTurma'

/**
 * O fechamento do módulo.
 *
 * A média vem da MESMA função que alimenta o boletim (lib/boletim.ts).
 * Não é economia de código: é a única forma de a tela de notas, o boletim
 * impresso e a decisão de aprovação nunca discordarem entre si. Se cada
 * um calculasse do seu jeito, um dia o boletim mostraria 7,1 e a
 * conclusão reprovaria por 6,9 — e não existiria resposta boa para dar ao
 * aluno.
 */
export default async function ConclusaoDaTurmaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sessao = await exigirPermissao('ver_alunos')
  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('turmas')
    .select('id, nome, professor_id, modalidade, modulos(nome, ordem, cursos(titulo))')
    .eq('id', id)
    .single()

  if (!turma) notFound()
  if (sessao.role !== 'admin' && turma.professor_id !== sessao.id) {
    redirect('/dashboard/professor')
  }

  const modulo = turma.modulos as unknown as {
    nome?: string
    ordem?: number
    cursos?: { titulo?: string } | null
  } | null

  const [dados, { data: matriculas }] = await Promise.all([
    carregarBoletim(id),
    supabase
      .from('turma_alunos')
      .select('aluno_id, situacao, media_final, observacao_conclusao, concluida_em, users:users!turma_alunos_aluno_id_fkey(name)')
      .eq('turma_id', id)
      .in('status', ['ativo', 'concluido']),
  ])

  const registroPor = new Map(
    (matriculas ?? []).map((m) => [
      m.aluno_id as string,
      {
        situacao: (m.situacao as AlunoParaConcluir['situacao']) ?? 'cursando',
        mediaFinal: m.media_final === null ? null : Number(m.media_final),
        observacao: (m.observacao_conclusao as string) ?? null,
        concluidaEm: (m.concluida_em as string) ?? null,
        nome: (m.users as unknown as { name?: string } | null)?.name ?? '',
      },
    ])
  )

  /* O boletim traz só quem está `ativo`. Quem já foi fechado como
     aprovado vira `concluido` e sai daquela lista — mas precisa continuar
     aparecendo aqui, senão o professor perde a única porta para reabrir
     um fechamento feito errado. Por isso a lista final é a união das duas. */
  const alunos: AlunoParaConcluir[] = []
  const jaListados = new Set<string>()

  for (const b of dados?.boletins ?? []) {
    const r = registroPor.get(b.alunoId)
    jaListados.add(b.alunoId)
    alunos.push({
      alunoId: b.alunoId,
      nome: b.alunoNome || r?.nome || '',
      mediaCalculada: b.media,
      itensContados: b.itensContados,
      frequencia: b.frequencia,
      situacao: r?.situacao ?? 'cursando',
      mediaFinal: r?.mediaFinal ?? null,
      observacao: r?.observacao ?? null,
      concluidaEm: r?.concluidaEm ?? null,
    })
  }

  for (const [alunoId, r] of registroPor) {
    if (jaListados.has(alunoId)) continue
    alunos.push({
      alunoId,
      nome: r.nome,
      mediaCalculada: r.mediaFinal,
      itensContados: 0,
      frequencia: null,
      situacao: r.situacao,
      mediaFinal: r.mediaFinal,
      observacao: r.observacao,
      concluidaEm: r.concluidaEm,
    })
  }

  alunos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        voltar={{ href: '/dashboard/professor', label: 'Minhas turmas' }}
        titulo="Conclusão do módulo"
        descricao="Feche a turma, registre a situação de cada aluno e libere quem passou para o módulo seguinte."
        selo={
          <>
            <Selo tom="neutro">{turma.nome}</Selo>
            {modulo?.nome && <Selo tom="azul">{modulo.nome}</Selo>}
          </>
        }
      />

      <AbasTurma
        turmaId={id}
        atual="conclusao"
        presencial={turma.modalidade === 'presencial'}
      />

      <div className="mb-5">
        <BotaoLink
          href={`/api/boletim/${id}`}
          target="_blank"
          variante="secundario"
          tamanho="sm"
          icone="Printer"
        >
          Conferir os boletins antes de fechar
        </BotaoLink>
      </div>

      <ConcluirTurma turmaId={id} alunos={alunos} />
    </div>
  )
}
