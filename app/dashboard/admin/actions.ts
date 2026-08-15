'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolverPermissoes, type ChavePermissao, type UserRole } from '@/lib/permissoes'

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

// ============ SLIDES DO CARROSSEL ============

const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const TAMANHO_MAXIMO = 8 * 1024 * 1024 // 8 MB

/**
 * Recebe a foto via FormData (jeito nativo do Next para upload em Server
 * Action), envia para o Supabase Storage e registra o slide no banco.
 */
export async function criarSlide(formData: FormData) {
  await requireAdmin()
  const admin = createAdminClient()

  const file = formData.get('file')
  const titulo = (formData.get('titulo') as string | null)?.trim() || null

  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Selecione uma imagem para enviar.')
  }
  if (!TIPOS_IMAGEM.includes(file.type)) {
    throw new Error('Formato não suportado. Use JPG, PNG, WEBP ou AVIF.')
  }
  if (file.size > TAMANHO_MAXIMO) {
    throw new Error('A imagem passa de 8 MB. Reduza o tamanho e tente de novo.')
  }

  const extensao = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const nomeArquivo = `${crypto.randomUUID()}.${extensao}`

  const { error: uploadError } = await admin.storage
    .from('carrossel')
    .upload(nomeArquivo, file, { contentType: file.type, upsert: false })

  if (uploadError) throw new Error(`Falha ao enviar a imagem: ${uploadError.message}`)

  // Novo slide entra no fim da fila
  const { data: ultimo } = await admin
    .from('slides')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error: insertError } = await admin.from('slides').insert({
    titulo,
    image_path: nomeArquivo,
    ordem: (ultimo?.ordem ?? 0) + 1,
  })

  if (insertError) {
    // Não deixa a imagem órfã no storage se o registro falhar
    await admin.storage.from('carrossel').remove([nomeArquivo])
    throw new Error(insertError.message)
  }

  revalidatePath('/dashboard/admin/carrossel')
  revalidatePath('/')
}

export async function alternarSlide(slideId: string, ativo: boolean) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('slides')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('id', slideId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/carrossel')
  revalidatePath('/')
}

export async function renomearSlide(slideId: string, titulo: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('slides')
    .update({ titulo: titulo.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', slideId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/carrossel')
  revalidatePath('/')
}

/** Move o slide uma posição para cima ou para baixo, trocando com o vizinho. */
export async function moverSlide(slideId: string, direcao: 'cima' | 'baixo') {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: slides, error: listError } = await admin
    .from('slides')
    .select('id, ordem')
    .order('ordem', { ascending: true })

  if (listError) throw new Error(listError.message)
  if (!slides) return

  const indice = slides.findIndex((s) => s.id === slideId)
  if (indice === -1) return

  const vizinho = direcao === 'cima' ? indice - 1 : indice + 1
  if (vizinho < 0 || vizinho >= slides.length) return

  const atual = slides[indice]
  const outro = slides[vizinho]

  await admin.from('slides').update({ ordem: outro.ordem }).eq('id', atual.id)
  await admin.from('slides').update({ ordem: atual.ordem }).eq('id', outro.id)

  revalidatePath('/dashboard/admin/carrossel')
  revalidatePath('/')
}

export async function removerSlide(slideId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: slide } = await admin
    .from('slides')
    .select('image_path')
    .eq('id', slideId)
    .single()

  const { error } = await admin.from('slides').delete().eq('id', slideId)
  if (error) throw new Error(error.message)

  if (slide?.image_path) {
    await admin.storage.from('carrossel').remove([slide.image_path])
  }

  revalidatePath('/dashboard/admin/carrossel')
  revalidatePath('/')
}

// ============ VÍDEO AULAS ============

/**
 * Confirma que quem chama tem a permissão pedida. Diferente de requireAdmin,
 * isto permite que um professor com permissão liberada também execute.
 */
async function exigirPermissaoAction(chave: ChavePermissao) {
  const session = await createSessionClient()
  const {
    data: { user },
  } = await session.auth.getUser()

  if (!user) throw new Error('Não autenticado.')

  const { data: perfil } = await session
    .from('users')
    .select('role, permissoes')
    .eq('id', user.id)
    .single()

  if (!perfil) throw new Error('Perfil não encontrado.')

  const permissoes = resolverPermissoes(perfil.role as UserRole, perfil.permissoes)
  if (!permissoes[chave]) {
    throw new Error('Você não tem permissão para executar essa ação.')
  }

  return { user, role: perfil.role as UserRole }
}

