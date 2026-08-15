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

/**
 * Prepara o envio de uma aula gravada.
 *
 * POR QUE O ARQUIVO NÃO PASSA MAIS PELO SERVIDOR
 * A versão anterior recebia o arquivo de vídeo dentro de uma action. Isso
 * não funciona em produção: a Vercel recusa qualquer requisição acima de
 * ~4,5 MB e o Next limita ações de servidor a 1 MB. Qualquer vídeo de
 * verdade era barrado — o envio ficava rodando e morria sem gravar nada,
 * que é exatamente o comportamento relatado.
 *
 * Agora o servidor só autoriza e devolve o caminho onde o arquivo deve
 * ficar. O navegador envia direto para o armazenamento. Além de funcionar,
 * é mais rápido: o vídeo faz um salto a menos.
 */
export async function autorizarEnvioDeVideo(cursoId: string, nomeArquivo: string) {
  const { userId, role } = await exigir('gerenciar_aulas')
  const admin = createAdminClient()

  if (!cursoId) throw new Error('Curso não informado.')

  if (role !== 'admin') {
    const { count } = await admin
      .from('turmas')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', cursoId)
      .eq('professor_id', userId)
    if (!count) throw new Error('Este curso não está sob sua responsabilidade.')
  }

  const ext = (nomeArquivo.split('.').pop() ?? 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')
  return { videoPath: `${cursoId}/${crypto.randomUUID()}.${ext || 'mp4'}` }
}

/**
 * Registra a aula depois que o vídeo já subiu.
 * Recebe apenas texto curto, então passa folgado por qualquer limite.
 */
export async function registrarAulaEnviada(dados: {
  cursoId: string
  titulo: string
  descricao?: string
  videoPath: string
}) {
  const { userId, role } = await exigir('gerenciar_aulas')
  const admin = createAdminClient()

  const cursoId = dados.cursoId
  const titulo = dados.titulo?.trim()
  const descricao = dados.descricao?.trim()
  const videoPath = dados.videoPath

  if (!cursoId || !titulo) throw new Error('Informe o curso e o nome da aula.')
  if (!videoPath) throw new Error('O vídeo não chegou ao armazenamento.')

  // O caminho é sempre gerado pelo servidor como "<curso>/<id>.<ext>".
  // Conferimos de novo aqui para que ninguém consiga apontar uma aula
  // para um arquivo que está fora deste curso.
  if (!videoPath.startsWith(`${cursoId}/`)) {
    throw new Error('Caminho de vídeo inválido.')
  }

  if (role !== 'admin') {
    const { count } = await admin
      .from('turmas')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', cursoId)
      .eq('professor_id', userId)
    if (!count) throw new Error('Este curso não está sob sua responsabilidade.')
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
