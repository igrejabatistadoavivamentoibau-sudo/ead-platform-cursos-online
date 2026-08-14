'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Confirma, a partir da sessão (cookies), que quem está chamando a action
 * é de fato um administrador. Nunca confie em nada vindo do cliente para
 * essa checagem — é sempre feita de novo aqui, no servidor.
 */
async function requireAdmin() {
  const session = await createSessionClient()
  const {
    data: { user },
  } = await session.auth.getUser()

  if (!user) throw new Error('Não autenticado.')

  const { data: profile } = await session
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Apenas administradores podem executar essa ação.')
  }

  return user
}

// ============ TURMAS ============

export async function criarTurma(input: {
  nome: string
  descricao?: string
  professor_id?: string
  data_inicio?: string
}) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin.from('turmas').insert({
    nome: input.nome,
    descricao: input.descricao || null,
    professor_id: input.professor_id || null,
    data_inicio: input.data_inicio || null,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/turmas')
}

export async function iniciarTurma(turmaId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('turmas')
    .update({ status: 'em_andamento', updated_at: new Date().toISOString() })
    .eq('id', turmaId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/turmas')
  revalidatePath(`/dashboard/admin/turmas/${turmaId}`)
}

export async function encerrarTurma(turmaId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('turmas')
    .update({ status: 'encerrada', updated_at: new Date().toISOString() })
    .eq('id', turmaId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/turmas')
  revalidatePath(`/dashboard/admin/turmas/${turmaId}`)
}

export async function matricularAluno(turmaId: string, alunoId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('turma_alunos')
    .insert({ turma_id: turmaId, aluno_id: alunoId })

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/admin/turmas/${turmaId}`)
}

export async function removerMatricula(turmaId: string, matriculaId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin.from('turma_alunos').delete().eq('id', matriculaId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/admin/turmas/${turmaId}`)
}

// ============ ENCONTROS / CHAMADA ============

export async function criarEncontro(turmaId: string, input: { titulo?: string; data: string }) {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: encontro, error } = await admin
    .from('encontros')
    .insert({ turma_id: turmaId, titulo: input.titulo || null, data: input.data })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // Pré-popula a lista de chamada com todos os alunos ativos da turma
  const { data: alunos } = await admin
    .from('turma_alunos')
    .select('aluno_id')
    .eq('turma_id', turmaId)
    .eq('status', 'ativo')

  if (alunos && alunos.length > 0) {
    await admin.from('presencas').insert(
      alunos.map((a) => ({
        encontro_id: encontro.id,
        aluno_id: a.aluno_id,
        presente: false,
      }))
    )
  }

  revalidatePath(`/dashboard/admin/turmas/${turmaId}`)
  return encontro.id as string
}

export async function salvarChamada(
  encontroId: string,
  turmaId: string,
  presencas: { aluno_id: string; presente: boolean; observacao?: string }[]
) {
  await requireAdmin()
  const admin = createAdminClient()

  for (const p of presencas) {
    const { error } = await admin
      .from('presencas')
      .upsert(
        {
          encontro_id: encontroId,
          aluno_id: p.aluno_id,
          presente: p.presente,
          observacao: p.observacao || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'encontro_id,aluno_id' }
      )

    if (error) throw new Error(error.message)
  }

  revalidatePath(`/dashboard/admin/turmas/${turmaId}/chamada/${encontroId}`)
}

// ============ USUÁRIOS ============

export async function criarUsuario(input: {
  email: string
  password: string
  name: string
  role: 'aluno' | 'professor' | 'admin'
}) {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: created, error: authCreateError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  })

  if (authCreateError) throw new Error(authCreateError.message)

  const { error: profileError } = await admin.from('users').insert({
    id: created.user.id,
    email: input.email,
    name: input.name,
    role: input.role,
  })

  if (profileError) {
    // Se o perfil falhar, desfaz o usuário de autenticação para não deixar
    // uma conta "fantasma" sem perfil.
    await admin.auth.admin.deleteUser(created.user.id)
    throw new Error(profileError.message)
  }

  revalidatePath('/dashboard/admin/usuarios')
  return created.user.id
}

export async function trocarSenha(userId: string, novaSenha: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: novaSenha,
  })

  if (error) throw new Error(error.message)
}

export async function atualizarPapel(userId: string, role: 'aluno' | 'professor' | 'admin') {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('users')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/usuarios')
}
