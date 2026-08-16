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

/**
 * Conta o que será perdido junto com a turma.
 *
 * Serve para a tela de confirmação dizer exatamente o que vai sumir, em vez
 * de um "tem certeza?" genérico. Apagar turma é irreversível e leva junto
 * matrículas, encontros, presenças, avaliações, notas e atividades — a
 * pessoa merece ver esse tamanho antes de decidir.
 */
export async function resumoDaTurma(turmaId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const contar = async (tabela: string) => {
    const { count } = await admin
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq('turma_id', turmaId)
    return count ?? 0
  }

  const [alunos, encontros, avaliacoes, atividades] = await Promise.all([
    contar('turma_alunos'),
    contar('encontros'),
    contar('avaliacoes'),
    contar('atividades'),
  ])

  return { alunos, encontros, avaliacoes, atividades }
}

/**
 * Apaga a turma.
 *
 * As aulas NÃO são afetadas: elas pertencem ao curso, não à turma. Ou seja,
 * apagar uma turma de teste não destrói o conteúdo que já foi montado.
 */
export async function removerTurma(turmaId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin.from('turmas').delete().eq('id', turmaId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/admin/turmas')
  revalidatePath('/dashboard/professor')
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

/**
 * Gera uma senha provisória legível.
 *
 * Evita de propósito caracteres que se confundem ao ditar ou copiar à mão
 * (O/0, I/l/1). A senha é mostrada UMA vez a quem criou a conta e nunca mais
 * pode ser recuperada — o banco guarda só um resumo criptográfico dela, que
 * não tem volta. É por isso que o painel oferece "redefinir" e não "ver".
 */
function gerarSenhaProvisoria(): string {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const minusc = 'abcdefghijkmnpqrstuvwxyz'
  const nums = '23456789'
  const pega = (fonte: string, n: number) =>
    Array.from({ length: n }, () => fonte[Math.floor(Math.random() * fonte.length)]).join('')
  return `${pega(letras, 1)}${pega(minusc, 5)}${pega(nums, 3)}`
}

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
  return { id: created.user.id, senha: input.password }
}

export async function trocarSenha(userId: string, novaSenha?: string) {
  await requireAdmin()
  const admin = createAdminClient()

  // Sem senha informada, geramos uma provisória e devolvemos para a tela
  // mostrar. Como a senha antiga não é recuperável, "redefinir" é a única
  // ação possível quando alguém esquece.
  const senha = novaSenha?.trim() || gerarSenhaProvisoria()

  const { error } = await admin.auth.admin.updateUserById(userId, { password: senha })
  if (error) throw new Error(error.message)

  return { senha }
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

/**
 * Professor só mexe em curso que ele leciona em alguma turma;
 * admin mexe em qualquer um.
 */
async function garantirAcessoAoCurso(cursoId: string, userId: string, role: UserRole) {
  if (role === 'admin') return
  const admin = createAdminClient()
  const { count } = await admin
    .from('turmas')
    .select('id', { count: 'exact', head: true })
    .eq('curso_id', cursoId)
    .eq('professor_id', userId)

  if (!count) {
    throw new Error('Este curso não está sob sua responsabilidade.')
  }
}

function revalidarAulas(cursoId: string) {
  revalidatePath(`/dashboard/admin/cursos/${cursoId}`)
  revalidatePath(`/dashboard/professor/cursos/${cursoId}`)
  revalidatePath('/dashboard/aluno/cursos')
}

export async function criarAula(input: {
  curso_id: string
  titulo: string
  descricao?: string
  video_url?: string
  duracao_minutos?: number
}) {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoAoCurso(input.curso_id, user.id, role)
  const admin = createAdminClient()

  // Número da aula é sequencial dentro do curso (Aula 1, Aula 2, ...)
  const { data: ultima } = await admin
    .from('aulas')
    .select('numero')
    .eq('curso_id', input.curso_id)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await admin.from('aulas').insert({
    curso_id: input.curso_id,
    numero: (ultima?.numero ?? 0) + 1,
    titulo: input.titulo,
    descricao: input.descricao || null,
    video_url: input.video_url || null,
    duracao_minutos: input.duracao_minutos || null,
  })

  if (error) throw new Error(error.message)
  revalidarAulas(input.curso_id)
}

export async function atualizarAula(
  aulaId: string,
  cursoId: string,
  input: { titulo?: string; descricao?: string; video_url?: string; duracao_minutos?: number }
) {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoAoCurso(cursoId, user.id, role)
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
  revalidarAulas(cursoId)
}

export async function publicarAula(aulaId: string, cursoId: string, publicada: boolean) {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoAoCurso(cursoId, user.id, role)
  const admin = createAdminClient()

  const { error } = await admin
    .from('aulas')
    .update({ publicada, updated_at: new Date().toISOString() })
    .eq('id', aulaId)

  if (error) throw new Error(error.message)
  revalidarAulas(cursoId)
}

/** Troca a aula de posição com a vizinha, renumerando as duas. */
export async function moverAula(aulaId: string, cursoId: string, direcao: 'cima' | 'baixo') {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoAoCurso(cursoId, user.id, role)
  const admin = createAdminClient()

  const { data: aulas } = await admin
    .from('aulas')
    .select('id, numero')
    .eq('curso_id', cursoId)
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

  revalidarAulas(cursoId)
}

export async function removerAula(aulaId: string, cursoId: string) {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoAoCurso(cursoId, user.id, role)
  const admin = createAdminClient()

  const { error } = await admin.from('aulas').delete().eq('id', aulaId)
  if (error) throw new Error(error.message)

  revalidarAulas(cursoId)
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

// ============ CURSOS ============

const TIPOS_IMAGEM_CURSO = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const TAMANHO_MAXIMO_CAPA = 8 * 1024 * 1024

/** Faz upload da capa (se enviada) e devolve o caminho no storage. */
async function subirCapa(formData: FormData): Promise<string | null> {
  const file = formData.get('capa')
  if (!(file instanceof File) || file.size === 0) return null

  if (!TIPOS_IMAGEM_CURSO.includes(file.type)) {
    throw new Error('Capa em formato não suportado. Use JPG, PNG ou WEBP.')
  }
  if (file.size > TAMANHO_MAXIMO_CAPA) {
    throw new Error('A capa passa de 8 MB. Reduza o tamanho e tente de novo.')
  }

  const admin = createAdminClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const nome = `${crypto.randomUUID()}.${ext}`

  const { error } = await admin.storage
    .from('cursos')
    .upload(nome, file, { contentType: file.type, upsert: false })

  if (error) throw new Error(`Falha ao enviar a capa: ${error.message}`)
  return nome
}

export async function criarCurso(formData: FormData) {
  await requireAdmin()
  const admin = createAdminClient()

  const titulo = (formData.get('titulo') as string)?.trim()
  if (!titulo) throw new Error('Informe o nome do curso.')

  const capa = await subirCapa(formData)

  const { data: ultimo } = await admin
    .from('cursos')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await admin.from('cursos').insert({
    titulo,
    subtitulo: (formData.get('subtitulo') as string)?.trim() || null,
    descricao: (formData.get('descricao') as string)?.trim() || null,
    categoria: (formData.get('categoria') as string)?.trim() || null,
    nivel: (formData.get('nivel') as string) || 'iniciante',
    modalidade: (formData.get('modalidade') as string) || 'ead',
    cor: (formData.get('cor') as string) || 'esmeralda',
    carga_horaria: formData.get('carga_horaria')
      ? Number(formData.get('carga_horaria'))
      : null,
    capa_path: capa,
    ordem: (ultimo?.ordem ?? 0) + 1,
  })

  if (error) {
    if (capa) await admin.storage.from('cursos').remove([capa])
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/admin/cursos')
  revalidatePath('/')
}

export async function atualizarCurso(cursoId: string, formData: FormData) {
  await requireAdmin()
  const admin = createAdminClient()

  const capa = await subirCapa(formData)

  // Se trocou a capa, apaga a antiga para não acumular lixo no storage
  if (capa) {
    const { data: antigo } = await admin
      .from('cursos')
      .select('capa_path')
      .eq('id', cursoId)
      .single()
    if (antigo?.capa_path) {
      await admin.storage.from('cursos').remove([antigo.capa_path])
    }
  }

  const { error } = await admin
    .from('cursos')
    .update({
      titulo: (formData.get('titulo') as string)?.trim(),
      subtitulo: (formData.get('subtitulo') as string)?.trim() || null,
      descricao: (formData.get('descricao') as string)?.trim() || null,
      categoria: (formData.get('categoria') as string)?.trim() || null,
      nivel: (formData.get('nivel') as string) || 'iniciante',
      modalidade: (formData.get('modalidade') as string) || 'ead',
      cor: (formData.get('cor') as string) || 'esmeralda',
      carga_horaria: formData.get('carga_horaria')
        ? Number(formData.get('carga_horaria'))
        : null,
      ...(capa ? { capa_path: capa } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cursoId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/admin/cursos')
  revalidatePath(`/dashboard/admin/cursos/${cursoId}`)
  revalidatePath('/')
}

export async function publicarCurso(cursoId: string, publicado: boolean) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('cursos')
    .update({ publicado, updated_at: new Date().toISOString() })
    .eq('id', cursoId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/cursos')
  revalidatePath('/')
}

export async function removerCurso(cursoId: string) {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: curso } = await admin
    .from('cursos')
    .select('capa_path')
    .eq('id', cursoId)
    .single()

  const { error } = await admin.from('cursos').delete().eq('id', cursoId)
  if (error) throw new Error(error.message)

  if (curso?.capa_path) {
    await admin.storage.from('cursos').remove([curso.capa_path])
  }

  revalidatePath('/dashboard/admin/cursos')
  revalidatePath('/')
}

/** Liga uma turma a um curso — é o que define o conteúdo que a turma verá. */
export async function definirCursoDaTurma(turmaId: string, cursoId: string | null) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('turmas')
    .update({ curso_id: cursoId, updated_at: new Date().toISOString() })
    .eq('id', turmaId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/admin/turmas/${turmaId}`)
}

// ============ INSCRIÇÕES PÚBLICAS ============

/**
 * Aprova uma inscrição.
 *
 * É aqui que a pessoa passa a existir de verdade na plataforma: criamos o
 * perfil, e é o perfil que libera o login. A conta de acesso já existia
 * desde a inscrição, mas sem perfil ela não entrava em lugar nenhum.
 *
 * Se a pessoa escolheu uma turma, a matrícula sai junto — assim aprovar é
 * um clique só, e não "aprovar e depois lembrar de matricular".
 */
export async function aprovarInscricao(inscricaoId: string) {
  const quem = await requireAdmin()
  const admin = createAdminClient()

  const { data: inscricao, error: erroBusca } = await admin
    .from('inscricoes')
    .select('id, user_id, nome, email, papel, turma_id, status')
    .eq('id', inscricaoId)
    .single()

  if (erroBusca) throw new Error(erroBusca.message)
  if (!inscricao) throw new Error('Inscrição não encontrada.')
  if (inscricao.status !== 'pendente') throw new Error('Esta inscrição já foi decidida.')
  if (!inscricao.user_id) throw new Error('Esta inscrição não tem conta de acesso ligada.')

  const { error: erroPerfil } = await admin.from('users').insert({
    id: inscricao.user_id,
    email: inscricao.email,
    name: inscricao.nome,
    role: inscricao.papel,
  })
  if (erroPerfil) throw new Error(`Falha ao liberar o acesso: ${erroPerfil.message}`)

  // Matrícula automática na turma escolhida (só faz sentido para aluno).
  if (inscricao.turma_id && inscricao.papel === 'aluno') {
    await admin
      .from('turma_alunos')
      .insert({ turma_id: inscricao.turma_id, aluno_id: inscricao.user_id })
  }

  const { error: erroStatus } = await admin
    .from('inscricoes')
    .update({ status: 'aprovada', decidida_por: quem.id, decidida_em: new Date().toISOString() })
    .eq('id', inscricaoId)
  if (erroStatus) throw new Error(erroStatus.message)

  revalidatePath('/dashboard/admin/inscricoes')
  revalidatePath('/dashboard/admin/usuarios')
}

/**
 * Recusa uma inscrição e apaga a conta de acesso criada no cadastro.
 * Sem isso o e-mail ficaria preso: a pessoa não entraria e também não
 * conseguiria se inscrever de novo, porque o e-mail já estaria em uso.
 */
export async function recusarInscricao(inscricaoId: string, motivo?: string) {
  const quem = await requireAdmin()
  const admin = createAdminClient()

  const { data: inscricao } = await admin
    .from('inscricoes')
    .select('id, user_id, status')
    .eq('id', inscricaoId)
    .single()

  if (!inscricao) throw new Error('Inscrição não encontrada.')
  if (inscricao.status !== 'pendente') throw new Error('Esta inscrição já foi decidida.')

  const { error } = await admin
    .from('inscricoes')
    .update({
      status: 'recusada',
      motivo: motivo?.trim() || null,
      decidida_por: quem.id,
      decidida_em: new Date().toISOString(),
    })
    .eq('id', inscricaoId)
  if (error) throw new Error(error.message)

  if (inscricao.user_id) await admin.auth.admin.deleteUser(inscricao.user_id)

  revalidatePath('/dashboard/admin/inscricoes')
}

/** Abre ou fecha a turma para inscrição pública. */
export async function alternarInscricoesDaTurma(turmaId: string, abertas: boolean) {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('turmas')
    .update({ inscricoes_abertas: abertas })
    .eq('id', turmaId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/admin/inscricoes')
  revalidatePath('/dashboard/admin/turmas')
}

// ============ CAMPOS DA FICHA DE INSCRIÇÃO ============

/**
 * Cria uma pergunta na ficha de inscrição.
 *
 * É isto que tira a liderança da dependência de um desenvolvedor: incluir
 * "data de batismo" na ficha vira um cadastro, não uma alteração de sistema.
 */
export async function criarCampoInscricao(input: {
  rotulo: string
  ajuda?: string
  tipo: string
  opcoes?: string[]
  obrigatorio: boolean
  papel: 'aluno' | 'professor' | 'ambos'
}) {
  await requireAdmin()
  const admin = createAdminClient()

  const rotulo = input.rotulo?.trim()
  if (!rotulo) throw new Error('Escreva a pergunta.')
  if (input.tipo === 'selecao' && (!input.opcoes || input.opcoes.length < 2)) {
    throw new Error('Uma pergunta de escolha precisa de pelo menos duas opções.')
  }

  const { data: ultima } = await admin
    .from('campos_inscricao')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await admin.from('campos_inscricao').insert({
    rotulo,
    ajuda: input.ajuda?.trim() || null,
    tipo: input.tipo,
    opcoes: input.tipo === 'selecao' ? (input.opcoes ?? []) : [],
    obrigatorio: input.obrigatorio,
    papel: input.papel,
    ordem: (ultima?.ordem ?? 0) + 1,
    ativo: true,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/inscricoes/ficha')
  revalidatePath('/inscricao/aluno')
  revalidatePath('/inscricao/professor')
}

/** Liga ou desliga a pergunta sem apagá-la — o histórico fica preservado. */
export async function alternarCampoInscricao(campoId: string, ativo: boolean) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('campos_inscricao').update({ ativo }).eq('id', campoId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/inscricoes/ficha')
  revalidatePath('/inscricao/aluno')
  revalidatePath('/inscricao/professor')
}

export async function moverCampoInscricao(campoId: string, direcao: 'cima' | 'baixo') {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: campos } = await admin
    .from('campos_inscricao')
    .select('id, ordem')
    .order('ordem', { ascending: true })

  const lista = campos ?? []
  const i = lista.findIndex((c) => c.id === campoId)
  const j = direcao === 'cima' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return

  await admin.from('campos_inscricao').update({ ordem: lista[j].ordem }).eq('id', lista[i].id)
  await admin.from('campos_inscricao').update({ ordem: lista[i].ordem }).eq('id', lista[j].id)
  revalidatePath('/dashboard/admin/inscricoes/ficha')
  revalidatePath('/inscricao/aluno')
  revalidatePath('/inscricao/professor')
}

/**
 * Apaga a pergunta.
 *
 * As respostas já dadas NÃO somem: elas ficam guardadas na própria inscrição,
 * então quem se inscreveu antes continua com a ficha completa no histórico.
 */
export async function removerCampoInscricao(campoId: string) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('campos_inscricao').delete().eq('id', campoId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/inscricoes/ficha')
  revalidatePath('/inscricao/aluno')
  revalidatePath('/inscricao/professor')
}

// ============ LUMI — NOVIDADES ============

export async function criarNovidade(input: {
  titulo: string
  descricao?: string
  tipo: 'novidade' | 'melhoria' | 'correcao' | 'aviso'
  publico: 'todos' | 'aluno' | 'professor' | 'admin'
}) {
  await requireAdmin()
  const admin = createAdminClient()

  const titulo = input.titulo?.trim()
  if (!titulo) throw new Error('Escreva o título da novidade.')

  const { error } = await admin.from('novidades').insert({
    titulo,
    descricao: input.descricao?.trim() || null,
    tipo: input.tipo,
    publico: input.publico,
    publicada: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/lumi')
}

export async function alternarNovidade(id: string, publicada: boolean) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('novidades').update({ publicada }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/lumi')
}

export async function removerNovidade(id: string) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('novidades').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/lumi')
}

/**
 * Reapresenta a saudação de hoje para todo mundo.
 *
 * Serve para quando a novidade é escrita DEPOIS que as pessoas já entraram:
 * sem isso, elas só veriam o aviso amanhã. Limpar o marcador do dia faz a
 * LUMI saudar de novo no próximo carregamento.
 */
export async function reenviarSaudacaoDeHoje() {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('lumi_leitura')
    .update({ ultima_saudacao: null })
    .not('user_id', 'is', null)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/lumi')
}

// ============ BLOCOS DA PÁGINA INICIAL ============

const TIPOS_IMAGEM_SITE = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/** Sobe a foto do bloco, quando houver. Devolve o caminho salvo. */
async function subirImagemDoSite(formData: FormData): Promise<string | null> {
  const arquivo = formData.get('imagem')
  if (!(arquivo instanceof File) || arquivo.size === 0) return null
  if (!TIPOS_IMAGEM_SITE.includes(arquivo.type)) {
    throw new Error('Formato de imagem não suportado. Use JPG, PNG ou WEBP.')
  }
  if (arquivo.size > 4 * 1024 * 1024) {
    throw new Error('A imagem passa de 4 MB. Reduza o tamanho e tente de novo.')
  }

  const admin = createAdminClient()
  const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'jpg'
  const caminho = `blocos/${crypto.randomUUID()}.${ext}`
  const { error } = await admin.storage
    .from('site')
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
  if (error) throw new Error(`Falha ao enviar a imagem: ${error.message}`)
  return caminho
}

export async function salvarBlocoSite(formData: FormData) {
  await requireAdmin()
  const admin = createAdminClient()

  const id = (formData.get('id') as string) || null
  const titulo = (formData.get('titulo') as string)?.trim()
  if (!titulo) throw new Error('Escreva o título da seção.')

  const imagem = await subirImagemDoSite(formData)

  const dados = {
    titulo,
    subtitulo: (formData.get('subtitulo') as string)?.trim() || null,
    texto: (formData.get('texto') as string)?.trim() || null,
    layout: (formData.get('layout') as string) || 'texto_imagem',
    updated_at: new Date().toISOString(),
    ...(imagem ? { imagem_path: imagem } : {}),
  }

  if (id) {
    // Trocou a foto? A antiga sai do armazenamento para não virar lixo.
    if (imagem) {
      const { data: antigo } = await admin
        .from('blocos_site')
        .select('imagem_path')
        .eq('id', id)
        .single()
      if (antigo?.imagem_path) await admin.storage.from('site').remove([antigo.imagem_path])
    }
    const { error } = await admin.from('blocos_site').update(dados).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { data: ultimo } = await admin
      .from('blocos_site')
      .select('ordem')
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { error } = await admin
      .from('blocos_site')
      .insert({ ...dados, ordem: (ultimo?.ordem ?? 0) + 1, publicado: true })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/dashboard/admin/site')
  revalidatePath('/')
}

export async function alternarBlocoSite(id: string, publicado: boolean) {
  await requireAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('blocos_site').update({ publicado }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/site')
  revalidatePath('/')
}

export async function moverBlocoSite(id: string, direcao: 'cima' | 'baixo') {
  await requireAdmin()
  const admin = createAdminClient()
  const { data: blocos } = await admin
    .from('blocos_site')
    .select('id, ordem')
    .order('ordem', { ascending: true })

  const lista = blocos ?? []
  const i = lista.findIndex((b) => b.id === id)
  const j = direcao === 'cima' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return

  await admin.from('blocos_site').update({ ordem: lista[j].ordem }).eq('id', lista[i].id)
  await admin.from('blocos_site').update({ ordem: lista[i].ordem }).eq('id', lista[j].id)
  revalidatePath('/dashboard/admin/site')
  revalidatePath('/')
}

export async function removerBlocoSite(id: string) {
  await requireAdmin()
  const admin = createAdminClient()
  const { data: bloco } = await admin
    .from('blocos_site')
    .select('imagem_path')
    .eq('id', id)
    .single()

  const { error } = await admin.from('blocos_site').delete().eq('id', id)
  if (error) throw new Error(error.message)
  if (bloco?.imagem_path) await admin.storage.from('site').remove([bloco.imagem_path])

  revalidatePath('/dashboard/admin/site')
  revalidatePath('/')
}
