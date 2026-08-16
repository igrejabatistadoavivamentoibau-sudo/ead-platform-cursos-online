'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sparkles, RefreshCw, X } from 'lucide-react'

/**
 * A LUMI avisando que saiu versão nova.
 *
 * O ERRO DA PRIMEIRA VERSÃO
 * Ela comparava a versão que a página tinha ACABADO DE CARREGAR com a do
 * servidor. Isso só detecta mudança quando a aba fica aberta DURANTE a
 * publicação — e esse não é o fluxo de ninguém. Quem publica e depois abre
 * o site nunca via aviso: ao abrir, a versão nova virava o próprio ponto de
 * comparação. A LUMI era cega justamente no caso para o qual foi pedida.
 *
 * COMO FUNCIONA AGORA
 * A versão que a pessoa realmente VIU fica guardada no navegador, entre
 * visitas. Ao abrir a plataforma, comparamos o que está no ar com o que ela
 * viu por último — então o aviso aparece já no primeiro acesso depois da
 * publicação, mesmo que o computador tenha sido desligado no meio.
 *
 * A marca só avança quando a pessoa clica em "Atualizar agora". Quem escolhe
 * "Depois" volta a ser avisado no próximo acesso, porque continua rodando
 * código antigo — e isso é exatamente o que ela precisa saber.
 *
 * POR QUE ISSO IMPORTA
 * Um site já aberto continua rodando o código antigo até alguém recarregar.
 * Sem este aviso, o "nunca sei quando de fato atualizou" era literalmente
 * verdade: a tela seguia velha, sem nenhum sinal.
 *
 * A verificação acontece quando a aba volta ao foco e a cada poucos minutos.
 * Preferi o foco como gatilho principal porque é o momento em que a pessoa
 * volta para a tela — é quando o aviso ajuda em vez de interromper.
 */
const CHAVE_VERSAO_VISTA = 'ibau:versao-vista'
const INTERVALO_MS = 3 * 60 * 1000

export default function AvisoDeAtualizacao() {
  const [temNova, setTemNova] = useState(false)
  const [dispensado, setDispensado] = useState(false)
  const [recarregando, setRecarregando] = useState(false)
  const [versaoNova, setVersaoNova] = useState<string | null>(null)

  const verificar = useCallback(async () => {
    try {
      const r = await fetch('/api/versao', { cache: 'no-store' })
      if (!r.ok) return
      const { versao } = (await r.json()) as { versao: string }
      if (!versao || versao === 'desenvolvimento') return

      const vista = localStorage.getItem(CHAVE_VERSAO_VISTA)

      // Primeira visita neste navegador: não há com o que comparar, só marca.
      if (!vista) {
        localStorage.setItem(CHAVE_VERSAO_VISTA, versao)
        return
      }

      if (versao !== vista) {
        setVersaoNova(versao)
        setTemNova(true)
      }
    } catch {
      // Sem internet no momento não é assunto da LUMI — ela tenta depois.
    }
  }, [])

  useEffect(() => {
    verificar()
    const timer = setInterval(verificar, INTERVALO_MS)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') verificar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', verificar)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', verificar)
    }
  }, [verificar])

  if (!temNova || dispensado) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-md animate-float-in sm:left-auto sm:right-6 sm:mx-0">
      <div className="overflow-hidden rounded-2xl bg-white shadow-deep ring-1 ring-brand-950/10">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-bold text-gray-900">
              Nova versão disponível!
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
              A plataforma foi atualizada desde o seu último acesso. Clique para carregar as
              novidades — leva um instante.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={recarregando}
                onClick={() => {
                  setRecarregando(true)
                  // Marca ANTES de recarregar: se marcasse depois, a página
                  // voltaria e o aviso reapareceria, num laço sem fim.
                  if (versaoNova) localStorage.setItem(CHAVE_VERSAO_VISTA, versaoNova)
                  window.location.reload()
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-[15px] w-[15px] ${recarregando ? 'animate-spin' : ''}`}
                  strokeWidth={2.2}
                />
                {recarregando ? 'Atualizando...' : 'Atualizar agora'}
              </button>
              <button
                type="button"
                onClick={() => setDispensado(true)}
                className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold text-gray-500 transition-colors hover:bg-gray-100"
              >
                Depois
              </button>
            </div>

            <p className="mt-2 text-[11px] text-gray-400">— LUMI</p>
          </div>

          <button
            type="button"
            onClick={() => setDispensado(true)}
            aria-label="Fechar aviso"
            className="shrink-0 text-gray-300 transition-colors hover:text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-1 bg-gradient-to-r from-brand-500 via-accent-400 to-brand-500" />
      </div>
    </div>
  )
}
