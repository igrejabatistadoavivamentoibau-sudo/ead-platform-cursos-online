import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import { PageHeader, Selo, EstadoVazio } from '@/components/ui'
import AbasTurma from '@/components/Turma/AbasTurma'
import AulasDaTurma, {
  type AulaDaTurma,
  type PedidoDeLiberacao,
} from '@/components/Turma/AulasDaTurma'

/**
 * As aulas do curso, vistas de dentro de UMA turma.
 *
 * Esta rota existia como um desvio para "Avanço", de quando as aulas
 * deixaram de pertencer à turma e passaram a pertencer ao curso. Agora ela
 * tem conteúdo próprio, e é conteúdo que só faz sentido aqui: a data em
 * que cada aula abre e fecha é da TURMA, não da aula. A turma de março e a
 * de agosto veem a mesma aula em épocas diferentes.
 */
export default async function AulasDaTurmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessao = await exigirPermissao('ver_alunos')
  const supabase = await createClient()

  const { data: turma } = await supabase
    .from('turmas')
    .select('id, nome, curso_id, modulo_id, modalidade, professor_id, modulos!turmas_modulo_id_fkey(nome, ordem)')
    .eq('id', id)
    .single()

  if (!turma) notFound()
  if (sessao.role !== 'admin' && turma.professor_id !== sessao.id) {
    redirect('/dashboard/professor')
  }

  /* A modalidade é da TURMA, e não do curso. Enquanto vinha do curso, uma
     turma presencial dentro de um curso marcado como EAD recebia presença
     automática por vídeo assistido — a frequência daquela sala saía errada
     e ninguém via. */
  const presencial = turma.modalidade === 'presencial'
  const modulo = turma.modulos as unknown as { nome?: string; ordem?: number } | null

  if (!turma.curso_id && !turma.modulo_id) {
    return (
      <div className="p-5 sm:p-8">
        <PageHeader
          voltar={{ href: '/dashboard/professor', label: 'Minhas turmas' }}
          titulo="Aulas da turma"
          selo={<Selo tom="neutro">{turma.nome}</Selo>}
        />
        <AbasTurma turmaId={id} atual="aulas" presencial={presencial} />
        <EstadoVazio
          icone="BookOpenText"
          titulo="Esta turma ainda não está ligada a um módulo"
          descricao="As aulas vêm do módulo do curso. Peça à coordenação para ligar esta turma a um curso-módulo — é o que traz o conteúdo para cá."
        />
      </div>
    )
  }

  const [{ data: aulas }, { data: pedidos }] = await Promise.all([
    /* AS AULAS DO MÓDULO DESTA TURMA — não do curso inteiro.
       Buscar por curso trazia as aulas de TODOS os módulos misturadas numa
       fila só: a turma de primeiro módulo via, na mesma lista, as aulas do
       segundo e do terceiro, e a numeração recomeça a cada módulo, então
       apareciam duas "Aula 1" seguidas. Turma antiga, ainda sem módulo,
       continua caindo no curso inteiro — é tudo o que se sabe dela. */
    (turma.modulo_id
      ? supabase.from('aulas').select('id, numero, titulo').eq('modulo_id', turma.modulo_id)
      : supabase.from('aulas').select('id, numero, titulo').eq('curso_id', turma.curso_id)
    )
      .eq('publicada', true)
      .order('numero', { ascending: true }),
    supabase
      .from('liberacoes_de_aula')
      .select(
        'id, aula_id, motivo, status, resposta, libera_ate, created_at, users:users!liberacoes_de_aula_aluno_id_fkey(name), aulas(titulo)'
      )
      .eq('turma_id', id)
      .order('created_at', { ascending: true }),
  ])

  const idsAulas = (aulas ?? []).map((a) => a.id as string)

  /* Três leituras a mais, feitas de uma vez para a lista inteira: a janela
     de cada aula nesta turma, quem já concluiu, e quem é desta turma.
     Aula por aula seriam 3 × N idas ao banco só para desenhar uma lista de
     vinte linhas. */
  const [{ data: janelas }, { data: progresso }, { data: matriculas }] = await Promise.all([
    idsAulas.length
      ? supabase
          .from('aula_turma')
          .select('aula_id, abre_em, vence_em')
          .eq('turma_id', id)
          .in('aula_id', idsAulas)
      : Promise.resolve({ data: [] }),
    idsAulas.length
      ? supabase
          .from('aula_progresso')
          .select('aula_id, aluno_id')
          .in('aula_id', idsAulas)
          .eq('concluida', true)
      : Promise.resolve({ data: [] }),
    supabase.from('turma_alunos').select('aluno_id').eq('turma_id', id).eq('status', 'ativo'),
  ])

  const daTurma = new Set((matriculas ?? []).map((m) => m.aluno_id as string))
  const janelaPor = new Map(
    (janelas ?? []).map((j) => [
      j.aula_id as string,
      { abre_em: (j.abre_em as string) ?? null, vence_em: (j.vence_em as string) ?? null },
    ])
  )
  const concluidasPor = new Map<string, number>()
  for (const p of progresso ?? []) {
    // O progresso vem de todos os alunos do curso; aqui só contam os desta
    // turma, senão o número falaria de gente que não é da turma.
    if (!daTurma.has(p.aluno_id as string)) continue
    const k = p.aula_id as string
    concluidasPor.set(k, (concluidasPor.get(k) ?? 0) + 1)
  }

  const lista: AulaDaTurma[] = (aulas ?? []).map((a) => ({
    id: a.id as string,
    numero: Number(a.numero),
    titulo: a.titulo as string,
    abre_em: janelaPor.get(a.id as string)?.abre_em ?? null,
    vence_em: janelaPor.get(a.id as string)?.vence_em ?? null,
    concluidas: concluidasPor.get(a.id as string) ?? 0,
  }))

  const listaPedidos: PedidoDeLiberacao[] = (pedidos ?? []).map((p) => {
    const u = p.users as unknown as { name?: string } | null
    const au = p.aulas as unknown as { titulo?: string } | null
    return {
      id: p.id as string,
      aulaId: p.aula_id as string,
      aulaTitulo: au?.titulo ?? 'Aula',
      alunoNome: u?.name ?? 'Aluno',
      motivo: p.motivo as string,
      status: p.status as 'pendente' | 'liberada' | 'recusada',
      resposta: (p.resposta as string) ?? null,
      liberaAte: (p.libera_ate as string) ?? null,
      criadoEm: p.created_at as string,
    }
  })

  const pendentes = listaPedidos.filter((p) => p.status === 'pendente').length

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        voltar={{ href: '/dashboard/professor', label: 'Minhas turmas' }}
        titulo="Aulas da turma"
        descricao={
          modulo?.nome
            ? `Estas são as aulas de ${modulo.ordem}. ${modulo.nome} — o módulo desta turma. Marque quando cada uma abre e fecha, e responda a quem pediu liberação.`
            : 'Marque quando cada aula abre e fecha para esta turma, e responda a quem pediu liberação.'
        }
        selo={<Selo tom="neutro">{turma.nome}</Selo>}
      />

      <AbasTurma
        turmaId={id}
        atual="aulas"
        presencial={presencial}
        contadores={{ pedidos: pendentes || undefined }}
      />

      <AulasDaTurma turmaId={id} aulas={lista} pedidos={listaPedidos} />
    </div>
  )
}
