import { createClient } from '@/lib/supabase/server'
import { exigirSessao } from '@/lib/auth'
import type { EstiloDeAssinatura } from '@/lib/assinatura'

import { PageHeader, EstadoVazio, Indicador } from '@/components/ui'
import EntregaAtividade, { type AtividadeAluno } from '@/components/Aluno/EntregaAtividade'

const PAPEL_POR_EXTENSO: Record<string, string> = {
  professor: 'Professor(a) da turma',
  admin: 'Coordenação — Escola de Líderes IBAU',
  aluno: 'Escola de Líderes IBAU',
}

/* A ASSINATURA SÓ EXISTE SE A CORREÇÃO EXISTIR.
   Faltando quem corrigiu, quando, ou a nota, não se monta assinatura
   nenhuma — meia assinatura é pior que nenhuma, porque parece um registro
   e não é. Entrega antiga, corrigida antes desta versão, cai aqui: ela
   mostra a nota como sempre mostrou, só não vem com o selo. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assinaturaDaEntrega(e: any) {
  const c = e.corretor as { assinatura_nome?: string; name?: string; role?: string; assinatura_estilo?: string } | null
  const nome = c?.assinatura_nome ?? c?.name
  if (!nome || !e.corrigida_em || !e.corrigida_por || e.nota === null) return null
  return {
    assinanteId: e.corrigida_por as string,
    nome,
    papel: PAPEL_POR_EXTENSO[c?.role ?? ''] ?? 'Escola de Líderes IBAU',
    estilo: (c?.assinatura_estilo ?? null) as EstiloDeAssinatura | null,
    em: e.corrigida_em as string,
  }
}

export default async function MinhasAtividadesPage() {
  const sessao = await exigirSessao()
  const supabase = await createClient()

  const { data: matriculas } = await supabase
    .from('turma_alunos')
    .select('turma_id, turmas(id, nome)')
    .eq('aluno_id', sessao.id)

  const nomeDaTurma = new Map<string, string>()
  for (const m of matriculas ?? []) {
    const t = m.turmas as unknown as { id?: string; nome?: string } | null
    if (t?.id) nomeDaTurma.set(t.id, t.nome ?? '')
  }

  const ids = [...nomeDaTurma.keys()]

  const [{ data: atividades }, { data: entregas }] = await Promise.all([
    ids.length
      ? supabase
          .from('atividades')
          .select('id, turma_id, titulo, descricao, aviso, abre_em, vence_em, nota_maxima')
          .in('turma_id', ids)
          .eq('publicada', true)
          // O que vence primeiro aparece primeiro; o que não tem prazo
          // desce para o fim, porque não é o que aperta.
          .order('vence_em', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from('entregas')
      .select('id, atividade_id, texto, nota, feedback, entregue_em, corrigida_em, corrigida_por, corretor:users!entregas_corrigida_por_fkey(assinatura_nome, name, role, assinatura_estilo)')
      .eq('aluno_id', sessao.id),
  ])

  /* Os anexos vêm numa consulta só, para todas as entregas do aluno —
     em vez de uma consulta por atividade, que numa turma com 15 trabalhos
     seriam 15 idas ao banco só para desenhar uma lista. */
  const idsDeEntrega = (entregas ?? []).map((e) => e.id as string)
  const { data: anexos } = idsDeEntrega.length
    ? await supabase
        .from('entrega_arquivos')
        .select('id, entrega_id, nome, tipo')
        .in('entrega_id', idsDeEntrega)
        .order('enviado_em')
    : { data: [] }

  const anexosPorEntrega = new Map<string, { id: string; nome: string; tipo: string }[]>()
  for (const a of anexos ?? []) {
    const chave = a.entrega_id as string
    const lista = anexosPorEntrega.get(chave) ?? []
    lista.push({ id: a.id as string, nome: a.nome as string, tipo: a.tipo as string })
    anexosPorEntrega.set(chave, lista)
  }

  const entregaPorAtividade = new Map(
    (entregas ?? []).map((e) => [
      e.atividade_id,
      {
        id: e.id as string,
        texto: (e.texto as string) ?? null,
        nota: e.nota === null ? null : Number(e.nota),
        feedback: (e.feedback as string) ?? null,
        entregue_em: e.entregue_em as string,
        anexos: anexosPorEntrega.get(e.id as string) ?? [],
        assinatura: assinaturaDaEntrega(e),
      },
    ])
  )

  const lista: AtividadeAluno[] = (atividades ?? []).map((a) => ({
    id: a.id as string,
    titulo: a.titulo as string,
    descricao: (a.descricao as string) ?? null,
    aviso: (a.aviso as string) ?? null,
    abre_em: (a.abre_em as string) ?? null,
    vence_em: (a.vence_em as string) ?? null,
    nota_maxima: Number(a.nota_maxima),
    turma: nomeDaTurma.get(a.turma_id as string) ?? '',
    entrega: entregaPorAtividade.get(a.id as string) ?? null,
  }))

  const entregues = lista.filter((a) => a.entrega).length
  const corrigidas = lista.filter((a) => a.entrega?.nota !== null && a.entrega?.nota !== undefined).length
  const pendentes = lista.length - entregues

  return (
    <div className="p-5 sm:p-8">
      <PageHeader
        titulo="Minhas atividades"
        descricao="Trabalhos complementares definidos pelos seus professores. Entregue por aqui."
      />

      {lista.length === 0 ? (
        <EstadoVazio
          icone="FileText"
          titulo="Nenhuma atividade por enquanto"
          descricao="Quando seu professor publicar um trabalho, ele aparece aqui com o prazo de entrega."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <Indicador icone="Clock" valor={pendentes} label="A entregar" />
            <Indicador icone="Upload" valor={entregues} label="Entregues" />
            <Indicador icone="Check" valor={corrigidas} label="Corrigidas" />
          </div>

          <div className="space-y-3">
            {lista.map((a) => (
              <EntregaAtividade key={a.id} atividade={a} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
