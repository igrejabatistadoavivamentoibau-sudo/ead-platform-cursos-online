'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { PERCENTUAL_CONCLUSAO, COBERTURA_MINIMA } from '@/lib/video'
import {
  TAMANHO_MAXIMO_ENTREGA,
  MAXIMO_DE_ANEXOS,
  TIPOS_ACEITOS,
  EXTENSAO_POR_TIPO,
} from '@/lib/anexosDaEntrega'

/** O que o player mediu de verdade nesta aula. */
export interface MedicaoDoVideo {
  /** Segundos distintos do vídeo que passaram pela tela. Pular não conta. */
  segundosAssistidos: number
  /** Duração total do vídeo, lida pelo player. */
  duracao: number
}

/**
 * Registra quanto o aluno já assistiu de uma aula e marca como concluída
 * ao passar do limite.
 *
 * A REGRA QUE MUDOU
 * Antes bastava o percentual, e o percentual vinha de "onde está a agulha
 * ÷ duração". Arrastar a barrinha até o fim dava aula concluída e presença
 * sem a pessoa ter assistido nada. Agora quem manda é o TEMPO ASSISTIDO:
 * os segundos do vídeo que realmente passaram pela tela.
 *
 * E há duas conferências aqui no servidor, para o caso de alguém tentar
 * falar direto com ele em vez de usar o player:
 *
 *   1. tempo assistido precisa cobrir 90% da duração;
 *   2. precisa ter passado tempo de relógio suficiente desde a primeira
 *      vez que a aula foi aberta — pelo menos metade da duração do vídeo.
 *      Ninguém assiste 40 minutos em 30 segundos.
 *
 * A duração fica gravada na primeira medição e nunca diminui depois, então
 * também não adianta declarar um vídeo curtinho para baixar a régua.
 *
 * Usa o cliente de sessão (não o de administrador) de propósito: assim as
 * regras do banco garantem que ninguém consiga gravar progresso no nome de
 * outra pessoa, nem em aula de turma na qual não está matriculado.
 */
export async function registrarProgresso(
  aulaId: string,
  percentual: number,
  medicao?: MedicaoDoVideo
) {
  const supabase = await createSessionClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autenticado.')

  const limitado = Math.max(0, Math.min(100, Math.round(percentual)))

  // Confere se a aula é mesmo de uma turma onde a pessoa está matriculada.
  // A política do banco já bloquearia, mas errar cedo dá mensagem melhor.
  const { data: aula } = await supabase.from('aulas').select('id').eq('id', aulaId).single()
  if (!aula) throw new Error('Aula não encontrada ou indisponível para você.')

  // Busca o progresso atual para nunca regredir o percentual já alcançado
  // (se a pessoa reabrir o vídeo do início, não perde o que já assistiu).
  const { data: atual } = await supabase
    .from('aula_progresso')
    .select('percentual, concluida, concluida_em, segundos_assistidos, duracao_segundos, iniciado_em')
    .eq('aula_id', aulaId)
    .eq('aluno_id', user.id)
    .maybeSingle()

  const percentualFinal = Math.max(limitado, Number(atual?.percentual ?? 0))
  const jaConcluida = atual?.concluida === true

  const segundosFinal = Math.max(
    Math.round(medicao?.segundosAssistidos ?? 0),
    Number(atual?.segundos_assistidos ?? 0)
  )
  // A duração vale a maior já vista: assim uma medição menor (falsa ou de
  // um carregamento incompleto) não afrouxa a régua de conclusão.
  const duracaoFinal = Math.max(
    Math.round(medicao?.duracao ?? 0),
    Number(atual?.duracao_segundos ?? 0)
  )
  const iniciadoEm = atual?.iniciado_em ?? new Date().toISOString()

  const concluidaFinal = jaConcluida || podeConcluir(percentualFinal, segundosFinal, duracaoFinal, iniciadoEm)

  const { error } = await supabase.from('aula_progresso').upsert(
    {
      aula_id: aulaId,
      aluno_id: user.id,
      percentual: percentualFinal,
      concluida: concluidaFinal,
      segundos_assistidos: segundosFinal,
      duracao_segundos: duracaoFinal > 0 ? duracaoFinal : null,
      iniciado_em: iniciadoEm,
      concluida_em: concluidaFinal
        ? (atual?.concluida_em ?? new Date().toISOString())
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'aula_id,aluno_id' }
  )

  if (error) throw new Error(error.message)

  // Só revalida quando algo visível muda (o selo de concluída), para não
  // recarregar a página a cada poucos segundos de vídeo assistido.
  if (concluidaFinal && !jaConcluida) {
    revalidatePath('/dashboard/aluno')
    revalidatePath('/dashboard/aluno/cursos')
  }

  return { concluida: concluidaFinal, percentual: percentualFinal }
}

