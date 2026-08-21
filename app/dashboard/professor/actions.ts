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

export interface DadosDaAtividade {
  titulo: string
  descricao?: string
  /** O recado de COMO entregar: "faça à punho e fotografe as páginas". */
  aviso?: string
  /** Instante em que a atividade abre para entrega. Vazio = aberta já. */
  abre_em?: string | null
  /** Instante em que o prazo encerra. Vazio = sem prazo. */
  vence_em?: string | null
  nota_maxima: number
}

/**
 * Confere que a atividade existe, pertence à turma informada, e que quem
 * está agindo tem o direito de MEXER nela.
 *
 * POR QUE ESTA FUNÇÃO EXISTE, EM DUAS PARTES
 *
 * 1. O `turmaId` chega do navegador. As versões anteriores confiavam nele:
 *    conferiam que a TURMA era do professor e depois apagavam/corrigiam
 *    pelo id da ATIVIDADE, sem conferir que uma coisa tinha a ver com a
 *    outra. Bastava mandar o id de uma turma sua junto com o id de uma
 *    atividade alheia. Agora o par é conferido no banco.
 *
 * 2. A regra pedida: um professor não edita a atividade do outro; o admin
 *    edita todas. Como uma turma pode trocar de professor ao longo do
 *    tempo, "é da minha turma" não basta — o que vale é quem criou.
 */
async function garantirAtividadeMinha(atividadeId: string, turmaId: string) {
  const { userId, role } = await exigir('ver_alunos')
  const admin = createAdminClient()

  const { data: atividade } = await admin
    .from('atividades')
    .select('id, turma_id, criada_por')
    .eq('id', atividadeId)
    .maybeSingle()

  if (!atividade) throw new Error('Atividade não encontrada.')
  if (atividade.turma_id !== turmaId) {
    throw new Error('Esta atividade não pertence à turma informada.')
  }

  if (role === 'admin') return { userId, role, atividade }

  const { data: turma } = await admin
    .from('turmas')
    .select('professor_id')
    .eq('id', atividade.turma_id)
    .single()

  if (turma?.professor_id !== userId) {
    throw new Error('Esta turma não está sob sua responsabilidade.')
  }
  if (atividade.criada_por !== userId) {
    throw new Error(
      'Esta atividade foi criada por outra pessoa. Só quem criou — ou um administrador — pode alterá-la.'
    )
  }
  return { userId, role, atividade }
}

/** As telas que mostram atividade precisam ser atualizadas juntas. */
function revalidarAtividades(turmaId: string) {
  revalidatePath(`/dashboard/professor/turmas/${turmaId}/atividades`)
  revalidatePath('/dashboard/aluno/atividades')
  revalidatePath('/dashboard/aluno')
}

/**
 * A janela precisa fazer sentido antes de chegar ao banco.
 *
 * Uma atividade que vence antes de abrir não é um detalhe de tela: é uma
 * atividade que ninguém consegue entregar, e o professor só descobre pela
 * reclamação dos alunos. Barrar aqui custa uma linha.
 */
function conferirJanela(abre?: string | null, vence?: string | null) {
  if (abre && vence && new Date(vence) <= new Date(abre)) {
    throw new Error('O prazo de entrega tem que ser depois da abertura.')
  }
}

export async function criarAtividade(turmaId: string, input: DadosDaAtividade) {
  const { userId, role } = await exigir('ver_alunos')
  await garantirTurma(turmaId, userId, role)

  const titulo = input.titulo?.trim()
  if (!titulo) throw new Error('Dê um título para a atividade.')
  if (!(input.nota_maxima > 0)) throw new Error('A nota máxima precisa ser maior que zero.')
  conferirJanela(input.abre_em, input.vence_em)

  const admin = createAdminClient()
  const { error } = await admin.from('atividades').insert({
    turma_id: turmaId,
    titulo,
    descricao: input.descricao?.trim() || null,
    aviso: input.aviso?.trim() || null,
    abre_em: input.abre_em || null,
    vence_em: input.vence_em || null,
    nota_maxima: input.nota_maxima,
    // Assina quem criou. É esta coluna que decide quem pode editar depois.
    criada_por: userId,
  })
  if (error) throw new Error(error.message)

  revalidarAtividades(turmaId)
}

export async function editarAtividade(
  atividadeId: string,
  turmaId: string,
  input: DadosDaAtividade
) {
  await garantirAtividadeMinha(atividadeId, turmaId)

  const titulo = input.titulo?.trim()
  if (!titulo) throw new Error('Dê um título para a atividade.')
  if (!(input.nota_maxima > 0)) throw new Error('A nota máxima precisa ser maior que zero.')
  conferirJanela(input.abre_em, input.vence_em)

  const admin = createAdminClient()
  const { error } = await admin
    .from('atividades')
    .update({
      titulo,
      descricao: input.descricao?.trim() || null,
      aviso: input.aviso?.trim() || null,
      abre_em: input.abre_em || null,
      vence_em: input.vence_em || null,
      nota_maxima: input.nota_maxima,
    })
    .eq('id', atividadeId)
  if (error) throw new Error(error.message)

  revalidarAtividades(turmaId)
}

