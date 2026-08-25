import { modulosDoAluno, type MatriculaNoModulo, type ModuloBruto } from '@/lib/modulosDoAluno'
import type { UserRole } from '@/lib/permissoes'

/* ============================================================
   QUEM PODE VER O ARQUIVO DE VÍDEO

   Esta é a decisão, e só a decisão. Sem banco, sem rede, sem Next — o
   que entra são fatos já apurados e o que sai é sim ou não, com o
   motivo. Assim ela pode ser testada em todos os casos que interessam,
   inclusive os que dão trabalho para reproduzir num navegador: aluno de
   outra turma, módulo trancado, prazo vencido, quem não entrou.

   POR QUE A REGRA VIVE AQUI E NÃO NA ROTA
   Regra que mora dentro do endereço HTTP vale só naquele endereço. No
   dia em que o aplicativo do celular pedir o mesmo vídeo por outro
   caminho, ou alguém criar uma tela de revisão, a segunda cópia da
   decisão vai divergir da primeira — e a que divergir vai liberar
   conteúdo para quem não deveria.

   O QUE ELA **NÃO** DECIDE
   Vídeo de fora (YouTube, Vimeo, Drive, OneDrive) não passa por aqui.
   Aquele link é do provedor, a plataforma nunca o guardou e nada nesta
   entrega muda o comportamento dele.
   ============================================================ */

export interface QuemPede {
  id: string
  role: UserRole
}

export interface AulaPedida {
  id: string
  cursoId: string | null
  moduloId: string | null
  publicada: boolean
  /** Existe arquivo guardado na plataforma? Sem isso, não é assunto daqui. */
  temArquivo: boolean
}

export interface ContextoDoAluno {
  /** Os módulos do curso, em ordem. */
  modulos: ModuloBruto[]
  /** As matrículas do aluno NESTE curso. */
  matriculas: MatriculaNoModulo[]
  /**
   * A janela de data da aula nesta turma, já respondida pelo banco
   * (`aula_liberada_para`). É a mesma trava que vale para marcar
   * progresso — não uma segunda regra escrita aqui.
   */
  liberadaPelaJanela: boolean
}

export type Veredito =
  | { pode: true }
  | { pode: false; status: 401 | 403 | 404; motivo: string }

/**
 * @param quem      quem está pedindo, ou null se não há sessão válida
 * @param aula      a aula, como está no banco
 * @param doAluno   só para papel de aluno; para equipe pode vir null
 * @param lecionaOCurso  o professor tem turma neste curso?
 */
export function podeVerOVideo(
  quem: QuemPede | null,
  aula: AulaPedida | null,
  doAluno: ContextoDoAluno | null,
  lecionaOCurso: boolean
): Veredito {
  /* 1. Sem sessão não se discute o resto. É este ramo que fecha o buraco
        que a auditoria encontrou: antes, o arquivo abria para qualquer
        pessoa com o endereço, logada ou não. */
  if (!quem) {
    return { pode: false, status: 401, motivo: 'Entre na plataforma para assistir.' }
  }

  /* 2. Aula que não existe e aula sem arquivo respondem igual: 404.
        Responder "existe, mas você não pode" para uma aula que a pessoa
        não deveria nem saber que existe já entrega informação. */
  if (!aula || !aula.temArquivo) {
    return { pode: false, status: 404, motivo: 'Vídeo não encontrado.' }
  }

  /* 3. A coordenação vê tudo — é por ela que a escola conserta o que
        precisa ser consertado. */
  if (quem.role === 'admin') return { pode: true }

  /* 4. O professor vê as aulas dos cursos em que tem turma. Inclusive
        rascunho: ele precisa conferir o vídeo antes de publicar. */
  if (quem.role === 'professor') {
    return lecionaOCurso
      ? { pode: true }
      : { pode: false, status: 403, motivo: 'Este curso não está sob sua responsabilidade.' }
  }

  /* 5. O aluno. */
  if (!aula.publicada) {
    return { pode: false, status: 403, motivo: 'Esta aula ainda não foi liberada pelo professor.' }
  }

  if (!doAluno || doAluno.matriculas.length === 0) {
    return { pode: false, status: 403, motivo: 'Você não está matriculado neste curso.' }
  }

  /* O CADEADO DO MÓDULO, pela MESMA função que monta a tela do aluno.
     Se a conta fosse refeita aqui, um dia as duas discordariam — e o dia
     em que discordassem seria o dia em que o vídeo abriria para quem a
     tela dizia estar trancado. */
  const estados = modulosDoAluno(doAluno.modulos, doAluno.matriculas)
  const meu = estados.find((m) => m.id === aula.moduloId)

  if (!meu) {
    return { pode: false, status: 403, motivo: 'Esta aula não faz parte do seu curso.' }
  }
  if (!meu.aberto) {
    return {
      pode: false,
      status: 403,
      motivo: meu.motivo ?? 'Este módulo ainda não está liberado para você.',
    }
  }

  /* A janela de data da aula nesta turma. */
  if (!doAluno.liberadaPelaJanela) {
    return {
      pode: false,
      status: 403,
      motivo: 'O prazo para assistir esta aula encerrou. Peça liberação ao professor.',
    }
  }

  return { pode: true }
}

/* ============================================================
   QUANTO TEMPO O ENDEREÇO ASSINADO VALE

   Não existe número perfeito, e vale dizer por quê:

   - CURTO DEMAIS quebra a aula no meio. O navegador não baixa o vídeo de
     uma vez; ele pede pedaços conforme a pessoa assiste. Se o endereço
     vencer no meio, o vídeo trava — e trava justamente em quem está
     assistindo a aula inteira, que é quem a escola quer.
   - LONGO DEMAIS é quase o problema de antes: um endereço copiado que
     circula por dias.

   Quatro horas cobrem qualquer aula desta escola com folga para pausar,
   almoçar e voltar; e um endereço que alguém repasse morre no mesmo dia.
   Some-se a isso que um endereço novo é assinado a cada vez que a tela
   abre: o que circula é sempre uma chave que já está expirando.
   ============================================================ */
export const VALIDADE_DO_ENDERECO_EM_SEGUNDOS = 4 * 60 * 60
