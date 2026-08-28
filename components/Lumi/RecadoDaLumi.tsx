'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { X, ArrowRight, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { recadosPendentes, marcarRecadoLido, type RecadosPendentes } from '@/app/lumi-actions'
import { proximoRecado, type RecadoDaLumi as Recado } from '@/lib/nucleo/recadoDaLumi'

/* ============================================================
   A LUMI DANDO O RECADO

   O QUE ISTO **NÃO** É

   Não é um segundo sistema de notificações: os avisos são os mesmos da
   tabela `notificacoes`, os mesmos do sino, escritos pelos mesmos
   gatilhos. Se este componente for apagado, nenhum aviso se perde — só
   deixa de existir quem os anuncia em voz alta.

   E não é um chatbot: não há campo de escrever, não há conversa, não há
   pergunta. Um recado, um botão, e ela sai da frente.

   POR QUE DISCRETO, E O QUE ISSO SIGNIFICA AQUI

   A saudação do dia é um cartão no meio da tela — pode ser, acontece uma
   vez por dia e é para ser lida com calma. Isto acontece a qualquer
   momento, inclusive no meio de uma aula. Cartão no meio da tela seria
   um susto; a mesma lição da pastilha de atualização, que já encolheu uma
   vez por esse motivo.

   Então: canto inferior direito, largura de um cartão de visita, o mesmo
   material das outras peças da LUMI (branco leitoso, anel fino, sombra
   baixa). Ele não escurece a tela atrás, não bloqueia nada e não rouba o
   foco do teclado.

   UM DE CADA VEZ. Se chegarem três avisos, ela mostra um e diz que há
   outros. Fila de pop-ups é o oposto de assistente.

   ELE NÃO SOME SOZINHO. Foi uma decisão, não um esquecimento: "sua nota
   foi lançada" desaparecendo enquanto a pessoa foi buscar um café é um
   aviso que nunca existiu. Ele fica até ela resolver — e é pequeno o
   bastante para poder ficar.
   ============================================================ */

/** Um respiro antes de aparecer. Entrar junto com a tela lê como erro. */
const ESPERA_ANTES_DE_FALAR = 1400

/** Os recados que a LUMI já mostrou NESTE navegador. */
const CHAVE_MOSTRADOS = 'ibau:lumi-recados-mostrados'
/** Teto da lista: memória de recado não pode crescer para sempre. */
const LEMBRAR_NO_MAXIMO = 60

