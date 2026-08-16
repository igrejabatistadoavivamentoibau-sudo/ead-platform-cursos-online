import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { unstable_noStore as naoGuardarEmCache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import FormInscricao, { type TurmaAberta } from '@/components/Inscricao/FormInscricao'
import {
  AcolhidaTopo,
  AcolhidaRodape,
  LuzesDeFundo,
  FUNDO_INSCRICAO,
} from '@/components/Inscricao/Acolhida'
import { camposDoPapel, type CampoInscricao } from '@/lib/campos'

export const dynamic = 'force-dynamic'

/**
 * Página pública de inscrição — uma para aluno, outra para professor.
 *
 * Usa o cliente administrativo de propósito, só para LER as turmas abertas.
 * A alternativa seria abrir uma permissão pública de leitura na tabela de
 * turmas, o que exporia turmas fechadas para qualquer um na internet.
 * Ler aqui no servidor mantém a porta fechada.
 *
 * Todo o texto de acolhida mora em components/Inscricao/Acolhida.tsx.
 */
export default async function InscricaoPage({ params }: { params: Promise<{ papel: string }> }) {
  // Segunda trava contra cache, independente da primeira (o `no-store` no
  // cliente do banco). Uma ficha de inscrição não pode, em hipótese alguma,
  // servir uma versão guardada: as perguntas mudam quando a liderança quer,
  // e uma resposta velha some com elas sem avisar ninguém.
  naoGuardarEmCache()

  const { papel } = await params
  if (papel !== 'aluno' && papel !== 'professor') notFound()

  const admin = createAdminClient()
  const [{ data }, { data: todosCampos, error: erroCampos }] = await Promise.all([
    admin
      .from('turmas')
      .select('id, nome, valor_matricula, cursos(titulo, modalidade)')
      .eq('inscricoes_abertas', true)
      .neq('status', 'encerrada')
      .order('nome'),
    admin.from('campos_inscricao').select('*').eq('ativo', true).order('ordem'),
  ])

  // Se a leitura dos campos falhar, a ficha apareceria sem as perguntas e
  // ninguém saberia por quê. Melhor quebrar visivelmente do que enganar.
  if (erroCampos) {
    throw new Error(`Falha ao carregar as perguntas da ficha: ${erroCampos.message}`)
  }

  const campos = camposDoPapel((todosCampos ?? []) as CampoInscricao[], papel)

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
    <main className={FUNDO_INSCRICAO}>
      <LuzesDeFundo />

      <div className="relative mx-auto max-w-lg">
        <Link
          href="/"
          className="group mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-white/55 transition-colors hover:text-white"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
            strokeWidth={2.2}
          />
          Voltar ao início
        </Link>

        <AcolhidaTopo papel={papel} />

        <div className="mt-5">
          <FormInscricao papel={papel} turmas={turmas} campos={campos} />
        </div>

        <AcolhidaRodape papel={papel} />

        <p className="mt-8 text-center text-[12px] text-white/40">
          Já tem acesso?{' '}
          <Link href="/auth/login" className="font-semibold text-white/70 hover:text-white">
            Entrar na plataforma
          </Link>
        </p>
      </div>
    </main>
  )
}