/**
 * A decisão de dar (ou não) a aula por concluída.
 *
 * Separada em função própria porque é a regra mais delicada da plataforma:
 * dela sai a presença do aluno, e presença é documento.
 *
 * Vídeos que a plataforma não consegue medir (Google Drive, Vimeo) chegam
 * aqui sem duração. Nesses casos a conclusão continua sendo declarada pelo
 * próprio aluno, pelo botão — não há como conferir, e fingir que há seria
 * pior do que assumir.
 */
function podeConcluir(
  percentual: number,
  segundosAssistidos: number,
  duracao: number,
  iniciadoEm: string
): boolean {
  if (duracao <= 0) {
    // Sem medição possível: vale a declaração do aluno.
    return percentual >= PERCENTUAL_CONCLUSAO
  }

  const cobriuOVideo = segundosAssistidos >= duracao * (COBERTURA_MINIMA / 100)
  if (!cobriuOVideo) return false

  // Tempo de relógio: assistir 40 minutos leva, no mínimo, uns 20 (dá para
  // acelerar o vídeo, não dá para dobrar o tempo).
  const decorrido = (Date.now() - new Date(iniciadoEm).getTime()) / 1000
  return decorrido >= duracao * 0.5
}

// ==================== RESUMO DA AULA ====================

/**
 * O aluno escreve o que entendeu da aula. É uma forma simples e eficaz de
 * fixação — e dá ao professor um sinal de quem está realmente acompanhando,
 * além do "assistiu o vídeo".
 */
export async function salvarResumo(aulaId: string, texto: string) {
  const supabase = await createSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const limpo = texto.trim()
  if (limpo.length < 10) throw new Error('Escreva um resumo com pelo menos 10 caracteres.')
  if (limpo.length > 5000) throw new Error('O resumo passou de 5000 caracteres.')

  const { error } = await supabase.from('resumos_aula').upsert(
    {
      aula_id: aulaId,
      aluno_id: user.id,
      texto: limpo,
      enviado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'aula_id,aluno_id' }
  )
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/aluno/cursos')
  return { ok: true }
}

// ==================== ENTREGA DE ATIVIDADE ====================

