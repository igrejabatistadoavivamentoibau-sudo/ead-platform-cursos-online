'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface OpcaoSelecao {
  valor: string
  rotulo: string
  descricao?: string
}

/**
 * Seletor próprio da plataforma.
 *
 * POR QUE NÃO USAR O <select> DO NAVEGADOR
 * O menu nativo é desenhado pelo sistema operacional, não por nós. Ele
 * ignora fonte, cor, espaçamento e cantos arredondados — no Windows abre
 * uma lista cinza de bordas retas, no celular abre uma roleta. É o que dá
 * aquela sensação de "formulário cru" no meio de uma tela caprichada, e
 * não há CSS que resolva: aquele pedaço da tela não é nosso.
 *
 * Este componente desenha a lista em HTML, então ela obedece à identidade
 * da plataforma. O custo é ter que reimplementar o que o navegador dava de
 * graça — teclado, foco, fechar ao clicar fora — e é isso que está abaixo.
 *
 * Um <input type="hidden"> acompanha o valor escolhido, para o componente
 * continuar funcionando dentro de um <form> comum, exatamente como o
 * <select> funcionava. Nenhuma tela precisou mudar por causa disso.
 */
export default function Selecao({
  name,
  opcoes,
  valorInicial = '',
  placeholder = 'Escolha uma opção',
  required = false,
  disabled = false,
  aoMudar,
}: {
  name?: string
  opcoes: OpcaoSelecao[]
  valorInicial?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  aoMudar?: (valor: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState(valorInicial)
  const [focado, setFocado] = useState(0)
  const caixaRef = useRef<HTMLDivElement>(null)

  const escolhida = opcoes.find((o) => o.valor === valor)

  /* QUANDO A TELA MANDA LIMPAR, ESTE SELETOR TEM DE OBEDECER.

     O valor escolhido morava só aqui dentro: `valorInicial` era lido uma
     vez, no primeiro desenho, e ignorado daí em diante. Quem chamava não
     tinha como desfazer a escolha.

     Isso derrubou a matrícula de aluno em produção. Ao matricular, a tela
     fazia `setSelecionado('')` para esvaziar a caixa — e a caixa continuava
     mostrando o mesmo aluno, porque ela não escutava. O segundo clique em
     "Adicionar" mandava o MESMO aluno de novo, o banco recusava por
     matrícula repetida (e fez certo), e o Next apagou a mensagem em
     produção: sobrou o parágrafo em inglês na tela.

     Nenhuma tela precisou mudar por causa disto. Quem passa um valor fixo
     continua igual, porque o efeito só dispara quando o valor MUDA; quem
     passa um estado agora é obedecido de verdade. */
  useEffect(() => {
    setValor(valorInicial)
  }, [valorInicial])

  useEffect(() => {
    if (!aberto) return
    const foraDaCaixa = (e: MouseEvent) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', foraDaCaixa)
    return () => document.removeEventListener('mousedown', foraDaCaixa)
  }, [aberto])

  const escolher = (v: string) => {
    setValor(v)
    setAberto(false)
    aoMudar?.(v)
  }

  /** Teclado: o <select> nativo dava isso de graça, aqui é na mão. */
  const teclas = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!aberto && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault()
      setAberto(true)
      setFocado(Math.max(0, opcoes.findIndex((o) => o.valor === valor)))
      return
    }
    if (!aberto) return

    if (e.key === 'Escape') {
      e.preventDefault()
      setAberto(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocado((i) => Math.min(i + 1, opcoes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocado((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const o = opcoes[focado]
      if (o) escolher(o.valor)
    }
  }

  return (
    <div ref={caixaRef} className="relative">
      {name && <input type="hidden" name={name} value={valor} required={required} />}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setAberto((v) => !v)}
        onKeyDown={teclas}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left text-[14px] transition-all disabled:opacity-50 ${
          aberto
            ? 'border-brand-500 bg-white ring-4 ring-brand-500/10'
            : 'border-gray-200 bg-gray-50/60 hover:border-gray-300 hover:bg-white'
        }`}
      >
        <span className={`min-w-0 truncate ${escolhida ? 'text-gray-900' : 'text-gray-400'}`}>
          {escolhida?.rotulo ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ${
            aberto ? 'rotate-180 text-brand-600' : ''
          }`}
          strokeWidth={2.2}
        />
      </button>

      {/* A lista aparece com um leve deslize + escala. Movimento curto (150ms)
          porque menu que demora a abrir passa sensação de sistema lento. */}
      <div
        role="listbox"
        className={`absolute z-50 mt-1.5 w-full origin-top overflow-hidden rounded-xl bg-white shadow-float ring-1 ring-brand-950/10 transition-all duration-150 ease-out ${
          aberto
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0'
        }`}
      >
        <div className="max-h-64 overflow-y-auto p-1">
          {opcoes.map((o, i) => {
            const ativa = o.valor === valor
            const emFoco = aberto && i === focado
            return (
              <button
                key={o.valor}
                type="button"
                role="option"
                aria-selected={ativa}
                onMouseEnter={() => setFocado(i)}
                onClick={() => escolher(o.valor)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  emFoco ? 'bg-brand-50' : ''
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all ${
                    ativa ? 'bg-brand-600 text-white' : 'ring-1 ring-gray-300'
                  }`}
                >
                  {ativa && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[13.5px] ${ativa ? 'font-bold text-brand-900' : 'font-medium text-gray-800'}`}
                  >
                    {o.rotulo}
                  </span>
                  {o.descricao && (
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-gray-500">
                      {o.descricao}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
