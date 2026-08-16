'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Sparkles, X, BookOpen } from 'lucide-react'
import { saudacaoDoDia, type NovidadeLumi } from '@/app/lumi-actions'

const ICONE_TIPO: Record<NovidadeLumi['tipo'], string> = {
  novidade: '✨',
  melhoria: '⚡',
  correcao: '🔧',
  aviso: '📌',
}

/**
 * A saudação da LUMI no primeiro acesso do dia.
 *
 * DECISÕES
 *
 * 1. Aparece uma vez por dia, por pessoa — não por aparelho, não por aba.
 *    Quem controla isso é o servidor (ver app/lumi-actions.ts).
 *
 * 2. Só o primeiro nome. "Graça e Paz, José Carlos da Silva Junior" soa
 *    como cobrança de banco; "Graça e Paz, José" soa como gente.
 *
 * 3. Se não houver novidade nenhuma, ela ainda saúda. A mensagem existe
 *    para acolher, não só para anunciar recurso — e um bom dia sem
 *    novidade continua sendo um bom dia.
 */
export default function SaudacaoDiaria() {
  const [dados, setDados] = useState<{ nome: string; novidades: NovidadeLumi[] } | null>(null)
  const [fechado, setFechado] = useState(false)

  useEffect(() => {
    let vivo = true
    // Um respiro antes de aparecer: entrar junto com a tela carregando fica
    // atropelado, e a pessoa fecha por reflexo sem ler.
    const t = setTimeout(() => {
      saudacaoDoDia()
        .then((r) => {
          if (vivo && r) setDados(r)
        })
        .catch(() => {})
    }, 900)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [])

  if (!dados || fechado) return null

  const primeiroNome = dados.nome.trim().split(/\s+/)[0]

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-brand-950/40 backdrop-blur-[2px]"
        onClick={() => setFechado(true)}
      />

      <div className="relative w-full max-w-md animate-float-in overflow-hidden rounded-2xl bg-white shadow-deep ring-1 ring-brand-950/10">
        <div className="relative bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 px-6 pb-7 pt-6">
          <button
            type="button"
            onClick={() => setFechado(true)}
            aria-label="Fechar"
            className="absolute right-4 top-4 text-white/50 transition-colors hover:text-white"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          {/* A LUMI ocupa a direita do cabeçalho, em corpo inteiro. O texto
              respeita esse espaço para os dois não se atropelarem no celular. */}
          <div className="pr-[96px] sm:pr-[112px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-white/20">
              <Sparkles className="h-3 w-3" strokeWidth={2.4} />
              LUMI
            </span>

            <p className="mt-3.5 font-display text-[22px] font-bold leading-tight text-white">
              Graça e Paz, {primeiroNome}!
            </p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-50/80">
              Que alegria ter você por aqui hoje. Passei para te contar as novidades da plataforma.
            </p>
          </div>

          <Image
            src="/lumi-avatar.png"
            alt="LUMI"
            width={320}
            height={320}
            priority
            className="pointer-events-none absolute bottom-4 right-5 h-[92px] w-[92px] rounded-full opacity-95 ring-2 ring-white/25 sm:h-[104px] sm:w-[104px]"
          />
        </div>

        <div className="px-6 py-5">
          {dados.novidades.length > 0 ? (
            <ul className="space-y-3">
              {dados.novidades.map((n) => (
                <li key={n.id} className="flex gap-3">
                  <span className="mt-px shrink-0 text-[15px]">{ICONE_TIPO[n.tipo]}</span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-gray-900">{n.titulo}</p>
                    {n.descricao && (
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                        {n.descricao}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-start gap-3 text-[13.5px] leading-relaxed text-gray-600">
              <BookOpen className="mt-px h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
              Hoje não tenho novidade nova para contar — a plataforma está redondinha. Bom
              proveito nos estudos!
            </p>
          )}

          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="text-[13px] italic leading-relaxed text-gray-600">
              Que Deus abençoe o seu dia e ilumine os seus estudos. Conte comigo!
            </p>
            <div className="mt-3 flex items-center gap-2.5">
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-brand-500/25">
                <Image src="/lumi-avatar.png" alt="" fill sizes="36px" className="object-cover" />
              </span>
              <span className="leading-tight">
                <span className="flex items-center gap-1.5 font-display text-[13.5px] font-bold text-brand-700">
                  LUMI
                  <Sparkles className="h-3 w-3 text-accent-500" strokeWidth={2.4} />
                </span>
                <span className="text-[11.5px] text-gray-400">
                  Sua assistente na Escola de Líderes IBAU
                </span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFechado(true)}
            className="mt-5 h-10 w-full rounded-lg bg-brand-700 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-800"
          >
            Amém, vamos estudar!
          </button>
        </div>
      </div>
    </div>
  )
}
