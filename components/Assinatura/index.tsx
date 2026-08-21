import { ShieldCheck } from 'lucide-react'
import {
  codigoDeConferencia,
  momentoDaAssinatura,
  estiloDoNome,
  tamanhoDaAssinatura,
  type EstiloDeAssinatura,
} from '@/lib/assinatura'

/* ============================================================
   O BLOCO DE ASSINATURA

   Componente de servidor, sem estado e sem interação: ele só desenha. É de
   propósito — um selo de correção que dependesse de JavaScript não
   apareceria no papel nem numa tela que carregou pela metade, e é
   justamente no papel que ele precisa aparecer.

   O DESENHO DIZ O QUE ELE É
   Assinatura em caligrafia por cima da linha, nome em letra de forma e
   papel embaixo, e o código de conferência ao lado da nota. Quem olha
   entende em um segundo que aquilo é um lacre, não um enfeite — e é o
   mesmo desenho na tela do aluno e no boletim impresso.
   ============================================================ */

export interface DadosDaAssinatura {
  entregaId: string
  assinanteId: string
  /** O nome congelado (users.assinatura_nome), não o nome atual. */
  nome: string
  papel: string
  estilo?: EstiloDeAssinatura | null
  em: string
  nota: number | null
  notaMaxima: number
}

export function BlocoDeAssinatura({ dados }: { dados: DadosDaAssinatura }) {
  const estilo = dados.estilo ?? estiloDoNome(dados.nome)
  const codigo = codigoDeConferencia({
    entregaId: dados.entregaId,
    assinanteId: dados.assinanteId,
    em: dados.em,
    nota: dados.nota,
  })

  return (
    <div className="mt-3 overflow-hidden rounded-xl bg-white ring-1 ring-brand-950/[0.08]">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 px-4 pb-3 pt-4">
        <div className="min-w-[190px] flex-1">
          <p
            className={`${
              estilo === 'classica' ? 'font-assinatura-classica' : 'font-assinatura-corrente'
            } select-none whitespace-nowrap leading-[1.15] text-brand-900`}
            style={{ fontSize: `${tamanhoDaAssinatura(dados.nome).px}px` }}
          >
            {dados.nome}
          </p>
          <div className="mt-1 border-t border-gray-300 pt-1.5">
            <p className="text-[12.5px] font-semibold text-gray-800">{dados.nome}</p>
            <p className="text-[11.5px] text-gray-500">{dados.papel}</p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-500">
            Nota atribuída
          </p>
          <p className="font-display text-[26px] font-bold leading-none text-brand-700 tabular-nums">
            {dados.nota === null ? '—' : Number(dados.nota).toLocaleString('pt-BR')}
            <span className="text-[14px] font-semibold text-gray-400">
              {' '}
              / {Number(dados.notaMaxima).toLocaleString('pt-BR')}
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 bg-gray-50/70 px-4 py-2 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5 font-medium text-brand-700">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
          Assinatura eletrônica
        </span>
        <span>Corrigida em {momentoDaAssinatura(dados.em)}</span>
        <span className="tabular-nums">
          Código de conferência <b className="font-mono text-gray-700">{codigo}</b>
        </span>
      </div>
    </div>
  )
}

/**
 * A mesma assinatura em HTML puro, para os documentos impressos.
 *
 * Não dá para reaproveitar o componente React aqui: o boletim é montado
 * como texto no servidor, sem React no meio. Duas versões do mesmo desenho
 * é o preço — e é por isso que as duas ficam neste arquivo, lado a lado,
 * para quem mexer numa lembrar da outra.
 */
export function assinaturaEmHtml(dados: DadosDaAssinatura): string {
  const estilo = dados.estilo ?? estiloDoNome(dados.nome)
  const codigo = codigoDeConferencia({
    entregaId: dados.entregaId,
    assinanteId: dados.assinanteId,
    em: dados.em,
    nota: dados.nota,
  })
  const fonte = estilo === 'classica' ? "'Great Vibes'" : "'Dancing Script'"
  const tamanho = tamanhoDaAssinatura(dados.nome).pt
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return `
  <div class="assinatura-eletronica">
    <div class="ae-nome" style="font-family:${fonte},'Segoe Script',cursive;font-size:${tamanho}pt">${esc(dados.nome)}</div>
    <div class="ae-linha">
      <b>${esc(dados.nome)}</b><br>
      <span>${esc(dados.papel)}</span>
    </div>
    <div class="ae-rodape">
      Assinatura eletrônica · corrigida em ${momentoDaAssinatura(dados.em)} ·
      código <b>${codigo}</b>
    </div>
  </div>`
}
