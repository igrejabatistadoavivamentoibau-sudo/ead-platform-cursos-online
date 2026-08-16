import Image from 'next/image'
import { GraduationCap, Presentation, Heart } from 'lucide-react'

/* ============================================================
   A ACOLHIDA DA FICHA DE INSCRIÇÃO

   Quem chega aqui está tomando uma decisão — começar a estudar, ou se
   dispor a ensinar. A ficha não pode receber essa pessoa como um balcão
   de repartição. Por isso a página abre com a saudação da casa
   ("Graça e Paz"), fala com a pessoa no singular e fecha com uma bênção
   e uma palavra.

   Aluno e professor recebem textos diferentes de propósito: um está
   sendo acolhido para aprender, o outro está sendo honrado por servir.
   O mesmo parágrafo genérico para os dois não diria nada para nenhum.

   Está num componente separado da página porque assim a prévia que eu
   uso para conferir o desenho e a tela de verdade são o MESMO código —
   o que eu fotografo é o que a pessoa vê.
   ============================================================ */

export const TEXTOS = {
  aluno: {
    selo: 'Inscrição de Aluno',
    ola: 'Olá! Seja muito bem-vindo(a).',
    boasVindas:
      'Que alegria ter você aqui. A Escola de Líderes existe para preparar quem Deus está levantando na nossa casa — e o seu lugar já está guardado.',
    comoFunciona:
      'Preencha a ficha abaixo, escolha a turma que deseja cursar e envie. A liderança analisa a sua inscrição e libera o seu acesso à plataforma.',
    bencao: 'Que o Senhor abençoe este novo passo na sua caminhada e frutifique em você.',
    versiculo: { texto: 'Instrua o sábio, e ele será ainda mais sábio.', ref: 'Provérbios 9.9' },
  },
  professor: {
    selo: 'Inscrição de Professor',
    ola: 'Olá, professor(a)! Seja bem-vindo(a).',
    boasVindas:
      'É uma honra contar com o seu chamado. Ensinar na Escola de Líderes é servir diretamente à formação de quem vai cuidar do rebanho amanhã.',
    comoFunciona:
      'Preencha os seus dados e conte um pouco da sua caminhada e experiência ministerial. A liderança analisa o seu cadastro e entra em contato com você.',
    bencao: 'Que Deus abençoe o seu ministério e multiplique o que Ele já depositou em você.',
    versiculo: {
      texto: 'O que ouviu de mim, confia-o a homens fiéis, idôneos para instruir também a outros.',
      ref: '2 Timóteo 2.2',
    },
  },
} as const

export type PapelInscricao = keyof typeof TEXTOS

/** Cabeçalho: marca, saudação, boas-vindas e o que vai acontecer depois. */
export function AcolhidaTopo({ papel }: { papel: PapelInscricao }) {
  const t = TEXTOS[papel]
  const Icone = papel === 'professor' ? Presentation : GraduationCap

  return (
    <>
      <div className="text-center">
        <Image
          src="/ibau-capelo.webp"
          alt="Escola de Líderes IBAU"
          width={720}
          height={756}
          priority
          className="mx-auto h-auto w-[168px] drop-shadow-[0_18px_38px_rgba(0,0,0,0.45)] sm:w-[186px]"
        />

        <p className="micro-rotulo mt-6 flex items-center justify-center gap-3 text-[11px] font-bold tracking-[0.2em] text-accent-300">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-accent-300/50" />
          GRAÇA E PAZ
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-accent-300/50" />
        </p>

        <h1 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[29px]">
          {t.ola}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-brand-50/75">
          {t.boasVindas}
        </p>

        <span className="micro-rotulo mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md">
          <Icone className="h-3.5 w-3.5 text-accent-300" strokeWidth={2.2} />
          {t.selo}
        </span>
      </div>

      <div className="mt-7 overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.05] backdrop-blur-md">
        <div className="h-px bg-gradient-to-r from-accent-400/60 via-accent-400/15 to-transparent" />
        <p className="px-5 py-4 text-[13.5px] leading-relaxed text-brand-50/80">{t.comoFunciona}</p>
      </div>
    </>
  )
}

/** Rodapé: a bênção e a palavra. */
export function AcolhidaRodape({ papel }: { papel: PapelInscricao }) {
  const t = TEXTOS[papel]

  return (
    <div className="mt-7 text-center">
      {/* O coração fica ACIMA do texto, centralizado. Ao lado, numa bênção
          de duas linhas, ele descolava para a esquerda e parecia perdido. */}
      <Heart className="mx-auto mb-2.5 h-4 w-4 text-accent-400" strokeWidth={1.9} />
      <p className="mx-auto max-w-sm text-[13.5px] italic leading-relaxed text-brand-50/70">
        {t.bencao}
      </p>

      <div className="mx-auto mt-5 max-w-xs">
        <span className="block h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <p className="mt-4 font-display text-[13.5px] leading-relaxed text-white/60">
          “{t.versiculo.texto}”
        </p>
        <p className="micro-rotulo mt-1.5 text-[10px] font-bold tracking-[0.16em] text-accent-300/80">
          {t.versiculo.ref.toUpperCase()}
        </p>
      </div>
    </div>
  )
}

/** O fundo verde profundo com as luzes — usado pela página inteira. */
export const FUNDO_INSCRICAO =
  'relative min-h-screen overflow-hidden bg-[linear-gradient(160deg,#05261d,#0a3628_45%,#0d4433)] px-4 py-10'

export function LuzesDeFundo() {
  return (
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(760px_420px_at_50%_-10%,rgba(212,162,76,0.18),transparent_62%),radial-gradient(620px_380px_at_15%_105%,rgba(69,189,138,0.14),transparent_62%)]" />
  )
}
