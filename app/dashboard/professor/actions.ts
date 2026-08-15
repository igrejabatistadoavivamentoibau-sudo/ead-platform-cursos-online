'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolverPermissoes, type ChavePermissao, type UserRole } from '@/lib/permissoes'

/** Confirma permissão a partir da sessão e devolve quem está agindo. */
async function exigir(chave: ChavePermissao) {
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

  const role = perfil.role as UserRole
  if (!resolverPermissoes(role, perfil.permissoes)[chave]) {
    throw new Error('Você não tem permissão para executar essa ação.')
  }
  return { userId: user.id, role }
}

/** Professor só age na própria turma; admin em qualquer uma. */
async function garantirTurma(turmaId: string, userId: string, role: UserRole) {
  if (role === 'admin') return
  const admin = createAdminClient()
  const { data } = await admin.from('turmas').select('professor_id').eq('id', turmaId).single()
  if (data?.professor_id !== userId) {
    throw new Error('Esta turma não está sob sua responsabilidade.')
  }
}

// ==================== ENCONTROS E CHAMADA ====================

export async function criarEncontroTurma(
  turmaId: string,
  input: { titulo?: string; data: string }
) {
  const { userId, role } = await exigir('fazer_chamada')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { data: encontro, error } = await admin
    .from('encontros')
    .insert({ turma_id: turmaId, titulo: input.titulo || null, data: input.data })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  // Já deixa a lista pronta com todos os alunos ativos, marcados como ausentes
  const { data: alunos } = await admin
    .from('turma_alunos')
    .select('aluno_id')
    .eq('turma_id', turmaId)
    .eq('status', 'ativo')

  if (alunos?.length) {
    await admin
      .from('presencas')
      .insert(alunos.map((a) => ({ encontro_id: encontro.id, aluno_id: a.aluno_id, presente: false })))
  }

  revalidatePath(`/dashboard/professor/turmas/${turmaId}/chamada`)
  return encontro.id as string
}