function formatarMomento(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

/**
 * A JANELA, CONFERIDA NO SERVIDOR
 *
 * O banco também confere — há um gatilho em `entregas` e em
 * `entrega_arquivos` que recusa qualquer entrega fora do prazo, venha de
 * onde vier. A conferência aqui não é redundância inútil: é o que permite
 * dar uma frase em português para a pessoa, e é o que impede o aluno de
 * gastar quatro minutos enviando fotos para ouvir "não" no fim.
 * O gatilho é a garantia; isto aqui é a educação.
 */
async function janelaDaAtividade(atividadeId: string, alunoId: string) {
  const supabase = await createSessionClient()

  const { data: atividade } = await supabase
    .from('atividades')
    .select('id, turma_id, publicada, abre_em, vence_em, titulo')
    .eq('id', atividadeId)
    .maybeSingle()

  if (!atividade) throw new Error('Atividade não encontrada.')

  const { data: matricula } = await supabase
    .from('turma_alunos')
    .select('status')
    .eq('turma_id', atividade.turma_id)
    .eq('aluno_id', alunoId)
    .maybeSingle()

  if (!matricula || matricula.status !== 'ativo') {
    throw new Error('Você não está matriculado nesta turma.')
  }
  if (!atividade.publicada) {
    throw new Error('Esta atividade ainda não foi liberada pelo professor.')
  }

  const agora = Date.now()
  if (atividade.abre_em && agora < new Date(atividade.abre_em).getTime()) {
    throw new Error(`Esta atividade abre em ${formatarMomento(atividade.abre_em)}.`)
  }
  if (atividade.vence_em && agora > new Date(atividade.vence_em).getTime()) {
    throw new Error(
      `O prazo encerrou em ${formatarMomento(atividade.vence_em)}. Fale com o professor.`
    )
  }
  return atividade
}

/**
 * Autoriza os anexos e devolve onde cada um deve ser gravado.
 *
 * POR QUE O ARQUIVO NÃO PASSA MAIS POR AQUI
 *
 * A versão anterior recebia o arquivo dentro desta action, e anunciava
 * "até 20 MB" na tela. Em produção isso nunca funcionou: a Vercel recusa
 * requisição acima de ~4,5 MB e o Next limita ação de servidor a 1 MB.
 * Ou seja, qualquer foto de celular de verdade — que passa de 1 MB com
 * folga — morria no meio, e o aluno via só um erro sem explicação.
 *
 * O mesmo problema já tinha sido resolvido para o vídeo das aulas
 * (`autorizarEnvioDeVideo`): o servidor só autoriza e diz onde gravar; o
 * navegador manda direto para o armazenamento. É o caminho que funciona,
 * e ainda é mais rápido, porque o arquivo dá um salto a menos.
 *
 * O caminho começa com o id do aluno de propósito: as regras do bucket
 * amarram a escrita à pasta de quem está logado.
 */
export async function autorizarEnvioDeEntrega(
  atividadeId: string,
  arquivos: { nome: string; tipo: string; tamanho: number }[]
) {
  const supabase = await createSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  await janelaDaAtividade(atividadeId, user.id)

  if (arquivos.length > MAXIMO_DE_ANEXOS) {
    throw new Error(`São no máximo ${MAXIMO_DE_ANEXOS} arquivos por entrega.`)
  }

  return arquivos.map((a) => {
    if (!TIPOS_ACEITOS.includes(a.tipo)) {
      throw new Error(`"${a.nome}" não é PDF nem JPEG. Envie só esses dois formatos.`)
    }
    if (a.tamanho > TAMANHO_MAXIMO_ENTREGA) {
      throw new Error(`"${a.nome}" passa de 20 MB. Reduza o tamanho e tente de novo.`)
    }
    return {
      nome: a.nome,
      tipo: a.tipo,
      tamanho: a.tamanho,
      path: `${user.id}/${atividadeId}-${crypto.randomUUID()}.${EXTENSAO_POR_TIPO[a.tipo]}`,
    }
  })
}

/**
 * Grava a entrega depois que os arquivos já subiram.
 *
 * `substituirAnexos` diz se os anexos que já estavam lá saem de cena. É
 * `true` quando a pessoa mexeu na lista de arquivos, e `false` quando ela
 * só corrigiu o texto — para um ajuste de vírgula não apagar as fotos que
 * ela levou dez minutos para tirar.
 */
export async function registrarEntrega(input: {
  atividadeId: string
  texto: string
  anexos: { path: string; nome: string; tipo: string; tamanho: number }[]
  substituirAnexos: boolean
}) {
  const supabase = await createSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const { atividadeId, anexos, substituirAnexos } = input
  const texto = (input.texto ?? '').trim()

  await janelaDaAtividade(atividadeId, user.id)

  /* Os caminhos voltam do navegador. Se alguém trocar o caminho por um da
     pasta de outro aluno, o registro apontaria para o arquivo alheio.
     O armazenamento já barra a ESCRITA fora da própria pasta; esta linha
     barra o REGISTRO. */
  const limpar = async () => {
    if (anexos.length) await supabase.storage.from('entregas').remove(anexos.map((a) => a.path))
  }
  for (const a of anexos) {
    if (!a.path.startsWith(`${user.id}/`)) {
      await limpar()
      throw new Error('Caminho de arquivo inválido.')
    }
    if (!TIPOS_ACEITOS.includes(a.tipo)) {
      await limpar()
      throw new Error('Formato de arquivo não aceito.')
    }
  }

  const { data: entrega, error } = await supabase
    .from('entregas')
    .upsert(
      {
        atividade_id: atividadeId,
        aluno_id: user.id,
        texto: texto || null,
        entregue_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'atividade_id,aluno_id' }
    )
    .select('id')
    .single()

  if (error || !entrega) {
    // Se o registro falhou, os arquivos que subiram viram lixo no bucket.
    await limpar()
    throw new Error(error?.message ?? 'Não consegui registrar a entrega.')
  }

  if (substituirAnexos) {
    const { data: antigos } = await supabase
      .from('entrega_arquivos')
      .select('path')
      .eq('entrega_id', entrega.id)

    if (antigos?.length) {
      await supabase.from('entrega_arquivos').delete().eq('entrega_id', entrega.id)
      // Tira também do armazenamento: sem isso cada reenvio deixaria uma
      // cópia órfã acumulando para sempre.
      await supabase.storage.from('entregas').remove(antigos.map((a) => a.path))
    }
  }

  if (anexos.length) {
    const { error: erroAnexos } = await supabase.from('entrega_arquivos').insert(
      anexos.map((a) => ({
        entrega_id: entrega.id,
        path: a.path,
        nome: a.nome,
        tipo: a.tipo,
        tamanho: a.tamanho,
      }))
    )
    if (erroAnexos) {
      await limpar()
      throw new Error(erroAnexos.message)
    }
  }

  // Só depois de tudo gravado é que sabemos se sobrou alguma coisa.
  const { count } = await supabase
    .from('entrega_arquivos')
    .select('id', { count: 'exact', head: true })
    .eq('entrega_id', entrega.id)

  if (!texto && !count) {
    throw new Error('Escreva uma resposta ou anexe pelo menos um arquivo.')
  }

  revalidatePath('/dashboard/aluno/atividades')
  revalidatePath('/dashboard/aluno')
  return { ok: true }
}

/**
 * Devolve links temporários para o aluno abrir os próprios anexos.
 *
 * Era uma lacuna: o nome do arquivo aparecia na tela como texto morto e o
 * aluno não tinha como conferir o que tinha mandado. Quem entrega uma foto
 * de página escrita à mão quer poder olhar se saiu legível.
 */
export async function linksDosMeusAnexos(entregaId: string) {
  const supabase = await createSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const { data: entrega } = await supabase
    .from('entregas')
    .select('id, aluno_id')
    .eq('id', entregaId)
    .maybeSingle()
  if (!entrega || entrega.aluno_id !== user.id) throw new Error('Entrega não encontrada.')

  const { data: arquivos } = await supabase
    .from('entrega_arquivos')
    .select('id, path, nome, tipo')
    .eq('entrega_id', entregaId)
    .order('enviado_em')

  const saida: { id: string; nome: string; tipo: string; url: string | null }[] = []
  for (const a of arquivos ?? []) {
    const { data } = await supabase.storage.from('entregas').createSignedUrl(a.path, 60 * 10)
    saida.push({ id: a.id, nome: a.nome, tipo: a.tipo, url: data?.signedUrl ?? null })
  }
  return saida
}

// ==================== AULA FECHADA E FALTA JUSTIFICADA ====================

/**
 * O aluno pede para o professor liberar uma aula cujo prazo passou.
 *
 * POR QUE ISTO EXISTE
 * Fechar a aula sem dar caminho nenhum transformaria um atraso em perda
 * definitiva — e a maioria dos atrasos numa escola de igreja tem motivo
 * (plantão, doença, viagem a trabalho). O aluno escreve o motivo, o
 * professor lê e decide. A decisão é dele, e fica registrada.
 *
 * O pedido nasce sempre "pendente": as regras do banco não deixam o aluno
 * criar um pedido já liberado, nem alterar o próprio pedido depois. Se
 * deixassem, o pedido seria só um formulário e não uma autorização.
 */
export async function pedirLiberacaoDeAula(turmaId: string, aulaId: string, motivo: string) {
  const supabase = await createSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const texto = (motivo ?? '').trim()
  if (texto.length < 10) {
    throw new Error('Escreva o motivo com um pouco mais de detalhe — o professor precisa entender.')
  }

  const { data: jaTem } = await supabase
    .from('liberacoes_de_aula')
    .select('id, status')
    .eq('turma_id', turmaId)
    .eq('aula_id', aulaId)
    .eq('aluno_id', user.id)
    .maybeSingle()

  if (jaTem) {
    throw new Error(
      jaTem.status === 'pendente'
        ? 'Você já pediu, e o professor ainda não respondeu.'
        : jaTem.status === 'recusada'
          ? 'Seu pedido foi respondido. Fale com o professor pessoalmente.'
          : 'Esta aula já está liberada para você.'
    )
  }

  const { error } = await supabase
    .from('liberacoes_de_aula')
    .insert({ turma_id: turmaId, aula_id: aulaId, aluno_id: user.id, motivo: texto })
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/aluno/cursos')
  return { ok: true }
}

/**
 * O aluno justifica uma falta.
 *
 * Escreve só o texto — quem decide é o professor. As regras do banco
 * garantem isso mesmo que alguém chame esta gravação por fora do site:
 * o mesmo comando que grava a justificativa não consegue mexer em
 * `presente` nem no status da decisão.
 */
export async function justificarFalta(presencaId: string, texto: string) {
  const supabase = await createSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const justificativa = (texto ?? '').trim()
  if (justificativa.length < 10) {
    throw new Error('Escreva o motivo da falta com um pouco mais de detalhe.')
  }

  const { data: presenca } = await supabase
    .from('presencas')
    .select('id, aluno_id, presente, justificativa_status')
    .eq('id', presencaId)
    .maybeSingle()

  if (!presenca || presenca.aluno_id !== user.id) throw new Error('Falta não encontrada.')
  if (presenca.presente) throw new Error('Esta presença está registrada. Não há falta para justificar.')
  if (presenca.justificativa_status === 'aceita' || presenca.justificativa_status === 'recusada') {
    throw new Error('O professor já respondeu esta justificativa.')
  }

  const { error } = await supabase
    .from('presencas')
    .update({ justificativa })
    .eq('id', presencaId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/aluno/presencas')
  return { ok: true }
}
