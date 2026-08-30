import { notFound } from 'next/navigation'
import Voltar from '@/components/ui/Voltar'
import { createClient } from '@/lib/supabase/server'
import ChamadaForm from '@/components/Dashboard/ChamadaForm'

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export default async function ChamadaPage({
  params,
}: {
  params: Promise<{ id: string; encontroId: string }>
}) {
  const { id, encontroId } = await params
  const supabase = await createClient()

  const [{ data: turma }, { data: encontro }, { data: presencas }] = await Promise.all([
    supabase.from('turmas').select('id, nome').eq('id', id).single(),
    supabase.from('encontros').select('id, titulo, data').eq('id', encontroId).single(),
    supabase
      .from('presencas')
      .select('aluno_id, presente, observacao, users:users!presencas_aluno_id_fkey(name, email)')
      .eq('encontro_id', encontroId),
  ])

  if (!turma || !encontro) notFound()

  const linhas = (presencas ?? [])
    .map((p) => {
      const aluno = p.users as unknown as { name?: string; email?: string } | null
      return {
        aluno_id: p.aluno_id as string,
        name: (aluno?.name as string) ?? '',
        email: (aluno?.email as string) ?? '',
        presente: p.presente as boolean,
        observacao: (p.observacao as string) ?? '',
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div className="p-5 sm:p-8 max-w-3xl">
      <Voltar
        href={`/dashboard/admin/turmas/${id}`}
        label={turma.nome}
        titulo="Lista de chamada"
        margem="mb-4"
      />

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-1">
        Lista de chamada
      </h1>
      <p className="text-gray-500 mb-6">
        {encontro.titulo || 'Encontro'} — {formatarData(encontro.data)}
      </p>

      <ChamadaForm turmaId={id} encontroId={encontroId} presencasIniciais={linhas} />
    </div>
  )
}
