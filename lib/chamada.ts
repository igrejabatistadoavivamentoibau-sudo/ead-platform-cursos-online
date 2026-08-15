import { createClient } from '@/lib/supabase/server'

export interface LinhaChamada {
  nome: string
  email: string
  presente: boolean
  observacao: string | null
}

export interface DadosChamada {
  turma: string
  curso: string | null
  professor: string | null
  titulo: string
  data: string
  linhas: LinhaChamada[]
  presentes: number
  total: number
}

/** Formata AAAA-MM-DD para DD/MM/AAAA sem depender de fuso horário. */
export function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

/**
 * Carrega uma chamada já pronta para exportação.
 *
 * Usa o cliente de sessão de propósito: assim as regras do banco garantem
 * que só quem tem acesso àquela turma consegue baixar a lista — a rota de
 * exportação não vira uma porta dos fundos.
 */
export async function carregarChamada(encontroId: string): Promise<DadosChamada | null> {
  const supabase = await createClient()

  const { data: encontro } = await supabase
    .from('encontros')
    .select('id, titulo, data, turma_id, turmas(nome, cursos(titulo), users(name))')
    .eq('id', encontroId)
    .single()

  if (!encontro) return null

  const turma = encontro.turmas as unknown as {
    nome?: string
    cursos?: { titulo?: string } | null
    users?: { name?: string } | null
  } | null

  const { data: presencas } = await supabase
    .from('presencas')
    .select('presente, observacao, users(name, email)')
    .eq('encontro_id', encontroId)

  const linhas: LinhaChamada[] = (presencas ?? [])
    .map((p) => {
      const u = p.users as unknown as { name?: string; email?: string } | null
      return {
        nome: u?.name ?? '',
        email: u?.email ?? '',
        presente: p.presente as boolean,
        observacao: (p.observacao as string) ?? null,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return {
    turma: turma?.nome ?? 'Turma',
    curso: turma?.cursos?.titulo ?? null,
    professor: turma?.users?.name ?? null,
    titulo: (encontro.titulo as string) || 'Encontro',
    data: encontro.data as string,
    linhas,
    presentes: linhas.filter((l) => l.presente).length,
    total: linhas.length,
  }
}
