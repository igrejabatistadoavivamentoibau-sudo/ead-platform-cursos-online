import Link from 'next/link'
import type { ReactNode } from 'react'
import * as Icones from 'lucide-react'
import Voltar, { RegistroDaTrilha } from './Voltar'

/* ============================================================
   PRIMITIVOS DE INTERFACE
   Um lugar só para as peças repetidas da plataforma. Antes cada
   tela reinventava seu cabeçalho, botão e cartão com valores
   ligeiramente diferentes — é isso que dá a sensação de "feito à mão",
   por mais caprichada que seja cada tela isolada.
   ============================================================ */

function Icone({ nome, className }: { nome: string; className?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const C = (Icones as any)[nome] ?? Icones.Circle
  return <C className={className} strokeWidth={1.9} />
}

/* ---------------------- Cabeçalho de página ---------------------- */

export function PageHeader({
  titulo,
  descricao,
  voltar,
  acoes,
  selo,
}: {
  titulo: string
  descricao?: string
  voltar?: { href: string; label: string }
  acoes?: ReactNode
  selo?: ReactNode
}) {
  return (
    <div className="mb-7">
      {/* O "voltar" agora usa a trilha (lib/trilha.ts): se existe uma tela
          anterior aqui dentro, ele volta para ELA e devolve a rolagem no
          ponto em que a pessoa estava. Só cai no endereço declarado quando
          não há histórico — link de fora, aba nova, F5 no meio do caminho.

          Quando a tela não tem botão de voltar, o registro entra sozinho:
          sem ele a trilha ficaria com buracos, e o "voltar" da tela
          seguinte pularia uma casa. */}
      {voltar ? (
        <Voltar href={voltar.href} label={voltar.label} titulo={titulo} />
      ) : (
        <RegistroDaTrilha titulo={titulo} />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {selo && <div className="mb-2">{selo}</div>}
          <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-gray-900 sm:text-[26px]">
            {titulo}
          </h1>
          {descricao && (
            <p className="mt-1 max-w-2xl text-[14.5px] leading-relaxed text-gray-500">
              {descricao}
            </p>
          )}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </div>
  )
}

/* ---------------------------- Cartão ---------------------------- */

/**
 * A SUPERFÍCIE VIVA
 *
 * O que fazia os cartões parecerem "secos e duros" não era a cor: era a
 * ausência de profundidade. Um anel de 1px e nada mais deixa a peça
 * *desenhada* sobre a tela em vez de *pousada* nela.
 *
 * A receita usada em toda a área logada, e repetida aqui num lugar só:
 *   1. borda hairline escura, não cinza — assenta na paleta da marca;
 *   2. duas sombras — uma de contato, curtinha, e uma longa e difusa que
 *      dá a altura;
 *   3. canto 2xl, que combina com o herói e com os cards de curso.
 */
export const SUPERFICIE =
  'rounded-2xl bg-white border border-brand-950/[0.07] shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]'

/** Levantar no hover: só para cartões clicáveis. */
export const SUPERFICIE_HOVER =
  'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-brand-700/[0.16] hover:shadow-[0_2px_4px_rgba(5,38,29,0.04),0_26px_44px_-22px_rgba(9,64,47,0.34)]'

export function Card({
  children,
  className = '',
  padding = true,
  elevar = false,
}: {
  children: ReactNode
  className?: string
  padding?: boolean
  /** Levanta no hover — use quando o cartão inteiro for clicável. */
  elevar?: boolean
}) {
  return (
    <div
      className={`${SUPERFICIE} ${elevar ? SUPERFICIE_HOVER : ''} ${padding ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function CardTitulo({
  children,
  icone,
  acao,
}: {
  children: ReactNode
  icone?: string
  acao?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="flex items-center gap-2 font-display text-[15px] font-bold tracking-[-0.01em] text-gray-900">
        {icone && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-700">
            <Icone nome={icone} className="h-3.5 w-3.5" />
          </span>
        )}
        {children}
      </h2>
      {/* Fio que morre no vazio: fecha o título sem virar uma régua dura */}
      <span className="h-px flex-1 bg-gradient-to-r from-brand-950/[0.08] to-transparent" />
      {acao}
    </div>
  )
}

/* ---------------------------- Botões ---------------------------- */

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo'

const ESTILO_BOTAO: Record<Variante, string> = {
  primario:
    'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-sm shadow-brand-950/10',
  secundario:
    'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300 hover:text-gray-900 hover:bg-gray-50',
  fantasma: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
}

const TAMANHO_BOTAO = {
  sm: 'h-8 px-3 text-[12.5px] gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-lg',
  lg: 'h-10 px-4 text-[13.5px] gap-2 rounded-lg',
}

const BASE_BOTAO =
  'inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap'

export function Botao({
  children,
  variante = 'primario',
  tamanho = 'md',
  icone,
  className = '',
  ...props
}: {
  children?: ReactNode
  variante?: Variante
  tamanho?: keyof typeof TAMANHO_BOTAO
  icone?: string
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${BASE_BOTAO} ${ESTILO_BOTAO[variante]} ${TAMANHO_BOTAO[tamanho]} ${className}`}
      {...props}
    >
      {icone && <Icone nome={icone} className="h-[15px] w-[15px] shrink-0" />}
      {children}
    </button>
  )
}

export function BotaoLink({
  children,
  href,
  variante = 'primario',
  tamanho = 'md',
  icone,
  className = '',
  target,
}: {
  children?: ReactNode
  href: string
  variante?: Variante
  tamanho?: keyof typeof TAMANHO_BOTAO
  icone?: string
  className?: string
  target?: string
}) {
  return (
    <Link
      href={href}
      target={target}
      className={`${BASE_BOTAO} ${ESTILO_BOTAO[variante]} ${TAMANHO_BOTAO[tamanho]} ${className}`}
    >
      {icone && <Icone nome={icone} className="h-[15px] w-[15px] shrink-0" />}
      {children}
    </Link>
  )
}

/* ----------------------------- Selo ----------------------------- */

export type TomSelo = 'neutro' | 'verde' | 'ambar' | 'vermelho' | 'azul' | 'roxo'

const ESTILO_SELO: Record<TomSelo, string> = {
  neutro: 'bg-gray-100 text-gray-600 ring-gray-200',
  verde: 'bg-brand-50 text-brand-700 ring-brand-200',
  ambar: 'bg-amber-50 text-amber-700 ring-amber-200',
  vermelho: 'bg-red-50 text-red-700 ring-red-200',
  azul: 'bg-sky-50 text-sky-700 ring-sky-200',
  roxo: 'bg-violet-50 text-violet-700 ring-violet-200',
}

export function Selo({
  children,
  tom = 'neutro',
  icone,
  pulsar = false,
}: {
  children: ReactNode
  tom?: TomSelo
  icone?: string
  pulsar?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-[3px] text-[11px] font-semibold ring-1 ${ESTILO_SELO[tom]}`}
    >
      {pulsar && <span className="h-1.5 w-1.5 rounded-full bg-current animate-soft-pulse" />}
      {icone && !pulsar && <Icone nome={icone} className="h-3 w-3" />}
      {children}
    </span>
  )
}

/* ------------------------- Estado vazio ------------------------- */

export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone: string
  titulo: string
  descricao?: string
  acao?: ReactNode
}) {
  return (
    <div className={`${SUPERFICIE} px-6 py-14 text-center`}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100/70 text-brand-700">
        <Icone nome={icone} className="h-6 w-6" />
      </div>
      <p className="font-display text-[15px] font-bold text-gray-900">{titulo}</p>
      {descricao && (
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-gray-500">
          {descricao}
        </p>
      )}
      {acao && <div className="mt-5 flex justify-center">{acao}</div>}
    </div>
  )
}

/* --------------------------- Indicador -------------------------- */

export function Indicador({
  icone,
  valor,
  label,
  destaque = false,
}: {
  icone: string
  valor: ReactNode
  label: string
  destaque?: boolean
}) {
  return (
    <div className={`${SUPERFICIE} group relative overflow-hidden p-4 ${SUPERFICIE_HOVER}`}>
      {/* Fio dourado no topo, mesma assinatura dos cards de curso */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent-500/50 via-accent-500/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-700 transition-colors duration-300 group-hover:border-brand-700 group-hover:bg-brand-700 group-hover:text-white">
        <Icone nome={icone} className="h-[17px] w-[17px]" />
      </div>
      <div className="font-display text-[22px] font-bold tracking-[-0.02em] text-gray-900 tabular-nums">
        {valor}
      </div>
      <div className="mt-0.5 text-[12.5px] leading-snug text-gray-500">{label}</div>
      {destaque && (
        <span className="mt-2.5 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-brand-700">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-soft-pulse" />
          ativo agora
        </span>
      )}
    </div>
  )
}

/* ----------------------------- Abas ----------------------------- */

export function Abas({
  itens,
  atual,
}: {
  itens: { href: string; label: string; icone?: string; contador?: number }[]
  atual: string
}) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200/80">
      {itens.map((item) => {
        const ativo = item.href === atual
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold transition-colors ${
              ativo ? 'text-brand-800' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {item.icone && <Icone nome={item.icone} className="h-4 w-4" />}
            {item.label}
            {item.contador !== undefined && item.contador > 0 && (
              <span
                className={`rounded px-1.5 py-px text-[10.5px] font-bold tabular-nums ${
                  ativo ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {item.contador}
              </span>
            )}
            {ativo && (
              <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand-600" />
            )}
          </Link>
        )
      })}
    </div>
  )
}

