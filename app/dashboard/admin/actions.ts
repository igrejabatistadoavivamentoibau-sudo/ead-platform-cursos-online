'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolverPermissoes, type ChavePermissao, type UserRole } from '@/lib/permissoes'
import { lerMatriz, conferirMatriz } from '@/lib/nucleo/matrizCurricular'

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
  /** O módulo a que esta turma pertence. É ele que traz o curso junto. */
  modulo_id?: string
  modalidade?: 'presencial' | 'ead'
}): Promise<Resultado> {
  return tentar(async () => {
  await requireAdmin()
  const admin = createAdminClient()

  /* A turma pertence ao MÓDULO, não ao curso. É isso que permite "várias
     turmas de primeiro módulo, várias de segundo". O `curso_id` é
     preenchido sozinho pelo banco a partir do módulo — a coluna continua
     existindo para o código antigo não quebrar durante a publicação. */
  const { error } = await admin.from('turmas').insert({
    nome: input.nome,
    descricao: input.descricao || null,
    professor_id: input.professor_id || null,
    data_inicio: input.data_inicio || null,
    modulo_id: input.modulo_id || null,
    modalidade: input.modalidade ?? 'ead',
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/admin/turmas')
  })
}

/**
 * Ajusta módulo e modalidade de uma turma que já existe.
 *
 * Separado de `definirCursoDaTurma` de propósito: aquela função dizia a
 * que CURSO a turma pertence, e agora quem responde por isso é o módulo.
 * Ela continua existindo para não quebrar chamada antiga, mas o caminho
 * novo é este.
 */
export async function definirModuloDaTurma(
  turmaId: string,
  input: { modulo_id: string | null; modalidade?: 'presencial' | 'ead' }
): Promise<Resultado> {
  return tentar(async () => {
    await requireAdmin()
    const admin = createAdminClient()

    const { error } = await admin
      .from('turmas')
      .update({
        modulo_id: input.modulo_id,
        ...(input.modalidade ? { modalidade: input.modalidade } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', turmaId)
    if (error) throw new Error(error.message)

    revalidatePath(`/dashboard/admin/turmas/${turmaId}`)
    revalidatePath('/dashboard/admin/turmas')
  })
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

/**
 * Confere o pré-requisito do módulo, sem matricular ninguém.
 *
 * A tela chama isto ANTES de mostrar o botão, para poder explicar o
 * motivo em vez de só recusar. "Ainda está cursando o Módulo 1" e
 * "reprovado no Módulo 1" levam a decisões diferentes de quem está
 * matriculando.
 */
export async function conferirPreRequisito(turmaId: string, alunoId: string) {
  await requireAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('pode_entrar_no_modulo', {
    p_aluno: alunoId,
    p_turma: turmaId,
  })
  if (error) throw new Error(error.message)
  const linha = Array.isArray(data) ? data[0] : data
  return {
    pode: linha?.pode !== false,
    motivo: (linha?.motivo as string) ?? null,
  }
}

/**
 * Matricula, respeitando a regra dos módulos.
 *
 * A REGRA, E A EXCEÇÃO QUE ELA PRECISA TER
 * Só entra numa turma do Módulo 2 quem foi aprovado no Módulo 1. Mas a
 * escola é de gente, não de planilha: existe o aluno que veio
 * transferido, o que cursou o módulo antes da plataforma existir, o que
 * a coordenação decidiu adiantar. Uma regra sem porta de exceção vira
 * uma regra que alguém contorna por fora — e aí ela não vale nada.
 *
 * Então o administrador pode passar por cima, mas de forma explícita e
 * registrada: `ignorarPreRequisito` só chega aqui se ele tiver confirmado
 * na tela, e o motivo fica gravado na matrícula.
 */
export async function matricularAluno(
  turmaId: string,
  alunoId: string,
  opcoes?: { ignorarPreRequisito?: boolean; motivo?: string }
) {
  await requireAdmin()
  const admin = createAdminClient()

  if (!opcoes?.ignorarPreRequisito) {
    const r = await conferirPreRequisito(turmaId, alunoId)
    if (!r.pode) throw new Error(r.motivo ?? 'Este aluno não cumpre o pré-requisito do módulo.')
  }

  const { error } = await admin.from('turma_alunos').insert({
    turma_id: turmaId,
    aluno_id: alunoId,
    ...(opcoes?.ignorarPreRequisito
      ? {
          observacao_conclusao:
            'Matriculado sem o pré-requisito do módulo pela coordenação.' +
            (opcoes.motivo ? ` Motivo: ${opcoes.motivo}` : ''),
        }
      : {}),
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/admin/turmas/${turmaId}`)
  revalidatePath('/dashboard/admin/repetentes')
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

/* ============================================================
   TIRAR ALGUÉM DA PLATAFORMA

   São duas coisas diferentes, e tratá-las como uma só seria errado nos
   dois sentidos:

   DESATIVAR é o caso comum — a pessoa saiu da igreja, trancou, parou de
   estudar. Ela perde o acesso e some das listas, mas o que ela fez
   continua existindo: nota lançada, presença, trabalho entregue,
   certificado. É reversível, e é o que a escola vai usar quase sempre.

   EXCLUIR é o caso raro — cadastro errado, duplicado, ou pedido formal de
   remoção de dados. Apaga a pessoa e tudo o que está pendurado nela.

   As duas travas que importam moram no BANCO (migração 024), não aqui:
   ninguém consegue apagar, desativar ou rebaixar o último administrador
   ativo. Tela se contorna pelo console do navegador; gatilho, não.
   ============================================================ */

/** Suspensão longa no serviço de autenticação. Cem anos é o "para sempre" que a API aceita. */
const SUSPENSAO = '876000h'

/* ============================================================
   POR QUE ESTAS AÇÕES DEVOLVEM O ERRO EM VEZ DE LANÇÁ-LO

   Descobri isto testando: quando uma ação de servidor LANÇA um erro, o
   Next, na versão publicada, apaga a mensagem antes de ela chegar ao
   navegador — por segurança, para não vazar detalhe interno. A pessoa
   recebe no lugar um parágrafo em inglês dizendo que "ocorreu um erro no
   render dos Server Components".

   Ou seja: toda frase cuidadosamente escrita aqui ("digite o nome
   exatamente como está", "esta é a única conta de administrador") só
   aparece durante o desenvolvimento. Em produção, a pessoa vê o
   parágrafo em inglês. Em desenvolvimento tudo parece certo, e é por isso
   que isso passa despercebido.

   Então estas ações DEVOLVEM o resultado — sucesso ou motivo — em vez de
   lançar. A mensagem é dado, e dado atravessa.
   ============================================================ */

export type Resultado<T = unknown> = ({ ok: true } & (T extends object ? T : object)) | { ok: false; erro: string }

const motivo = (e: unknown, padrao: string) =>
  e instanceof Error && e.message ? e.message : padrao

/**
 * Embrulha uma ação inteira e devolve o motivo em vez de lançá-lo.
 *
 * Existe para não reescrever quinze funções no estilo vai-e-vem de
 * `if (error) return { ok: false }`. O corpo continua escrito de forma
 * direta, com `throw` onde a regra é violada; o que muda é o que atravessa
 * a fronteira do servidor para o navegador — que passa a ser dado, e não
 * exceção. Exceção o Next apaga em produção; dado atravessa.
 *
 * Cuidado deliberado: `redirect()` e `notFound()` do Next funcionam
 * LANÇANDO. Nenhuma ação embrulhada aqui os usa, e nenhuma deve passar a
 * usar — o desvio viraria uma mensagem de erro na tela.
 */
async function tentar<T extends object = Record<string, never>>(
  corpo: () => Promise<T | void>,
  padrao = 'Não consegui salvar. Tente de novo.'
): Promise<Resultado<T>> {
  try {
    const extra = await corpo()
    return { ok: true, ...(extra ?? {}) } as Resultado<T>
  } catch (e) {
    return { ok: false, erro: motivo(e, padrao) }
  }
}

export async function definirAtivoDoUsuario(
  userId: string,
  ativo: boolean
): Promise<Resultado> {
  let quemMexe
  try {
    quemMexe = await requireAdmin()
  } catch (e) {
    return { ok: false, erro: motivo(e, 'Apenas administradores podem fazer isso.') }
  }
  const admin = createAdminClient()

  if (userId === quemMexe.id && !ativo) {
    return { ok: false, erro: 'Você não pode desativar a própria conta — ficaria de fora na hora.' }
  }

  /* A ordem importa. Primeiro o perfil, porque é ele que carrega a trava do
     último administrador: se a mudança for recusada, nada foi suspenso e a
     pessoa continua entrando normalmente. Suspender antes e falhar depois
     deixaria alguém trancado do lado de fora sem estar desativado. */
  const { error } = await admin
    .from('users')
    .update({
      ativo,
      desativado_em: ativo ? null : new Date().toISOString(),
      desativado_por: ativo ? null : quemMexe.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) return { ok: false, erro: error.message }

  const { error: erroAuth } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: ativo ? 'none' : SUSPENSAO,
  })

  if (erroAuth) {
    // Desfaz para as duas metades não discordarem: perfil dizendo uma coisa
    // e o login fazendo outra é pior do que a operação não ter acontecido.
    await admin.from('users').update({ ativo: !ativo }).eq('id', userId)
    return {
      ok: false,
      erro: `Não consegui ${ativo ? 'reativar' : 'suspender'} o acesso: ${erroAuth.message}`,
    }
  }

  revalidatePath('/dashboard/admin/usuarios')
  return { ok: true }
}

export interface ResumoDoUsuario {
  notas: number
  presencas: number
  entregas: number
  certificados: number
  matriculas: number
  turmas_como_professor: number
  mensagens: number
  anotacoes_biblia: number
  paginas_caderno: number
  aulas_assistidas: number
}

const NADA: ResumoDoUsuario = {
  notas: 0,
  presencas: 0,
  entregas: 0,
  certificados: 0,
  matriculas: 0,
  turmas_como_professor: 0,
  mensagens: 0,
  anotacoes_biblia: 0,
  paginas_caderno: 0,
  aulas_assistidas: 0,
}

/** O que seria apagado junto. A tela mostra isto ANTES de perguntar se pode. */
export async function resumoDoUsuario(
  userId: string
): Promise<Resultado<{ resumo: ResumoDoUsuario }>> {
  try {
    await requireAdmin()
  } catch (e) {
    return { ok: false, erro: motivo(e, 'Apenas administradores podem fazer isso.') }
  }
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('resumo_do_usuario', { p_id: userId })
  if (error) return { ok: false, erro: error.message }

  const linha = (Array.isArray(data) ? data[0] : data) as ResumoDoUsuario | undefined
  return { ok: true, resumo: linha ?? NADA }
}

/** Compara ignorando acento, maiúscula e espaço sobrando. */
const mesmoNome = (a: string, b: string) => {
  const limpar = (x: string) =>
    x
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  return limpar(a) === limpar(b)
}

export async function excluirUsuario(
  userId: string,
  confirmacao: string
): Promise<Resultado<{ nome: string }>> {
  let quemMexe
  try {
    quemMexe = await requireAdmin()
  } catch (e) {
    return { ok: false, erro: motivo(e, 'Apenas administradores podem fazer isso.') }
  }
  const admin = createAdminClient()

  if (userId === quemMexe.id) {
    return { ok: false, erro: 'Você não pode excluir a própria conta.' }
  }

  const { data: pessoa } = await admin
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .maybeSingle()

  if (!pessoa) return { ok: false, erro: 'Esta pessoa já não existe mais.' }

  /* A confirmação é conferida AQUI, e não só na tela. O nome digitado é a
     única parte deste fluxo que exige a pessoa parar e ler quem ela está
     apagando — e uma conferência que mora só no navegador não é
     conferência nenhuma. */
  if (!mesmoNome(confirmacao ?? '', pessoa.name as string)) {
    return {
      ok: false,
      erro: `Para confirmar, digite o nome exatamente como está: "${pessoa.name}".`,
    }
  }

  /* Primeiro o acesso, depois os dados.
     Se a segunda parte falhar, a pessoa já está fora — que é o essencial —
     e a tela ainda mostra o cadastro, então dá para tentar de novo. Na
     ordem inversa, uma falha deixaria uma conta capaz de entrar sem perfil
     nenhum: invisível no painel e difícil de perceber. */
  const { error: erroAuth } = await admin.auth.admin.deleteUser(userId)
  if (erroAuth && !/not\s*found/i.test(erroAuth.message)) {
    return { ok: false, erro: `Não consegui remover o acesso: ${erroAuth.message}` }
  }

  const { error } = await admin.from('users').delete().eq('id', userId)
  if (error) return { ok: false, erro: error.message }

  /* Os arquivos que a pessoa enviou não somem sozinhos: o banco apaga a
     LINHA que aponta para o arquivo, e o arquivo continua ocupando espaço
     no armazenamento. Numa exclusão a pedido da pessoa, deixar as fotos dos
     trabalhos dela para trás seria não ter excluído. */
  const { data: arquivos } = await admin.storage.from('entregas').list(userId)
  if (arquivos?.length) {
    await admin.storage.from('entregas').remove(arquivos.map((a) => `${userId}/${a.name}`))
  }

  revalidatePath('/dashboard/admin/usuarios')
  return { ok: true, nome: pessoa.name as string }
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

/**
 * O módulo em que a aula vai entrar.
 *
 * Existe porque a aula deixou de pertencer ao curso e passou a pertencer ao
 * MÓDULO (migração 022) — e as duas telas de criar aula continuaram gravando
 * só o curso. A aula era criada, aparecia para o professor e **não existia
 * para o aluno**, porque a tela dele monta o curso a partir dos módulos.
 * Nenhum erro na tela; uma aula que "sumiu".
 *
 * Confere que o módulo escolhido é deste curso: o id chega do navegador, e
 * sem essa conferência daria para pendurar uma aula no curso de outra pessoa.
 * Sem escolha, cai no primeiro módulo — que é o certo para escola de um
 * módulo só, que é a maioria.
 */
async function moduloDaAula(
  admin: ReturnType<typeof createAdminClient>,
  cursoId: string,
  moduloId?: string
): Promise<string | null> {
  if (moduloId) {
    const { data } = await admin
      .from('modulos')
      .select('id')
      .eq('id', moduloId)
      .eq('curso_id', cursoId)
      .maybeSingle()
    if (!data) throw new Error('Este módulo não é deste curso.')
    return data.id as string
  }

  const { data } = await admin
    .from('modulos')
    .select('id')
    .eq('curso_id', cursoId)
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Null é aceitável: o gatilho `aula_entra_num_modulo` resolve no banco.
  return (data?.id as string) ?? null
}

/** O próximo número livre DENTRO do módulo — a contagem é por módulo. */
async function proximoNumeroDaAula(
  admin: ReturnType<typeof createAdminClient>,
  moduloId: string | null
) {
  if (!moduloId) return undefined
  const { data } = await admin
    .from('aulas')
    .select('numero')
    .eq('modulo_id', moduloId)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (Number(data?.numero) || 0) + 1
}

export async function criarAula(input: {
  curso_id: string
  modulo_id?: string
  /** Onde a aula vai morar de verdade. Quando vem, manda nela. */
  disciplina_id?: string
  titulo: string
  descricao?: string
  video_url?: string
  duracao_minutos?: number
}): Promise<Resultado> {
  return tentar(async () => {
    const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
    await garantirAcessoAoCurso(input.curso_id, user.id, role)
    const admin = createAdminClient()

    const moduloId = input.disciplina_id
      ? undefined
      : await moduloDaAula(admin, input.curso_id, input.modulo_id)

    /* O NÚMERO NÃO É MAIS CALCULADO AQUI, e isso é uma correção.
       A conta antiga era "o maior número deste MÓDULO mais um" — com
       disciplinas, a segunda matéria começaria na aula 11. Quem numera
       agora é o gatilho `aula_entra_numa_disciplina` (migração 030), que
       conta dentro da disciplina. Uma regra, um lugar: a versão anterior
       tinha a mesma conta escrita aqui e no banco, e duas cópias de uma
       conta divergem no dia em que alguém corrige só uma. */
    const { error } = await admin.from('aulas').insert({
      curso_id: input.curso_id,
      ...(moduloId ? { modulo_id: moduloId } : {}),
      ...(input.disciplina_id ? { disciplina_id: input.disciplina_id } : {}),
      titulo: input.titulo,
      descricao: input.descricao || null,
      video_url: input.video_url || null,
      duracao_minutos: input.duracao_minutos || null,
    })

    if (error) throw new Error(error.message)
    revalidarAulas(input.curso_id)
  })
}

export async function atualizarAula(
  aulaId: string,
  cursoId: string,
  input: { titulo?: string; descricao?: string; video_url?: string; duracao_minutos?: number }
): Promise<Resultado> {
  return tentar(async () => {
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
  })
}

export async function publicarAula(
  aulaId: string,
  cursoId: string,
  publicada: boolean
): Promise<Resultado> {
  return tentar(async () => {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoAoCurso(cursoId, user.id, role)
  const admin = createAdminClient()

  const { error } = await admin
    .from('aulas')
    .update({ publicada, updated_at: new Date().toISOString() })
    .eq('id', aulaId)

  if (error) throw new Error(error.message)
  revalidarAulas(cursoId)
  })
}

/** Troca a aula de posição com a vizinha, renumerando as duas. */
export async function moverAula(
  aulaId: string,
  cursoId: string,
  direcao: 'cima' | 'baixo'
): Promise<Resultado> {
  return tentar(async () => {
  const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
  await garantirAcessoAoCurso(cursoId, user.id, role)
  const admin = createAdminClient()

  /* A ordem é DENTRO DO MÓDULO, não do curso.
     Antes esta consulta trazia o curso inteiro. Com módulos, a lista vinha
     embaralhada (Aula 1 do Módulo 1, Aula 1 do Módulo 2, Aula 2 do Módulo
     1...) e a seta trocava o número de uma aula do Módulo 1 com o de uma do
     Módulo 2 — bagunçando os dois de uma vez, ou esbarrando no índice que
     exige número único por módulo. */
  const { data: aula } = await admin
    .from('aulas')
    .select('modulo_id')
    .eq('id', aulaId)
    .maybeSingle()

  const consulta = admin.from('aulas').select('id, numero')
  const { data: aulas } = await (aula?.modulo_id
    ? consulta.eq('modulo_id', aula.modulo_id)
    : consulta.eq('curso_id', cursoId).is('modulo_id', null)
  ).order('numero', { ascending: true })

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
  })
}

export async function removerAula(aulaId: string, cursoId: string): Promise<Resultado> {
  return tentar(async () => {
    const { user, role } = await exigirPermissaoAction('gerenciar_aulas')
    await garantirAcessoAoCurso(cursoId, user.id, role)
    const admin = createAdminClient()

    const { error } = await admin.from('aulas').delete().eq('id', aulaId)
    if (error) throw new Error(error.message)

    revalidarAulas(cursoId)
  })
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

  // Boas-vindas registradas: é a primeira notificação que a pessoa vê.
  await admin.from('notificacoes').insert({
    user_id: inscricao.user_id,
    titulo: 'Sua inscrição foi aprovada. Seja bem-vindo(a)!',
    corpo: 'Seu acesso à Escola de Líderes está liberado. Bons estudos!',
    tipo: 'inscricao',
  })

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

  // A novidade também entra na central de notificações de quem interessa,
  // para ficar registrada além do cartão do dia da LUMI.
  const consultaPublico = admin.from('users').select('id')
  const { data: destinatarios } =
    input.publico === 'todos' ? await consultaPublico : await consultaPublico.eq('role', input.publico)

  if (destinatarios && destinatarios.length > 0) {
    await admin.from('notificacoes').insert(
      destinatarios.map((u) => ({
        user_id: u.id,
        titulo,
        corpo: input.descricao?.trim() || null,
        tipo: 'novidade',
      }))
    )
  }

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

// ============ MÓDULOS DO CURSO ============

/* ============================================================
   OS MÓDULOS

   "Curso é escola de líderes, mas posso ter várias turmas de primeiro
   módulo, várias de segundo." É essa a forma: o curso é o programa
   inteiro, o módulo é a etapa, e a turma é um grupo de gente fazendo uma
   etapa numa época.

   Tudo aqui é editável pela coordenação — criar, renomear, reordenar,
   apagar, mover aula de um módulo para outro. É o que foi pedido, e com
   razão: estrutura de curso muda, e ter que pedir para alguém mexer no
   código a cada mudança é o que faz a plataforma virar um estorvo.
   ============================================================ */

export async function criarModulo(
  cursoId: string,
  input: { nome: string; descricao?: string }
): Promise<Resultado> {
  return tentar(async () => {
    await requireAdmin()
    const admin = createAdminClient()

    const nome = input.nome?.trim()
    if (!nome) throw new Error('Dê um nome para o módulo.')

    const { data: ultimo } = await admin
      .from('modulos')
      .select('ordem')
      .eq('curso_id', cursoId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error } = await admin.from('modulos').insert({
      curso_id: cursoId,
      nome,
      descricao: input.descricao?.trim() || null,
      ordem: (ultimo?.ordem ?? 0) + 1,
    })
    if (error) throw new Error(error.message)

    revalidatePath(`/dashboard/admin/cursos/${cursoId}`)
  })
}

export async function renomearModulo(
  moduloId: string,
  cursoId: string,
  input: { nome: string; descricao?: string }
): Promise<Resultado> {
  return tentar(async () => {
    await requireAdmin()
    const admin = createAdminClient()

    const nome = input.nome?.trim()
    if (!nome) throw new Error('Dê um nome para o módulo.')

    const { error } = await admin
      .from('modulos')
      .update({
        nome,
        descricao: input.descricao?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', moduloId)
      .eq('curso_id', cursoId)
    if (error) throw new Error(error.message)

    revalidatePath(`/dashboard/admin/cursos/${cursoId}`)
  })
}

/**
 * Troca de lugar com o vizinho.
 *
 * A ordem não é enfeite: é ela que decide o pré-requisito. Mover o
 * Módulo 3 para a segunda posição muda quem pode entrar em quê — por
 * isso a troca é sempre com o vizinho, uma casa por vez, e não um campo
 * numérico livre onde é fácil digitar 7 sem querer e reescrever o curso.
 */
export async function moverModulo(
  moduloId: string,
  cursoId: string,
  direcao: 'cima' | 'baixo'
): Promise<Resultado> {
  return tentar(async () => {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: modulos } = await admin
    .from('modulos')
    .select('id, ordem')
    .eq('curso_id', cursoId)
    .order('ordem', { ascending: true })

  const lista = modulos ?? []
  const i = lista.findIndex((m) => m.id === moduloId)
  if (i < 0) throw new Error('Módulo não encontrado.')
  const j = direcao === 'cima' ? i - 1 : i + 1
  if (j < 0 || j >= lista.length) return

  /* A ordem tem índice único junto com o curso? Não tem — mas mesmo assim
     a troca passa por um valor de passagem (-1). Sem isso, o primeiro
     UPDATE deixaria dois módulos com a mesma ordem por um instante, e
     qualquer leitura concorrente veria a lista fora de ordem. */
  const a = lista[i]
  const b = lista[j]
  await admin.from('modulos').update({ ordem: -1 }).eq('id', a.id)
  await admin.from('modulos').update({ ordem: a.ordem }).eq('id', b.id)
  await admin.from('modulos').update({ ordem: b.ordem }).eq('id', a.id)

  revalidatePath(`/dashboard/admin/cursos/${cursoId}`)
  })
}

/**
 * Apaga um módulo.
 *
 * Apagar leva junto as AULAS do módulo (é o que o banco faz em cascata) e
 * deixa as TURMAS sem módulo — não apaga turma nenhuma, porque turma tem
 * aluno, nota e presença dentro. Por isso a conferência antes: se houver
 * turma pendurada, a função recusa e diz quantas são, em vez de deixar
 * um rastro de turmas órfãs que ninguém entende depois.
 */
export async function removerModulo(moduloId: string, cursoId: string): Promise<Resultado> {
  return tentar(async () => {
  await requireAdmin()
  const admin = createAdminClient()

  const [{ count: turmas }, { count: aulas }] = await Promise.all([
    admin.from('turmas').select('id', { count: 'exact', head: true }).eq('modulo_id', moduloId),
    admin.from('aulas').select('id', { count: 'exact', head: true }).eq('modulo_id', moduloId),
  ])

  if (turmas && turmas > 0) {
    throw new Error(
      `Este módulo tem ${turmas} ${turmas === 1 ? 'turma' : 'turmas'}. Mova ${turmas === 1 ? 'ela' : 'elas'} para outro módulo antes de apagar.`
    )
  }
  if (aulas && aulas > 0) {
    throw new Error(
      `Este módulo tem ${aulas} ${aulas === 1 ? 'aula' : 'aulas'}. Mova ou apague ${aulas === 1 ? 'ela' : 'elas'} antes.`
    )
  }

  const { error } = await admin.from('modulos').delete().eq('id', moduloId).eq('curso_id', cursoId)
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/admin/cursos/${cursoId}`)
  })
}

/** Move uma aula para outro módulo do mesmo curso. */
export async function moverAulaDeModulo(
  aulaId: string,
  cursoId: string,
  moduloId: string
): Promise<Resultado> {
  return tentar(async () => {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: modulo } = await admin
    .from('modulos')
    .select('id, curso_id')
    .eq('id', moduloId)
    .maybeSingle()
  if (!modulo || modulo.curso_id !== cursoId) {
    throw new Error('Este módulo não pertence a este curso.')
  }

  /* O número da aula é único DENTRO do módulo. Chegando num módulo que já
     tem uma aula com aquele número, o banco recusaria — então a aula
     entra no fim da fila do destino. Sem isto, mover a Aula 1 do Módulo 1
     para o Módulo 2 daria um erro de banco cru na cara da pessoa. */
  const { data: ultima } = await admin
    .from('aulas')
    .select('numero')
    .eq('modulo_id', moduloId)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await admin
    .from('aulas')
    .update({
      modulo_id: moduloId,
      numero: (ultima?.numero ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', aulaId)
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/admin/cursos/${cursoId}`)
  revalidatePath(`/dashboard/professor/cursos/${cursoId}`)
  })
}

/* ============================================================
   A MATRIZ CURRICULAR

   Módulo → disciplina → aula, montada de uma vez a partir do texto que a
   coordenação escreve (ver lib/nucleo/matrizCurricular.ts, onde mora a
   leitura e onde ela é testada).

   AQUI NÃO SE DECIDE NADA sobre o que é módulo, disciplina ou aula: isso
   já veio pronto e conferido. Aqui só se grava, na ordem certa, e se
   devolve o que foi criado.
   ============================================================ */

export async function criarDisciplina(
  cursoId: string,
  moduloId: string,
  input: { nome: string; descricao?: string }
): Promise<Resultado> {
  return tentar(async () => {
    await requireAdmin()
    const admin = createAdminClient()

    const nome = input.nome?.trim()
    if (!nome) throw new Error('Dê um nome para a disciplina.')

    const { data: ultima } = await admin
      .from('disciplinas')
      .select('ordem')
      .eq('modulo_id', moduloId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error } = await admin.from('disciplinas').insert({
      modulo_id: moduloId,
      nome,
      descricao: input.descricao?.trim() || null,
      ordem: (ultima?.ordem ?? 0) + 1,
    })
    if (error) throw new Error(error.message)
    revalidarAulas(cursoId)
  })
}

export async function renomearDisciplina(
  disciplinaId: string,
  cursoId: string,
  input: { nome: string; descricao?: string }
): Promise<Resultado> {
  return tentar(async () => {
    await requireAdmin()
    const admin = createAdminClient()

    const nome = input.nome?.trim()
    if (!nome) throw new Error('Dê um nome para a disciplina.')

    /* Dar nome próprio à disciplina automática tira a marca de "padrão":
       a partir daí ela é uma matéria de verdade, e a tela passa a mostrar
       o degrau. É a pessoa dizendo, com o gesto, que o curso tem
       disciplinas. */
    const { error } = await admin
      .from('disciplinas')
      .update({
        nome,
        descricao: input.descricao?.trim() || null,
        padrao: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', disciplinaId)
    if (error) throw new Error(error.message)
    revalidarAulas(cursoId)
  })
}

export async function moverDisciplina(
  disciplinaId: string,
  cursoId: string,
  direcao: 'cima' | 'baixo'
): Promise<Resultado> {
  return tentar(async () => {
    await requireAdmin()
    const admin = createAdminClient()

    const { data: atual } = await admin
      .from('disciplinas')
      .select('id, modulo_id, ordem')
      .eq('id', disciplinaId)
      .maybeSingle()
    if (!atual) throw new Error('Disciplina não encontrada.')

    /* A troca é DENTRO do módulo. Ordenar pelo curso inteiro faria a
       primeira disciplina de um módulo trocar de lugar com a última do
       módulo anterior — foi exatamente o vício que `moverAula` tinha
       antes da entrega dos módulos. */
    const { data: irmas } = await admin
      .from('disciplinas')
      .select('id, ordem')
      .eq('modulo_id', atual.modulo_id)
      .order('ordem', { ascending: true })

    const lista = irmas ?? []
    const i = lista.findIndex((d) => d.id === disciplinaId)
    const j = direcao === 'cima' ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= lista.length) return

    await admin.from('disciplinas').update({ ordem: lista[j].ordem }).eq('id', lista[i].id)
    await admin.from('disciplinas').update({ ordem: lista[i].ordem }).eq('id', lista[j].id)
    revalidarAulas(cursoId)
  })
}

export async function removerDisciplina(
  disciplinaId: string,
  cursoId: string
): Promise<Resultado> {
  return tentar(async () => {
    await requireAdmin()
    const admin = createAdminClient()

    const { count } = await admin
      .from('aulas')
      .select('id', { count: 'exact', head: true })
      .eq('disciplina_id', disciplinaId)

    /* Apagar a disciplina leva as aulas dela junto (o banco faz isso em
       cascata). Recusar quando há aula dentro é de propósito: um clique
       não pode levar dez aulas com vídeo e material anexados. */
    if ((count ?? 0) > 0) {
      throw new Error(
        `Esta disciplina tem ${count} ${count === 1 ? 'aula' : 'aulas'}. Mova ou apague as aulas antes.`
      )
    }

    const { data: quantas } = await admin
      .from('disciplinas')
      .select('id, modulo_id')
      .eq('id', disciplinaId)
      .maybeSingle()
    if (!quantas) throw new Error('Disciplina não encontrada.')

    const { count: irmas } = await admin
      .from('disciplinas')
      .select('id', { count: 'exact', head: true })
      .eq('modulo_id', quantas.modulo_id)

    /* O módulo não pode ficar sem nenhuma: é ela que recebe a próxima
       aula criada. */
    if ((irmas ?? 0) <= 1) {
      throw new Error('O módulo precisa de pelo menos uma disciplina.')
    }

    const { error } = await admin.from('disciplinas').delete().eq('id', disciplinaId)
    if (error) throw new Error(error.message)
    revalidarAulas(cursoId)
  })
}

export async function moverAulaDeDisciplina(
  aulaId: string,
  cursoId: string,
  disciplinaId: string
): Promise<Resultado> {
  return tentar(async () => {
    await requireAdmin()
    const admin = createAdminClient()

    /* Só o `disciplina_id` é gravado. O módulo e o número saem do gatilho
       (030): ele espelha o módulo da disciplina nova e renumera a aula no
       fim da fila de lá. Mandar os três daqui seria repetir, em
       JavaScript, uma conta que o banco já faz — e as duas divergiriam. */
    const { error } = await admin
      .from('aulas')
      .update({ disciplina_id: disciplinaId, updated_at: new Date().toISOString() })
      .eq('id', aulaId)
    if (error) throw new Error(error.message)
    revalidarAulas(cursoId)
  })
}

/**
 * Cria a matriz inteira de uma vez.
 *
 * Devolve o que criou, para a tela poder dizer "3 módulos, 6 disciplinas
 * e 60 aulas criados" em vez de só "pronto".
 */
export async function criarMatrizCurricular(
  cursoId: string,
  texto: string
): Promise<Resultado<{ modulos: number; disciplinas: number; aulas: number }>> {
  return tentar(async () => {
    await requireAdmin()
    const admin = createAdminClient()

    const matriz = lerMatriz(texto)
    const conferida = conferirMatriz(matriz)
    if (!conferida.ok) throw new Error(conferida.erro)

    /* O CURSO RECÉM-CRIADO JÁ TEM UM "Módulo 1" VAZIO, posto pelo gatilho
       da migração 022. Se a matriz começasse a criar módulos do zero, o
       curso ficaria com um módulo fantasma na frente de tudo — e ela
       teria de apagar na mão logo depois de montar a matriz.
       Então o primeiro módulo da matriz REAPROVEITA aquele, quando ele
       está vazio (sem aula e sem turma). */
    const { data: existentes } = await admin
      .from('modulos')
      .select('id, nome, ordem')
      .eq('curso_id', cursoId)
      .order('ordem', { ascending: true })

    let reaproveitar: string | null = null
    if ((existentes ?? []).length === 1) {
      const unico = existentes![0]
      const [{ count: comAula }, { count: comTurma }] = await Promise.all([
        admin.from('aulas').select('id', { count: 'exact', head: true }).eq('modulo_id', unico.id),
        admin.from('turmas').select('id', { count: 'exact', head: true }).eq('modulo_id', unico.id),
      ])
      if ((comAula ?? 0) === 0 && (comTurma ?? 0) === 0) reaproveitar = unico.id
    }

    const jaTinha = (existentes ?? []).length
    let ordem = reaproveitar ? 0 : jaTinha
    let criouModulos = 0
    let criouDisciplinas = 0
    let criouAulas = 0

    for (const m of matriz.modulos) {
      ordem += 1
      let moduloId: string

      if (reaproveitar) {
        const { error } = await admin
          .from('modulos')
          .update({ nome: m.nome, ordem, updated_at: new Date().toISOString() })
          .eq('id', reaproveitar)
        if (error) throw new Error(error.message)
        moduloId = reaproveitar
        reaproveitar = null
      } else {
        const { data, error } = await admin
          .from('modulos')
          .insert({ curso_id: cursoId, nome: m.nome, ordem })
          .select('id')
          .single()
        if (error) throw new Error(error.message)
        moduloId = data.id
        criouModulos += 1
      }

      /* Todo módulo tem a sua disciplina automática (gatilho da 030).
         Ela é quem recebe as aulas quando a matriz não separa matérias. */
      const { data: padrao } = await admin
        .from('disciplinas')
        .select('id')
        .eq('modulo_id', moduloId)
        .eq('padrao', true)
        .order('ordem', { ascending: true })
        .limit(1)
        .maybeSingle()

      let ordemDisc = 0
      for (const d of m.disciplinas) {
        ordemDisc += 1
        let disciplinaId: string

        if (d.nome === null) {
          if (!padrao) throw new Error('O módulo ficou sem disciplina onde pôr as aulas.')
          disciplinaId = padrao.id
        } else {
          const { data, error } = await admin
            .from('disciplinas')
            .insert({ modulo_id: moduloId, nome: d.nome, ordem: ordemDisc })
            .select('id')
            .single()
          if (error) throw new Error(error.message)
          disciplinaId = data.id
          criouDisciplinas += 1
        }

        if (d.aulas.length === 0) continue

        /* Todas as aulas de uma disciplina numa tacada só. Sessenta
           inserções separadas seriam sessenta idas ao banco, e uma falha
           no meio deixaria a matriz pela metade.

           NASCEM COMO RASCUNHO (`publicada: false`) de propósito: a
           estrutura existe para receber vídeo e material, e aula
           publicada dispara o aviso da migração 028. Publicar sessenta
           aulas vazias mandaria sessenta recados de "nova aula
           disponível" para a escola inteira. */
        const { error } = await admin.from('aulas').insert(
          d.aulas.map((titulo, i) => ({
            curso_id: cursoId,
            disciplina_id: disciplinaId,
            numero: i + 1,
            titulo,
            publicada: false,
          }))
        )
        if (error) throw new Error(error.message)
        criouAulas += d.aulas.length
      }
    }

    revalidarAulas(cursoId)
    revalidatePath('/dashboard/admin/cursos')
    return { modulos: criouModulos + (jaTinha === 1 ? 1 : 0), disciplinas: criouDisciplinas, aulas: criouAulas }
  })
}
