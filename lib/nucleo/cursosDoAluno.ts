import { createAdminClient } from '@/lib/supabase/admin'
import {
  modulosDoAluno,
  type MatriculaNoModulo,
  type SituacaoNaTurma,
} from '@/lib/modulosDoAluno'
import type { QuemChama } from '@/lib/nucleo/identidade'

/* ============================================================
   OS CURSOS DE UM ALUNO, COM O ESTADO DE CADA MÓDULO

   A tela inicial de um aplicativo de aluno é esta consulta. E o que ela
   devolve não é "a lista de cursos": é a lista com o CADEADO já resolvido
   — quais módulos estão abertos, quais estão trancados e POR QUÊ.

   Isso importa para o aplicativo nativo mais do que parece. Se a API
   devolvesse cursos e módulos crus, o aplicativo teria de reimplementar em
   Swift e em Kotlin a regra de pré-requisito que já existe em
   `lib/modulosDoAluno.ts` — três cópias da mesma regra, que divergem na
   primeira vez que alguém corrigir uma só.

   Aqui a regra roda uma vez, no servidor, e o aplicativo recebe a
   conclusão pronta: `aberto: true/false` e o motivo escrito em português,
   já pronto para ser mostrado.
   ============================================================ */

export interface ModuloNaApi {
  id: string
  nome: string
  descricao: string | null
  ordem: number
  aberto: boolean
  estado: string
  motivo: string | null
  aulas: number
  aulasConcluidas: number
}

export interface CursoNaApi {
  id: string
  titulo: string
  subtitulo: string | null
  modulos: ModuloNaApi[]
  /** Avanço no módulo em que ele está AGORA — não no curso inteiro. */
  percentual: number
}

export async function cursosDoAluno(quem: QuemChama): Promise<CursoNaApi[]> {
  const admin = createAdminClient()

  /* As turmas da pessoa. Sem filtrar por `status`: a matrícula de quem foi
     APROVADO vira 'concluido', e é justamente ela que mantém o módulo
     aberto para ele rever o material que conquistou. */
  const { data: minhasTurmas } = await admin
    .from('turma_alunos')
    .select('turma_id, situacao, turmas!inner(id, curso_id, modulo_id)')
    .eq('aluno_id', quem.id)

  const vinculos = (minhasTurmas ?? []).map((m) => {
    const t = m.turmas as unknown as { curso_id?: string; modulo_id?: string | null } | null
    return {
      cursoId: t?.curso_id ?? null,
      moduloId: t?.modulo_id ?? null,
      situacao: ((m.situacao as SituacaoNaTurma) ?? 'cursando') as SituacaoNaTurma,
    }
  })

  const idsCursos = [...new Set(vinculos.map((v) => v.cursoId).filter(Boolean))] as string[]
  if (idsCursos.length === 0) return []

  const [{ data: cursos }, { data: modulos }, { data: aulas }, { data: progresso }] =
    await Promise.all([
      admin.from('cursos').select('id, titulo, subtitulo').in('id', idsCursos),
      admin
        .from('modulos')
        .select('id, curso_id, nome, descricao, ordem')
        .in('curso_id', idsCursos)
        .order('ordem', { ascending: true }),
      admin
        .from('aulas')
        .select('id, curso_id, modulo_id')
        .in('curso_id', idsCursos)
        .eq('publicada', true),
      admin
        .from('aula_progresso')
        .select('aula_id, concluida')
        .eq('aluno_id', quem.id)
        .eq('concluida', true),
    ])

  const concluidas = new Set((progresso ?? []).map((p) => p.aula_id as string))
  const aulasPorModulo = new Map<string, string[]>()
  for (const a of aulas ?? []) {
    const k = (a.modulo_id as string) ?? ''
    if (!k) continue
    aulasPorModulo.set(k, [...(aulasPorModulo.get(k) ?? []), a.id as string])
  }

  return (cursos ?? []).map((c) => {
    const doCurso = (modulos ?? []).filter((m) => m.curso_id === c.id)

    const matriculas: MatriculaNoModulo[] = vinculos
      .filter((v) => v.cursoId === c.id && v.moduloId)
      .map((v) => ({ moduloId: v.moduloId as string, situacao: v.situacao }))

    /* A MESMA função que a tela do site usa. Não existe uma segunda
       versão da regra de pré-requisito para a API. */
    const estados = modulosDoAluno(
      doCurso.map((m) => ({
        id: m.id as string,
        nome: m.nome as string,
        descricao: (m.descricao as string) ?? null,
        ordem: Number(m.ordem),
      })),
      matriculas
    )

    const lista: ModuloNaApi[] = estados.map((m) => {
      const daqui = aulasPorModulo.get(m.id) ?? []
      return {
        id: m.id,
        nome: m.nome,
        descricao: m.descricao ?? null,
        ordem: m.ordem,
        aberto: m.aberto,
        estado: m.estado,
        motivo: m.motivo ?? null,
        aulas: daqui.length,
        aulasConcluidas: daqui.filter((id) => concluidas.has(id)).length,
      }
    })

    /* O avanço é do MÓDULO ATUAL, e não do curso inteiro. Contar o curso
       daria um teto de 33% para quem está no primeiro de três — o aluno
       terminaria a etapa dele vendo "33% concluído" e concluiria, com
       razão, que está atrasado. */
    const atual = lista.find((m) => m.estado === 'cursando' || m.estado === 'repetindo')
    const base = atual ?? lista.filter((m) => m.aberto).at(-1) ?? null

    return {
      id: c.id as string,
      titulo: c.titulo as string,
      subtitulo: (c.subtitulo as string) ?? null,
      modulos: lista,
      percentual:
        base && base.aulas > 0 ? Math.round((base.aulasConcluidas / base.aulas) * 100) : 0,
    }
  })
}