export async function salvarChamadaTurma(
  encontroId: string,
  turmaId: string,
  presencas: { aluno_id: string; presente: boolean; observacao?: string }[]
) {
  const { userId, role } = await exigir('fazer_chamada')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { error } = await admin.from('presencas').upsert(
    presencas.map((p) => ({
      encontro_id: encontroId,
      aluno_id: p.aluno_id,
      presente: p.presente,
      observacao: p.observacao || null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'encontro_id,aluno_id' }
  )
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/professor/turmas/${turmaId}/chamada`)
}

export async function removerEncontro(encontroId: string, turmaId: string) {
  const { userId, role } = await exigir('fazer_chamada')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { error } = await admin.from('encontros').delete().eq('id', encontroId)
  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/professor/turmas/${turmaId}/chamada`)
}

// ==================== AVALIAÇÕES E NOTAS ====================

export async function criarAvaliacao(
  turmaId: string,
  input: { titulo: string; tipo: string; peso: number; nota_maxima: number; data?: string }
) {
  const { userId, role } = await exigir('ver_alunos')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { data: ultima } = await admin
    .from('avaliacoes')
    .select('ordem')
    .eq('turma_id', turmaId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await admin.from('avaliacoes').insert({
    turma_id: turmaId,
    titulo: input.titulo,
    tipo: input.tipo,
    peso: input.peso,
    nota_maxima: input.nota_maxima,
    data: input.data || null,
    ordem: (ultima?.ordem ?? 0) + 1,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/professor/turmas/${turmaId}/notas`)
}

export async function removerAvaliacao(avaliacaoId: string, turmaId: string) {
  const { userId, role } = await exigir('ver_alunos')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { error } = await admin.from('avaliacoes').delete().eq('id', avaliacaoId)
  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/professor/turmas/${turmaId}/notas`)
}

export async function lancarNota(
  avaliacaoId: string,
  alunoId: string,
  turmaId: string,
  valor: number | null
) {
  const { userId, role } = await exigir('ver_alunos')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { error } = await admin.from('notas').upsert(
    {
      avaliacao_id: avaliacaoId,
      aluno_id: alunoId,
      valor,
      lancada_por: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'avaliacao_id,aluno_id' }
  )
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/professor/turmas/${turmaId}/notas`)
  revalidatePath('/dashboard/aluno/notas')
}

// ==================== ATIVIDADES ====================

export async function criarAtividade(
  turmaId: string,
  input: { titulo: string; descricao?: string; prazo?: string; nota_maxima: number }
) {
  const { userId, role } = await exigir('ver_alunos')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { error } = await admin.from('atividades').insert({
    turma_id: turmaId,
    titulo: input.titulo,
    descricao: input.descricao || null,
    prazo: input.prazo || null,
    nota_maxima: input.nota_maxima,
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/professor/turmas/${turmaId}/atividades`)
  revalidatePath('/dashboard/aluno/atividades')
}

export async function removerAtividade(atividadeId: string, turmaId: string) {
  const { userId, role } = await exigir('ver_alunos')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { error } = await admin.from('atividades').delete().eq('id', atividadeId)
  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/professor/turmas/${turmaId}/atividades`)
  revalidatePath('/dashboard/aluno/atividades')
}

export async function corrigirEntrega(
  entregaId: string,
  turmaId: string,
  input: { nota: number | null; feedback?: string }
) {
  const { userId, role } = await exigir('ver_alunos')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { error } = await admin
    .from('entregas')
    .update({
      nota: input.nota,
      feedback: input.feedback || null,
      corrigida_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', entregaId)
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/professor/turmas/${turmaId}/atividades`)
  revalidatePath('/dashboard/aluno/atividades')
}

// ==================== AULA AVULSA (vídeo enviado) ====================

const TIPOS_VIDEO = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
const TAMANHO_MAXIMO_VIDEO = 200 * 1024 * 1024 // 200 MB

/**
 * Sobe um arquivo de vídeo direto para a plataforma e cria a aula.
 * Pensado para o curso presencial: o professor grava o encontro e
 * disponibiliza para quem faltou ou quer rever.
 */
export async function criarAulaComVideo(formData: FormData) {
  const { userId, role } = await exigir('gerenciar_aulas')
  const admin = createAdminClient()

  const cursoId = formData.get('curso_id') as string
  const titulo = (formData.get('titulo') as string)?.trim()
  const descricao = (formData.get('descricao') as string)?.trim()
  const file = formData.get('video')

  if (!cursoId || !titulo) throw new Error('Informe o curso e o nome da aula.')

  // Professor precisa lecionar em alguma turma deste curso
  if (role !== 'admin') {
    const { count } = await admin
      .from('turmas')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', cursoId)
      .eq('professor_id', userId)
    if (!count) throw new Error('Este curso não está sob sua responsabilidade.')
  }

  let videoPath: string | null = null

  if (file instanceof File && file.size > 0) {
    if (!TIPOS_VIDEO.includes(file.type)) {
      throw new Error('Formato de vídeo não suportado. Use MP4, WEBM ou MOV.')
    }
    if (file.size > TAMANHO_MAXIMO_VIDEO) {
      throw new Error('O vídeo passa de 200 MB. Comprima o arquivo ou use um link do YouTube.')
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
    videoPath = `${cursoId}/${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await admin.storage
      .from('aulas')
      .upload(videoPath, file, { contentType: file.type, upsert: false })
    if (upErr) throw new Error(`Falha ao enviar o vídeo: ${upErr.message}`)
  }

  const { data: ultima } = await admin
    .from('aulas')
    .select('numero')
    .eq('curso_id', cursoId)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await admin.from('aulas').insert({
    curso_id: cursoId,
    numero: (ultima?.numero ?? 0) + 1,
    titulo,
    descricao: descricao || null,
    video_path: videoPath,
    avulsa: true,
    publicada: true,
  })

  if (error) {
    if (videoPath) await admin.storage.from('aulas').remove([videoPath])
    throw new Error(error.message)
  }

  revalidatePath(`/dashboard/professor/cursos/${cursoId}`)
  revalidatePath(`/dashboard/admin/cursos/${cursoId}`)
}
