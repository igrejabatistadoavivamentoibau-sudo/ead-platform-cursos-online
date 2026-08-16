import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  FileText,
  Megaphone,
  MessagesSquare,
  Monitor,
  PenLine,
  PlayCircle,
  UserRound,
  Users,
} from 'lucide-react'

/* ============================================================
   PEÇAS VISUAIS DO INÍCIO DO ALUNO — design "Aurora" aprovado.

   São componentes puramente visuais: recebem números e textos prontos
   e não tocam no banco. É o que permitiu fotografá-los com dados de
   exemplo antes de ligar nos dados reais — e garante que a prévia e a
   página verdadeira nunca divirjam.
   ============================================================ */

/* ---------- Herói ---------- */

export function HeroAluno({
  nome,
  frase,
  aulasFeitas,
  aulasTotal,
  presencaPct,
  geralPct,
}: {
  nome: string
  frase: string
  aulasFeitas: number
  aulasTotal: number
  presencaPct: number | null
  geralPct: number
}) {
  const hoje = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(115deg,#0a3628,#0f513c_55%,#136247)] p-7 text-white shadow-[0_1px_2px_rgba(5,38,29,0.06),0_24px_48px_-24px_rgba(5,38,29,0.5)] animate-float-in">
      {/* Luzes de fundo: dourada no alto, verde embaixo — profundidade sem estampa */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_240px_at_85%_-30%,rgba(212,162,76,0.22),transparent_60%),radial-gradient(420px_220px_at_25%_130%,rgba(69,189,138,0.18),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.09]" />

      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0 max-w-xl">
          <p className="micro-rotulo flex items-center gap-2.5 text-[10px] font-bold tracking-[0.18em] text-accent-300">
            {hoje}
            <span className="h-px w-9 bg-gradient-to-r from-accent-300/60 to-transparent" />
          </p>
          <h1 className="mt-2.5 font-display text-[24px] font-bold tracking-[-0.022em]">
            Graça e Paz, {nome.split(' ')[0]}
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-white/65">{frase}</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="border-r border-white/[0.12] pr-6 text-right">
            <p className="font-display text-[21px] font-bold tracking-[-0.02em]">
              {aulasFeitas}
              <span className="text-[12px] font-semibold text-white/50">/{aulasTotal}</span>
            </p>
            <p className="text-[9.5px] font-semibold tracking-[0.14em] text-white/55">AULAS</p>
          </div>
          {presencaPct !== null && (
            <div className="border-r border-white/[0.12] pr-6 text-right">
              <p className="font-display text-[21px] font-bold tracking-[-0.02em]">{presencaPct}%</p>
              <p className="text-[9.5px] font-semibold tracking-[0.14em] text-white/55">PRESENÇA</p>
            </div>
          )}
          <div
            className="relative grid h-[86px] w-[86px] place-items-center rounded-full"
            style={{
              background: `conic-gradient(#e6bd68 0 ${geralPct}%, rgba(255,255,255,0.14) ${geralPct}%)`,
            }}
          >
            <div className="absolute inset-[7px] rounded-full bg-[#0e4a37]" />
            <div className="relative text-center leading-none">
              <p className="font-display text-[17px] font-bold tracking-[-0.02em]">{geralPct}%</p>
              <p className="mt-1 text-[8px] font-bold tracking-[0.14em] text-white/60">GERAL</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Cabeçalho de seção ---------- */

export function SecaoTitulo({
  icone: Icone,
  children,
  acao,
}: {
  icone: typeof PlayCircle
  children: React.ReactNode
  acao?: { href: string; label: string }
}) {
  return (
    <div className="mb-3.5 mt-7 flex items-center gap-2.5">
      <Icone className="h-3.5 w-3.5 text-brand-700" strokeWidth={2} />
      <h2 className="micro-rotulo text-[11px] font-extrabold tracking-[0.14em] text-[#41514a]">{children}</h2>
      <span className="h-px flex-1 bg-gradient-to-r from-brand-950/[0.08] to-transparent" />
      {acao && (
        <Link
          href={acao.href}
          className="flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 hover:text-brand-800"
        >
          {acao.label}
          <ArrowRight className="h-3 w-3" strokeWidth={2.2} />
        </Link>
      )}
    </div>
  )
}

/* ---------- Card vivo de curso ---------- */

/** Tons profundos por cor de curso — a versão madura da paleta dos cards. */
const TOM_CAPA: Record<string, string> = {
  esmeralda: 'linear-gradient(130deg,#0b3d2e,#12503c 70%,#186049)',
  oceano: 'linear-gradient(130deg,#12283f,#1b3a5c 70%,#22486f)',
  ambar: 'linear-gradient(130deg,#3c2c12,#54401d 70%,#6b5426)',
  violeta: 'linear-gradient(130deg,#241b3e,#35295a 70%,#443672)',
  rubi: 'linear-gradient(130deg,#3d1720,#57202c 70%,#6e2b38)',
  grafite: 'linear-gradient(130deg,#1d2523,#2b3532 70%,#3a4642)',
}

export function CursoCardVivo({
  href,
  titulo,
  professor,
  contexto,
  modalidade,
  cor,
  feitas,
  total,
  rotuloUnidade,
  cta,
}: {
  href: string
  titulo: string
  professor: string | null
  contexto: string
  modalidade: 'ead' | 'presencial'
  cor: string
  feitas: number
  total: number
  rotuloUnidade: string
  cta: string
}) {
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0
  const capa = TOM_CAPA[cor] ?? TOM_CAPA.esmeralda
  const IconeMod = modalidade === 'presencial' ? Users : Monitor
  // Barra segmentada legível: acima de 16 unidades os tracinhos viram pó,
  // então caímos para uma barra contínua.
  const segmentada = total > 0 && total <= 16

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-brand-950/[0.07] bg-white shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_26px_-18px_rgba(5,38,29,0.16)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-brand-700/[0.16] hover:shadow-[0_2px_4px_rgba(5,38,29,0.04),0_26px_44px_-22px_rgba(9,64,47,0.34)]"
    >
      <div className="relative h-[104px]" style={{ background: capa }}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(300px_130px_at_85%_-20%,rgba(255,255,255,0.14),transparent_60%)]" />
        {/* Fio dourado — o detalhe que separa a capa do corpo */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-accent-500/60 via-accent-500/10 to-transparent" />

        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.12] px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-white backdrop-blur-md">
          <IconeMod className="h-[11px] w-[11px]" strokeWidth={2} />
          {modalidade === 'presencial' ? 'PRESENCIAL' : 'EAD'}
        </span>

        <div
          className="absolute -bottom-[17px] right-3.5 grid h-11 w-11 place-items-center rounded-full border-[3px] border-white shadow-[0_3px_8px_rgba(5,38,29,0.14)]"
          style={{ background: `conic-gradient(#1fa06f 0 ${pct}%, #e7edea ${pct}%)` }}
        >
          <div className="absolute inset-1 rounded-full bg-white" />
          <b className="relative text-[9.5px] font-bold text-brand-800">{pct}%</b>
        </div>
      </div>

      <div className="p-4 pt-[15px]">
        <p className="font-display text-[14px] font-bold tracking-[-0.015em] text-gray-900">
          {titulo}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
          {professor && (
            <span className="flex items-center gap-1.5">
              <UserRound className="h-3 w-3 text-gray-400" strokeWidth={2} />
              {professor}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3 text-gray-400" strokeWidth={2} />
            {contexto}
          </span>
        </div>

        {segmentada ? (
          <div className="mt-3.5 flex gap-[3px]">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i < feitas ? 'bg-gradient-to-r from-brand-600 to-brand-500' : 'bg-[#ecf1ee]'
                }`}
              />
            ))}
          </div>
        ) : (
          <div className="mt-3.5 h-1 overflow-hidden rounded-full bg-[#ecf1ee]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {total > 0 ? `${rotuloUnidade} ${feitas} de ${total}` : 'Conteúdo em preparo'}
          </span>
          <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-brand-700">
            {cta}
            <ArrowRight
              className="h-[13px] w-[13px] transition-transform duration-300 group-hover:translate-x-[3px]"
              strokeWidth={2.2}
            />
          </span>
        </div>
      </div>
    </Link>
  )
}

/* ---------- Painéis da semana ---------- */

export interface ItemPainel {
  href: string
  titulo: string
  subtitulo: string
  icone: 'atividade' | 'aula' | 'resumo' | 'aviso' | 'inicial'
  inicial?: string
  etiqueta?: { texto: string; tom: 'ambar' | 'verde' }
}

const ICONE_ITEM = { atividade: PenLine, aula: PlayCircle, resumo: FileText, aviso: Megaphone }

export function PainelInicio({
  icone: Icone,
  titulo,
  resumo,
  itens,
  vazio,
}: {
  icone: typeof FileText
  titulo: string
  resumo: string
  itens: ItemPainel[]
  vazio: string
}) {
  return (
    <div className="rounded-2xl border border-brand-950/[0.07] bg-white p-4 pb-2.5 shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]">
      <div className="mb-1.5 flex items-center gap-2 border-b border-brand-950/[0.07] px-1 pb-2.5">
        <Icone className="h-3.5 w-3.5 text-brand-700" strokeWidth={2} />
        <h3 className="text-[12.5px] font-bold tracking-[-0.01em] text-gray-900">{titulo}</h3>
        <em className="ml-auto text-[10px] font-semibold not-italic text-gray-400">{resumo}</em>
      </div>

      {itens.length === 0 && (
        <p className="px-1 py-4 text-[12px] text-gray-400">{vazio}</p>
      )}

      {itens.map((item, i) => {
        const IconeItem = item.icone === 'inicial' ? null : ICONE_ITEM[item.icone]
        return (
          <Link
            key={i}
            href={item.href}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[#f6faf8]"
          >
            {IconeItem ? (
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                  item.icone === 'aviso' || item.icone === 'atividade'
                    ? 'border-[#f0e2bd] bg-[#fdf8ec] text-[#8a6116]'
                    : item.icone === 'aula'
                      ? 'border-brand-200 bg-brand-50 text-brand-700'
                      : 'border-brand-950/[0.07] bg-[#f3f7f5] text-[#41514a]'
                }`}
              >
                <IconeItem className="h-3.5 w-3.5" strokeWidth={1.9} />
              </span>
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#ddd3f2] bg-[#f4f1fb] text-[11px] font-bold text-[#5b46a8]">
                {item.inicial}
              </span>
            )}
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12.5px] font-bold tracking-[-0.01em] text-gray-900">
                {item.titulo}
              </span>
              <span className="block truncate text-[10.5px] text-gray-400">{item.subtitulo}</span>
            </span>
            {item.etiqueta && (
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-extrabold tracking-[0.1em] ${
                  item.etiqueta.tom === 'ambar'
                    ? 'border-[#eadcb2] bg-[#fdf9ee] text-[#8a6116]'
                    : 'border-brand-200 bg-brand-50 text-brand-800'
                }`}
              >
                {item.etiqueta.texto}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

export { FileText as IconePendencias, MessagesSquare as IconeConversas, PlayCircle as IconeContinue, CalendarDays as IconeSemana }
