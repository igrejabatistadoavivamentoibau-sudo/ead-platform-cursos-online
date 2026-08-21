import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import VisaoDoCurso, {
  type AulaDoCurso,
  type ProgressoAula,
  type ModuloNaTela,
} from '@/components/Cursos/VisaoDoCurso'
import FaixaPreview from '@/components/Cursos/FaixaPreview'
import { montarPreview } from '@/lib/preview'
import type { Curso } from '@/lib/cursos'

export default async function PreviewCursoProfessor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aula?: string; rascunhos?: string }>
}) {
  const { id } = await params
  const { aula, rascunhos } = await searchParams
  await exigirPermissao('gerenciar_aulas')

  const supabase = await createClient()
  const dados = await montarPreview(supabase, id, aula, rascunhos === '1')
  if (!dados) notFound()

  const base = `/dashboard/professor/cursos/${id}/preview`

  return (
    <div className="p-5 sm:p-8">
      <FaixaPreview
        voltarHref={`/dashboard/professor/cursos/${id}`}
        incluirRascunhos={dados.incluirRascunhos}
        alternarHref={`${base}?${dados.paramsAlternar}`}
        totalRascunhos={dados.totalRascunhos}
      />

      {dados.aulaAtual ? (
        <VisaoDoCurso
          curso={dados.curso as Curso}
          aulas={dados.aulas as AulaDoCurso[]}
          modulos={dados.modulos as ModuloNaTela[]}
          aulaAtual={dados.aulaAtual as AulaDoCurso}
          progressoPorAula={new Map<string, ProgressoAula>()}
          hrefAula={(aulaId) => `${base}?aula=${aulaId}${dados.incluirRascunhos ? '&rascunhos=1' : ''}`}
          preview
        />
      ) : (
        <div className="card-alive p-14 text-center max-w-lg mx-auto">
          <p className="text-gray-800 font-semibold">Nenhuma aula publicada neste curso.</p>
          <p className="text-sm text-gray-500 mt-1.5">
            {dados.totalRascunhos > 0
              ? 'Existem aulas em rascunho — use "Incluir rascunhos" acima para vê-las.'
              : 'Cadastre e publique uma aula para ver como o aluno enxerga.'}
          </p>
        </div>
      )}
    </div>
  )
}