function lerMostrados(): string[] {
  try {
    const cru = window.localStorage.getItem(CHAVE_MOSTRADOS)
    const lista = cru ? (JSON.parse(cru) as unknown) : []
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function guardarMostrado(id: string) {
  try {
    const atual = lerMostrados().filter((x) => x !== id)
    atual.push(id)
    window.localStorage.setItem(
      CHAVE_MOSTRADOS,
      JSON.stringify(atual.slice(-LEMBRAR_NO_MAXIMO))
    )
  } catch {
    /* armazenamento bloqueado: no pior caso a LUMI repete o recado */
  }
}

export default function RecadoDaLumi() {
  const router = useRouter()
  const caminho = usePathname()
  const [pendentes, setPendentes] = useState<RecadosPendentes | null>(null)
  const [recado, setRecado] = useState<Recado | null>(null)
  const [restantes, setRestantes] = useState(0)
  const [saindo, setSaindo] = useState(false)

  const buscar = useCallback(async () => {
    try {
      const r = await recadosPendentes()
      if (r) setPendentes(r)
    } catch {
      /* sem rede agora não é assunto da LUMI — ela tenta na próxima */
    }
  }, [])

  /* ---------- 1. A primeira olhada ----------

     SEM TRAVA DE "JÁ PEDI", e isso custou uma hora para entender.

     A trava óbvia (`if (jaPedi) return; jaPedi = true`) FUNCIONA AO
     CONTRÁRIO aqui. Em desenvolvimento o React monta duas vezes de
     propósito, e a ordem é: efeito roda (marca a trava, agenda o
     relógio) → limpeza roda (CANCELA o relógio) → efeito roda de novo →
     a trava está marcada, ele desiste. Resultado: o relógio foi
     cancelado e nunca reagendado. A LUMI ficava muda, sem erro nenhum.

     Aqui a trava não faz falta: buscar duas vezes devolve a mesma coisa,
     e a limpeza cancela o relógio pendente. */
  /* E a cada troca de tela ela olha de novo. Não é excesso de zelo: a
     LUMI vive no layout do portal, então trocar de tela NÃO a monta de
     novo. Sem esta linha, quem entrasse na plataforma e ficasse navegando
     receberia o primeiro recado e mais nenhum, até fechar a aba.

     Uma tela, no máximo um recado: é isso que separa uma assistente de
     uma fila de pop-ups. Os já mostrados ficam guardados, então navegar
     não repete nada. */
  useEffect(() => {
    const t = setTimeout(buscar, ESPERA_ANTES_DE_FALAR)
    return () => clearTimeout(t)
  }, [buscar, caminho])

  /* ---------- 2. Escolher o que dizer ----------
     A escolha é da regra pura (testada caso a caso), e não daqui: é ela
     que sabe quais tipos a LUMI anuncia e quais já foram mostrados. */
  useEffect(() => {
    if (!pendentes) return
    const { recado: r, restantes: n } = proximoRecado(
      pendentes.avisos,
      pendentes.papel,
      lerMostrados()
    )
    setRecado(r)
    setRestantes(n)
    if (r) guardarMostrado(r.id)
  }, [pendentes])

  /* ---------- 3. Ouvir enquanto a pessoa está na tela ----------
     Sem isto, "sua nota foi lançada" só apareceria na próxima troca de
     tela — e o aluno que está parado esperando a nota é justamente quem
     precisa saber na hora.

     É o MESMO mecanismo de tempo real que a conversa da turma já usa
     (components/Chat/ChatDaTurma.tsx), na mesma tabela de sempre. As
     permissões do banco valem aqui também: cada pessoa só recebe o que é
     dela. */
  useEffect(() => {
    if (!pendentes?.userId) return
    const supabase = createClient()
    const canal = supabase
      .channel(`lumi-${pendentes.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `user_id=eq.${pendentes.userId}`,
        },
        () => {
          /* Não usamos o conteúdo que chega pelo canal: buscamos de novo
             pelo servidor. O aviso pode ter sido lido em outro aparelho no
             meio tempo, e o servidor é quem sabe disso. */
          buscar()
        }
      )
      .subscribe()

    /* Voltar para a aba é o outro momento em que vale perguntar: quem
       passou a manhã em outra janela volta com avisos acumulados. */
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') buscar()
    }
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [pendentes?.userId, buscar])

  if (!recado) return null

  const fechar = () => {
    /* Fechar NÃO marca como lido: o aviso continua no sino. O X é "agora
       não", não é "já vi". */
    setSaindo(true)
    setTimeout(() => {
      setRecado(null)
      setSaindo(false)
    }, 160)
  }

  const seguir = () => {
    /* Clicar é ler. Some do sino também — senão a pessoa vê o número
       vermelho continuar lá depois de ter feito exatamente o que o aviso
       pedia.

       CUIDADO QUE O TESTE PEGOU: aqui havia `setRecado(null)` como
       primeira linha. Isso desmonta o `<Link>` no meio do clique, e o
       navegador cancela a navegação — o recado sumia e a pessoa
       continuava na mesma tela. O botão parecia quebrado.

       Agora o link navega primeiro; o recado sai da tela no quadro
       seguinte, e a marcação de lido segue sozinha. Se ela falhar, o
       aviso continua no sino, que é o lado seguro do erro. */
    const id = recado.id
    setTimeout(() => setRecado(null), 0)
    marcarRecadoLido(id)
      .then(() => router.refresh())
      .catch(() => {})
  }

  return (
    <div
      role="status"
      data-teste="recado-da-lumi"
      className={`w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white/95 shadow-lg ring-1 ring-brand-950/10 backdrop-blur transition-all duration-150 ${
        saindo ? 'translate-y-1 opacity-0' : 'animate-float-in'
      }`}
    >
      <div className="flex items-start gap-2.5 px-3 pb-2.5 pt-3">
        <span className="relative mt-px h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-brand-500/25">
          <Image src="/lumi-avatar.png" alt="LUMI" fill sizes="28px" className="object-cover" />
        </span>

        <div className="min-w-0 flex-1">
          {/* A assinatura dela é o que faz o recado ser DELA e não do
              sistema — é essa a identidade que se quis dar aos avisos. */}
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand-700">
            LUMI
            <Sparkles className="h-2.5 w-2.5 text-accent-500" strokeWidth={2.6} />
            <span className="font-semibold normal-case tracking-normal text-gray-400">
              · {recado.titulo}
            </span>
          </p>

          <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-900">
            {recado.mensagem}
          </p>

          {/* Duas linhas, e não uma: cortar «Aula 1 — "O chamado do líder"»
              no meio do título tira justamente a informação que faz a
              pessoa decidir se clica agora. A regra pura já limitou o
              tamanho do texto; aqui é só o acabamento. */}
          {recado.detalhe && (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-gray-500">
              {recado.detalhe}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={fechar}
          aria-label="Agora não"
          data-teste="fechar-recado"
          className="-mr-0.5 shrink-0 text-gray-300 transition-colors hover:text-gray-500"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
        {restantes > 0 ? (
          <Link
            href={pendentes?.centralDeAvisos ?? "/dashboard/aluno/notificacoes"}
            data-teste="restantes"
            className="text-[11.5px] font-medium text-gray-400 transition-colors hover:text-brand-700"
          >
            +{restantes} {restantes === 1 ? 'aviso' : 'avisos'}
          </Link>
        ) : (
          <span />
        )}

        {recado.link ? (
          <Link
            href={recado.link}
            onClick={seguir}
            data-teste="acao"
            className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-brand-700 px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-800"
          >
            {recado.acao}
            <ArrowRight
              className="h-[13px] w-[13px] transition-transform duration-300 group-hover:translate-x-0.5"
              strokeWidth={2.4}
            />
          </Link>
        ) : (
          /* Sem link não há para onde levar — o botão vira "entendi", que
             é honesto: some da frente e marca como lido. */
          <button
            type="button"
            onClick={seguir}
            data-teste="acao"
            className="inline-flex h-8 shrink-0 items-center rounded-full bg-brand-700 px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-800"
          >
            Entendi
          </button>
        )}
      </div>
    </div>
  )
}
