import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader, Card, EstadoVazio, Selo, Indicador, BotaoLink } from '@/components/ui'

const TIPO_LABEL: Record<string, string> = {
  prova: 'Prova',
  trabalho: 'Trabalho',
  participacao: 'Participação',
  outro: 'Outro',
}

export default async function MinhasNotasPage() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: matriculas } = await supabase
    .from('turma_alunos')
    .select('turma_id, turmas(id, nome, cursos(titulo))')
    .eq('aluno_id', sessao.id)

  const turmas = (matriculas ?? []).map((m) => {
    const t = m.turmas as unknown as {
      id?: string
      nome?: string
      cursos?: { titulo?: string } | null
    } | null
    return { id: t?.id as string, nome: t?.nome ?? '', curso: t?.cursos?.titulo ?? null }
  })

  const ids = turmas.map((t) => t.id).filter(Boolean)

  const [{ data: avaliacoes }, { data: notas }] = await Promise.all([
    ids.length
      ? supabase
          .from('avaliacoes')
          .select('id, turma_id, titulo, tipo, peso, nota_maxima')
          .in('turma_id', ids)
          .order('ordem', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from('notas').select('avaliacao_id, valor').eq('aluno_id', sessao.id),
  ])

  const notaPorAvaliacao = new Map(
    (notas ?? []).map((n) => [n.avaliacao_id, n.valor === null ? null : Number(n.valor)])
  )

  // Média ponderada, normalizando cada avaliação para a escala 0–10
  const mediaDaTurma = (turmaId: string) => {
    const doTurma = (avaliacoes ?? []).filter((a) => a.turma_id === turmaId)
    let soma = 0
    let pesos = 0
    for (const av of doTurma) {
      const v = notaPorAvaliacao.get(av.id)
      if (v === null || v === undefined) continue
      soma += (v / Number(av.nota_maxima)) * 10 * Number(av.peso)
      pesos += Number(av.peso)
    }
    return pesos > 0 ? soma / pesos : null
  }

  const todasComNota = (avaliacoes ?? []).filter(
    (a) => notaPorAvaliacao.get(a.id) !== undefined && notaPorAvaliacao.get(a.id) !== null
  )
  const geral =
    turmas.length > 0
      ? turmas.map((t) => mediaDaTurma(t.id)).filter((m): m is number => m !== null)
      : []
  const mediaGeral = geral.length ? geral.reduce((s, m) => s + m, 0) / geral.length : null

  const tomNota = (v: number) => (v >= 7 ? 'verde' : v >= 5 ? 'ambar' : 'vermelho')

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Minhas notas"
        descricao="Acompanhe seu desempenho em cada avaliação das suas turmas."
      />

      {turmas.length === 0 || (avaliacoes ?? []).length === 0 ? (
        <EstadoVazio
          icone="GraduationCap"
          titulo="Nenhuma nota lançada ainda"
          descricao="Assim que seu professor criar avaliações e lançar as notas, elas aparecem aqui."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador
              icone="TrendingUp"
              valor={mediaGeral === null ? '—' : mediaGeral.toFixed(1)}
              label="Média geral"
            />
            <Indicador icone="ClipboardList" valor={todasComNota.length} label="Notas lançadas" />
            <Indicador icone="GraduationCap" valor={turmas.length} label="Turmas" />
          </div>

          <div className="space-y-5">
            {turmas.map((turma) => {
              const doTurma = (avaliacoes ?? []).filter((a) => a.turma_id === turma.id)
              if (doTurma.length === 0) return null
              const m = mediaDaTurma(turma.id)

              return (
                <Card key={turma.id} padding={false}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
                    <div>
                      <h2 className="font-display text-[15px] font-bold text-gray-900">
                        {turma.nome}
                      </h2>
                      {turma.curso && (
                        <p className="mt-0.5 text-[12.5px] text-gray-500">{turma.curso}</p>
                      )}
                      {/* O aluno também tira o próprio boletim. Antes ele
                          só via os números na tela e não tinha como levar
                          para lugar nenhum — nem para mostrar em casa. */}
                      <div className="mt-2">
                        <BotaoLink
                          href={`/api/boletim/${turma.id}?aluno=${sessao.id}`}
                          target="_blank"
                          variante="fantasma"
                          tamanho="sm"
                          icone="Printer"
                        >
                          Meu boletim (PDF)
                        </BotaoLink>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Média
                      </p>
                      <p
                        className={`font-display text-[22px] font-bold tabular-nums ${
                          m === null
                            ? 'text-gray-300'
                            : m >= 7
                              ? 'text-brand-700'
                              : m >= 5
                                ? 'text-amber-600'
                                : 'text-red-600'
                        }`}
                      >
                        {m === null ? '—' : m.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  <ul className="divide-y divide-gray-100">
                    {doTurma.map((av) => {
                      const v = notaPorAvaliacao.get(av.id)
                      const temNota = v !== undefined && v !== null
                      return (
                        <li key={av.id} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-medium text-gray-800">
                              {av.titulo}
                            </p>
                            <p className="mt-0.5 text-[11.5px] text-gray-500">
                              {TIPO_LABEL[av.tipo]} · peso {Number(av.peso)} · vale até{' '}
                              {Number(av.nota_maxima)}
                            </p>
                          </div>
                          {temNota ? (
                            <Selo tom={tomNota((v / Number(av.nota_maxima)) * 10)}>
                              {Number(v).toFixed(1)} / {Number(av.nota_maxima)}
                            </Selo>
                          ) : (
                            <Selo tom="neutro">aguardando</Selo>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