/* -------------------------- Campo de form ------------------------ */

/**
 * A receita mora em `app/globals.css`, na classe `.campo`.
 *
 * A constante continua exportada porque metade do projeto a importa, e
 * trocar tudo de uma vez só criaria risco sem ganho. O que mudou é o dono
 * da aparência: era uma cadeia de utilitários repetida em seis arquivos
 * com valores levemente diferentes; agora é uma definição só, e mexer no
 * foco de todos os campos da plataforma é mexer em quatro linhas de CSS.
 *
 * Num `<select>`, some `campo-select` à classe: ele troca a seta pintada
 * pelo sistema operacional pela nossa, e iguala a altura à de um campo de
 * texto ao lado.
 */
export const CAMPO = 'campo'

export function Campo({
  label,
  dica,
  children,
  className = '',
}: {
  label: string
  dica?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12.5px] font-semibold text-gray-700">{label}</label>
      {children}
      {dica && <p className="mt-1 text-[11.5px] text-gray-400">{dica}</p>}
    </div>
  )
}

/* ---------------------------- Alerta ---------------------------- */

export function Alerta({
  children,
  tom = 'erro',
}: {
  children: ReactNode
  tom?: 'erro' | 'aviso' | 'info' | 'sucesso'
}) {
  const estilo = {
    erro: 'bg-red-50 text-red-700 ring-red-200',
    aviso: 'bg-amber-50 text-amber-800 ring-amber-200',
    info: 'bg-sky-50 text-sky-800 ring-sky-200',
    sucesso: 'bg-brand-50 text-brand-800 ring-brand-200',
  }[tom]

  const icone = {
    erro: 'AlertCircle',
    aviso: 'AlertTriangle',
    info: 'Info',
    sucesso: 'CheckCircle2',
  }[tom]

  return (
    <div
      role={tom === 'erro' ? 'alert' : undefined}
      className={`flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] leading-snug ring-1 ${estilo}`}
    >
      <Icone nome={icone} className="mt-px h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/* -------------------------- Barra de progresso ------------------- */

export function Progresso({
  valor,
  className = '',
  cor = 'bg-brand-600',
}: {
  valor: number
  className?: string
  cor?: string
}) {
  return (
    <div className={`h-[3px] overflow-hidden rounded-full bg-gray-100 ${className}`}>
      <div
        className={`h-full rounded-full ${cor} transition-[width] duration-700 ease-out`}
        style={{ width: `${Math.max(0, Math.min(100, valor))}%` }}
      />
    </div>
  )
}


export { default as Selecao, type OpcaoSelecao } from './Selecao'