/** Professor só mexe na própria turma; admin mexe em qualquer uma. */
async function garantirAcessoATurma(turmaId: string, userId: string, role: UserRole) {
  if (role === 'admin') return
  const admin = createAdminClient()
  const { data: turma } = await admin
    .from('turmas')
    .select('professor_id')
    .eq('id', turmaId)
    .single()

  if (turma?.professor_id !== userId) {
    throw new Error('Esta turma não está sob sua responsabilidade.')
  }
}

export async function criarAula(input: {
  turma_id: string
  titulo: string
  descricao?: string
  video_url?: string
  duracao_minutos?: number
}) {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoATurma(input.turma_id, user.id, role)
  const admin = createAdminClient()

  // Número da aula é sequencial dentro da turma (Aula 1, Aula 2, ...)
  const { data: ultima } = await admin
    .from('aulas')
    .select('numero')
    .eq('turma_id', input.turma_id)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await admin.from('aulas').insert({
    turma_id: input.turma_id,
    numero: (ultima?.numero ?? 0) + 1,
    titulo: input.titulo,
    descricao: input.descricao || null,
    video_url: input.video_url || null,
    duracao_minutos: input.duracao_minutos || null,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/admin/turmas/${input.turma_id}/aulas`)
  revalidatePath(`/dashboard/professor/turmas/${input.turma_id}/aulas`)
}

export async function atualizarAula(
  aulaId: string,
  turmaId: string,
  input: { titulo?: string; descricao?: string; video_url?: string; duracao_minutos?: number }
) {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoATurma(turmaId, user.id, role)
  const admin = createAdminClient()

  const { error } = await admin
    .from('aulas')
    .update({
      ...(input.titulo !== undefined ? { titulo: input.titulo } : {}),
      ...(input.descricao !== undefined ? { descricao: input.descricao || null } : {}),
      ...(input.video_url !== undefined ? { video_url: input.video_url || null } : {}),
      ...(input.duracao_minutos !== undefined
        ? { duracao_minutos: input.duracao_minutos || null }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', aulaId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/admin/turmas/${turmaId}/aulas`)
  revalidatePath(`/dashboard/professor/turmas/${turmaId}/aulas`)
}

export async function publicarAula(aulaId: string, turmaId: string, publicada: boolean) {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoATurma(turmaId, user.id, role)
  const admin = createAdminClient()

  const { error } = await admin
    .from('aulas')
    .update({ publicada, updated_at: new Date().toISOString() })
    .eq('id', aulaId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/admin/turmas/${turmaId}/aulas`)
  revalidatePath(`/dashboard/professor/turmas/${turmaId}/aulas`)
}

/** Troca a aula de posição com a vizinha, renumerando as duas. */
export async function moverAula(aulaId: string, turmaId: string, direcao: 'cima' | 'baixo') {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoATurma(turmaId, user.id, role)
  const admin = createAdminClient()

  const { data: aulas } = await admin
    .from('aulas')
    .select('id, numero')
    .eq('turma_id', turmaId)
    .order('numero', { ascending: true })

  if (!aulas) return
  const i = aulas.findIndex((a) => a.id === aulaId)
  if (i === -1) return

  const j = direcao === 'cima' ? i - 1 : i + 1
  if (j < 0 || j >= aulas.length) return

  const atual = aulas[i]
  const outra = aulas[j]

  // Número temporário para não violar a regra de número único por turma
  await admin.from('aulas').update({ numero: -1 }).eq('id', atual.id)
  await admin.from('aulas').update({ numero: atual.numero }).eq('id', outra.id)
  await admin.from('aulas').update({ numero: outra.numero }).eq('id', atual.id)

  revalidatePath(`/dashboard/admin/turmas/${turmaId}/aulas`)
  revalidatePath(`/dashboard/professor/turmas/${turmaId}/aulas`)
}

export async function removerAula(aulaId: string, turmaId: string) {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoATurma(turmaId, user.id, role)
  const admin = createAdminClient()

  const { error } = await admin.from('aulas').delete().eq('id', aulaId)
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/admin/turmas/${turmaId}/aulas`)
  revalidatePath(`/dashboard/professor/turmas/${turmaId}/aulas`)
}

// ============ PERMISSÕES ============

export async function atualizarPermissoes(
  userId: string,
  permissoes: Partial<Record<ChavePermissao, boolean>>
) {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: alvo } = await admin.from('users').select('role').eq('id', userId).single()
  if (alvo?.role === 'admin') {
    throw new Error('Administradores têm acesso total e não podem ser limitados.')
  }

  const { error } = await admin
    .from('users')
    .update({ permissoes, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/usuarios')
  revalidatePath('/dashboard/admin/permissoes')
}
