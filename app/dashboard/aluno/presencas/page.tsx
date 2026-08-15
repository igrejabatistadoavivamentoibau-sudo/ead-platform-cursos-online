import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import { PageHeader, Card, EstadoVazio, Selo, Indicador, Progresso } from '@/components/ui'

function formatarData(d: string) {
  const [a, m, dia] = d.split('-')
  return `${dia}/${m}/${a}`
}

export default async function MinhasPresencasPage() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: presencas } = await supabase
    .from('presencas')
    .select('presente, observacao, encontros(id, titulo, data, automatico, turma_id, turmas(nome))')
    .eq('aluno_id', sessao.id)

  const linhas = (presencas ?? [])
    .map((p) => {
      const e = p.encontros as unknown as {
        id?: string
        titulo?: string
        data?: string
        automatico?: boolean
        turma_id?: string
        turmas?: { nome?: string } | null
      } | null
      return {
        id: e?.id ?? '',
        titulo: e?.titulo ?? 'Encontro',
        data: e?.data ?? '',
        automatico: e?.automatico ?? false,
        turma: e?.turmas?.nome ?? '',
        presente: p.presente as boolean,
      }
    })
    .filter((l) => l.data)
    .sort((a, b) => b.data.localeCompare(a.data))

  const total = linhas.length
  const presentes = linhas.filter((l) => l.presente).length
  const frequencia = total > 0 ? Math.round((presentes / total) * 100) : 0

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Minhas presenças"
        descricao="Seu histórico de frequência nos encontros e nas vídeo aulas concluídas."
      />

      {total === 0 ? (
        <EstadoVazio
          icone="ClipboardCheck"
          titulo="Nenhuma presença registrada ainda"
          descricao="Nos cursos EAD, a presença é registrada assim que você conclui uma vídeo aula. Nos presenciais, o professor faz a chamada em sala."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Indicador icone="Percent" valor={`${frequencia}%`} label="Sua frequência" />
            <Indicador icone="Check" valor={presentes} label="Presenças" />
            <Indicador icone="X" valor={total - presentes} label="Faltas" />
          </div>

          <Card className="mb-6">
            <div className="mb-2 flex items-center justify-between text-[13px]">
              <span className="font-semibold text-gray-700">Frequência geral</span>
              <span className="font-bold tabular-nums text-brand-700">{frequencia}%</span>
            </div>
            <Progresso valor={frequencia} className="h-2" />
            <p className="mt-2 text-[12px] text-gray-500 tabular-nums">
              {presentes} presenças em {total} encontros
            </p>
          </Card>

          <Card padding={false}>
            <ul className="divide-y divide-gray-100">
              {linhas.map((l, i) => (
                <li key={`${l.id}-${i}`} className="flex items-center gap-3.5 px-4 py-3.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      l.presente ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-red-500'
                    }`}
                  >
                    {l.presente ? '✓' : '✕'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-gray-800">{l.titulo}</p>
                    <p className="text-[11.5px] text-gray-500">
                      {formatarData(l.data)}
                      {l.turma ? ` · ${l.turma}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {l.automatico && <Selo tom="azul">automática</Selo>}
                    <Selo tom={l.presente ? 'verde' : 'vermelho'}>
                      {l.presente ? 'Presente' : 'Ausente'}
                    </Selo>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
