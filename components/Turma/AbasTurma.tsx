import { Abas } from '@/components/ui'

/** Navegação entre as áreas de uma turma, compartilhada por todas as telas. */
export default function AbasTurma({
  turmaId,
  atual,
  presencial,
  contadores,
}: {
  turmaId: string
  atual: 'avanco' | 'aulas' | 'chamada' | 'notas' | 'atividades' | 'conclusao'
  presencial: boolean
  contadores?: { atividades?: number; pedidos?: number }
}) {
  const base = `/dashboard/professor/turmas/${turmaId}`

  const itens = [
    { href: `${base}/avanco`, label: 'Avanço', icone: 'TrendingUp' },
    {
      href: `${base}/aulas`,
      label: 'Aulas',
      icone: 'PlayCircle',
      // O contador aqui é de PEDIDOS de liberação parados. É o único
      // número desta barra que significa "tem alguém esperando você".
      contador: contadores?.pedidos,
    },
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
    /* A conclusão fica por último de propósito: é o fim do caminho da
       turma, e o único item da barra que decide se alguém avança ou
       repete o módulo. */
    { href: `${base}/conclusao`, label: 'Conclusão', icone: 'GraduationCap' },
  ]

  return <Abas itens={itens} atual={`${base}/${atual}`} />
}