export async function removerAtividade(atividadeId: string, turmaId: string) {
  await garantirAtividadeMinha(atividadeId, turmaId)
  const admin = createAdminClient()

  const { error } = await admin.from('atividades').delete().eq('id', atividadeId)
  if (error) throw new Error(error.message)
  revalidarAtividades(turmaId)
}

export async function corrigirEntrega(
  entregaId: string,
  turmaId: string,
  input: { nota: number | null; feedback?: string }
) {
  const { userId, role } = await exigir('ver_alunos')
  const admin = createAdminClient()

  /* Corrigir é diferente de editar a atividade: quem corrige é o
     professor DA TURMA, mesmo que a atividade tenha sido criada pelo
     admin. A restrição de autoria vale para mexer no enunciado e no
     prazo, não para dar nota ao próprio aluno. */
  const { data: entrega } = await admin
    .from('entregas')
    .select('id, atividade_id, atividades!inner(turma_id, nota_maxima)')
    .eq('id', entregaId)
    .maybeSingle()

  if (!entrega) throw new Error('Entrega não encontrada.')
  const atividade = entrega.atividades as unknown as { turma_id: string; nota_maxima: number }
  if (atividade.turma_id !== turmaId) {
    throw new Error('Esta entrega não pertence à turma informada.')
  }
  await garantirTurma(turmaId, userId, role)

  /* A nota chega do navegador. O `min`/`max` do campo é conforto para
     quem digita, não regra: quem manda direto pelo console passa por cima
     dele. Uma nota 900 numa atividade de 10 estraga a média da turma
     inteira, e o número não chama atenção — só o resultado, meses depois. */
  if (input.nota !== null) {
    if (Number.isNaN(input.nota)) throw new Error('Nota inválida.')
    if (input.nota < 0) throw new Error('A nota não pode ser negativa.')
    if (input.nota > Number(atividade.nota_maxima)) {
      throw new Error(`Esta atividade vale no máximo ${Number(atividade.nota_maxima)}.`)
    }
  }

  /* QUEM CORRIGIU FICA REGISTRADO.
     A entrega guardava QUANDO foi corrigida e nunca POR QUEM. Numa turma
     que troca de professor, ou quando o admin corrige, o aluno recebia
     uma nota sem dono e sem ter a quem perguntar. É esta coluna que a
     assinatura eletrônica assina. */
  const { error } = await admin
    .from('entregas')
    .update({
      nota: input.nota,
      feedback: input.feedback?.trim() || null,
      corrigida_em: new Date().toISOString(),
      corrigida_por: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entregaId)
  if (error) throw new Error(error.message)

  revalidarAtividades(turmaId)
  revalidatePath('/dashboard/aluno/notas')
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

// ==================== AULAS DENTRO DA TURMA ====================

/* ============================================================
   A JANELA DA AULA É DA TURMA, NÃO DA AULA

   A aula pertence ao curso, e o mesmo curso é dado por várias turmas em
   épocas diferentes — a turma de março e a de agosto veem a MESMA aula.
   Uma data gravada na aula valeria para todas ao mesmo tempo: abrir para
   a de agosto fecharia para a de março.

   Sem linha em `aula_turma`, a aula está liberada. A escola não precisa
   marcar data em nada para continuar funcionando como funciona hoje.
   ============================================================ */

export async function definirJanelaDaAula(
  turmaId: string,
  aulaId: string,
  input: { abre_em?: string | null; vence_em?: string | null }
) {
  const { userId, role } = await exigir('gerenciar_aulas')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  // A aula tem que ser do curso desta turma. Sem isto, o id da aula vindo
  // do navegador poderia apontar para o curso de outra pessoa.
  const { data: turma } = await admin.from('turmas').select('curso_id').eq('id', turmaId).single()
  const { data: aula } = await admin.from('aulas').select('curso_id').eq('id', aulaId).maybeSingle()
  if (!aula || !turma?.curso_id || aula.curso_id !== turma.curso_id) {
    throw new Error('Esta aula não pertence ao curso desta turma.')
  }

  if (input.abre_em && input.vence_em && new Date(input.vence_em) <= new Date(input.abre_em)) {
    throw new Error('O prazo para assistir tem que ser depois da abertura.')
  }

  /* Sem data nenhuma, a linha some em vez de ficar com dois nulos. Linha
     vazia e ausência de linha significam a mesma coisa — deixar as duas
     formas conviverem é criar um estado a mais para alguém interpretar
     errado depois. */
  if (!input.abre_em && !input.vence_em) {
    const { error } = await admin
      .from('aula_turma')
      .delete()
      .eq('turma_id', turmaId)
      .eq('aula_id', aulaId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin.from('aula_turma').upsert(
      {
        turma_id: turmaId,
        aula_id: aulaId,
        abre_em: input.abre_em || null,
        vence_em: input.vence_em || null,
        definida_por: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'turma_id,aula_id' }
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/dashboard/professor/turmas/${turmaId}/aulas`)
  revalidatePath('/dashboard/aluno/cursos')
}

/** Copia a mesma janela para todas as aulas do curso desta turma. */
export async function definirJanelaDeTodasAsAulas(
  turmaId: string,
  input: { abre_em?: string | null; vence_em?: string | null }
) {
  const { userId, role } = await exigir('gerenciar_aulas')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { data: turma } = await admin.from('turmas').select('curso_id').eq('id', turmaId).single()
  if (!turma?.curso_id) throw new Error('Esta turma ainda não tem curso definido.')

  const { data: aulas } = await admin
    .from('aulas')
    .select('id')
    .eq('curso_id', turma.curso_id)
    .eq('publicada', true)

  if (!aulas?.length) throw new Error('Este curso não tem aulas publicadas.')

  if (!input.abre_em && !input.vence_em) {
    const { error } = await admin.from('aula_turma').delete().eq('turma_id', turmaId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin.from('aula_turma').upsert(
      aulas.map((a) => ({
        turma_id: turmaId,
        aula_id: a.id as string,
        abre_em: input.abre_em || null,
        vence_em: input.vence_em || null,
        definida_por: userId,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'turma_id,aula_id' }
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/dashboard/professor/turmas/${turmaId}/aulas`)
  revalidatePath('/dashboard/aluno/cursos')
  return aulas.length
}

/**
 * O professor responde ao pedido de liberação de um aluno.
 *
 * `libera_ate` existe para o "sim" não virar um sim para sempre: o
 * professor libera até domingo, e depois disso a aula fecha de novo
 * sozinha. Sem prazo, a liberação vale enquanto o aluno estiver na turma.
 */
export async function decidirLiberacaoDeAula(
  liberacaoId: string,
  turmaId: string,
  input: { status: 'liberada' | 'recusada'; resposta?: string; libera_ate?: string | null }
) {
  const { userId, role } = await exigir('gerenciar_aulas')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { data: pedido } = await admin
    .from('liberacoes_de_aula')
    .select('id, turma_id')
    .eq('id', liberacaoId)
    .maybeSingle()
  if (!pedido) throw new Error('Pedido não encontrado.')
  if (pedido.turma_id !== turmaId) throw new Error('Este pedido não é desta turma.')

  const { error } = await admin
    .from('liberacoes_de_aula')
    .update({
      status: input.status,
      resposta: input.resposta?.trim() || null,
      libera_ate: input.status === 'liberada' ? input.libera_ate || null : null,
      decidida_por: userId,
      decidida_em: new Date().toISOString(),
    })
    .eq('id', liberacaoId)
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/professor/turmas/${turmaId}/aulas`)
  revalidatePath('/dashboard/aluno/cursos')
}

/**
 * O professor responde à justificativa de falta.
 *
 * Aceitar NÃO vira presença. A falta continua registrada, só passa a ter
 * motivo reconhecido. Transformar em presença seria falsificar a chamada,
 * e o documento tem que continuar dizendo o que aconteceu.
 */
export async function responderJustificativa(
  presencaId: string,
  turmaId: string,
  input: { status: 'aceita' | 'recusada'; resposta?: string }
) {
  const { userId, role } = await exigir('fazer_chamada')
  await garantirTurma(turmaId, userId, role)
  const admin = createAdminClient()

  const { data: presenca } = await admin
    .from('presencas')
    .select('id, encontros!inner(turma_id)')
    .eq('id', presencaId)
    .maybeSingle()
  if (!presenca) throw new Error('Presença não encontrada.')
  const enc = presenca.encontros as unknown as { turma_id: string }
  if (enc.turma_id !== turmaId) throw new Error('Esta falta não é desta turma.')

  const { error } = await admin
    .from('presencas')
    .update({
      justificativa_status: input.status,
      justificativa_resposta: input.resposta?.trim() || null,
      justificativa_decidida_por: userId,
      justificativa_decidida_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', presencaId)
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/professor/turmas/${turmaId}/chamada`)
  revalidatePath('/dashboard/aluno/presencas')
}
