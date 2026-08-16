import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GraduationCap, Presentation, ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import FormInscricao, { type TurmaAberta } from '@/components/Inscricao/FormInscricao'

export const dynamic = 'force-dynamic'

const PAPEIS = {
  aluno: {
    titulo: 'Inscrição de Aluno',
    chamada: 'Estude na Escola de Líderes',
    descricao:
      'Preencha seus dados, escolha a turma e envie. A liderança analisa e libera seu acesso.',
    icone: GraduationCap,
  },
  professor: {
    titulo: 'Inscrição de Professor',
    chamada: 'Ensine na Escola de Líderes',
    descricao:
      'Preencha seus dados e conte um pouco da sua experiência. A liderança analisa seu cadastro.',
    icone: Presentation,
  },
} as const

/**
 * Página pública de inscrição — uma para aluno, outra para professor.
 *
 * Usa o cliente administrativo de propósito, só para LER as turmas abertas.
 * A alternativa seria abrir uma permissão pública de leitura na tabela de
 * turmas, o que exporia turmas fechadas para qualquer um na internet.
 * Ler aqui no servidor mantém a porta fechada.
 */
export default async function InscricaoPage({
  params,
}: {
  params: Promise<{ papel: string }>
}) {
  const { papel } = await params
  if (papel !== 'aluno' && papel !== 'professor') notFound()

  const info = PAPEIS[papel]
  const Icone = info.icone

  const admin = createAdminClient()
  const { data } = await admin
    .from('turmas')
    .select('id, nome, valor_matricula, cursos(titulo, modalidade)')
    .eq('inscricoes_abertas', true)
    .neq('status', 'encerrada')
    .order('nome')

  const turmas: TurmaAberta[] = (data ?? []).map((t) => {
    const c = t.cursos as unknown as { titulo?: string; modalidade?: string } | null
    return {
      id: t.id,
      nome: t.nome,
      curso: c?.titulo ?? null,
      modalidade: c?.modalidade ?? 'ead',
      valor: t.valor_matricula ? Number(t.valor_matricula) : null,
    }
  })

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-950 via-brand-900 to-brand-950 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="group mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
            strokeWidth={2.2}
          />
          Voltar ao início
        </Link>

        <div className="mb-6 text-center">
          <Image
            src="/ibau-marca-clara.png"
            alt="Escola de Líderes IBAU"
            width={150}
            height={128}
            priority
            className="mx-auto mb-5 h-auto w-[128px]"
          />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-white/20">
            <Icone className="h-3.5 w-3.5" strokeWidth={2.2} />
            {info.titulo}
          </span>
          <h1 className="mt-4 font-display text-[26px] font-bold leading-tight text-white">
            {info.chamada}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-brand-50/70">
            {info.descricao}
          </p>
        </div>

        <FormInscricao papel={papel} turmas={turmas} />

        <p className="mt-6 text-center text-[12px] text-white/40">
          Já tem acesso?{' '}
          <Link href="/auth/login" className="font-semibold text-white/70 hover:text-white">
            Entrar na plataforma
          </Link>
        </p>
      </div>
    </main>
  )
}
