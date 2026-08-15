import { Abas } from '@/components/ui'

/** Navegação entre as áreas de uma turma, compartilhada por todas as telas. */
export default function AbasTurma({
  turmaId,
  atual,
  presencial,
  contadores,
}: {
  turmaId: string
  atual: 'avanco' | 'chamada' | 'notas' | 'atividades'
  presencial: boolean
  contadores?: { atividades?: number }
}) {
  const base = `/dashboard/professor/turmas/${turmaId}`

  const itens = [
    { href: `${base}/avanco`, label: 'Avanço', icone: 'TrendingUp' },
    {
      href: `${base}/chamada`,
      // O nome muda conforme a modalidade: no EAD a chamada é gerada sozinha
      label: presencial ? 'Chamada' : 'Frequência',
      icone: 'ClipboardCheck',
    },
    { href: `${base}/notas`, label: 'Notas', icone: 'GraduationCap' },
    {
      href: `${base}/atividades`,
      label: 'Atividades',
      icone: 'FileText',
      contador: contadores?.atividades,
    },
  ]

  return <Abas itens={itens} atual={`${base}/${atual}`} />
}
