'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CreditCard,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  Copy,
  Plug,
  PlugZap,
} from 'lucide-react'
import { ligarAsaas, desligarAsaas } from '@/app/dashboard/admin/loja/actions'
import { Alerta } from '@/components/ui'

export interface EstadoNaTela {
  ligado: boolean
  ambiente: 'sandbox' | 'producao'
  contaNome: string | null
  chaveFinal: string | null
  avisoRegistrado: boolean
  ligadoEm: string | null
  ligadoPor: string | null
  porVariavelDeAmbiente: boolean
}

/* ============================================================
   A CHAVE DO ASAAS, COLADA AQUI

   O pedido, na letra: "deixe um campo onde eu possa anexar a chave da API
   do Asaas para que eu coloque na plataforma e em caso de sucesso o campo
   feche, para que eu não tenha que te enviar por aqui."

   As duas metades importam, e a segunda mais do que parece.

   O CAMPO SÓ APARECE QUANDO PRECISA. Enquanto não há chave, ele é o
   assunto da tela. Assim que a chave é aceita, ele SOME e dá lugar ao
   estado: de qual conta é, qual ambiente, os últimos seis caracteres. Um
   campo de senha que continua na tela depois de preenchido é um convite a
   colar de novo, e a cada vez a chave passa outra vez pelo navegador.

   A CHAVE NUNCA VOLTA. Nem para conferir, nem "mascarada". O servidor
   guarda no cofre cifrado e devolve seis caracteres — o bastante para
   reconhecer QUAL chave está lá, inútil para quem copiar. Trocar é colar
   uma nova; não existe "ver a atual".

   E ela nunca chega em texto neste componente depois do envio: some do
   estado no mesmo instante em que o servidor responde que deu certo.
   ============================================================ */

export default function ConexaoAsaas({ estado }: { estado: EstadoNaTela }) {
  const [abrindo, setAbrindo] = useState(false)
  const [chave, setChave] = useState('')
  const [ambiente, setAmbiente] = useState<'sandbox' | 'producao'>('producao')
  const [mostrando, setMostrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoDesligar, setConfirmandoDesligar] = useState(false)
  const [pendencia, setPendencia] = useState<{
    url: string
    token: string
    motivo: string
  } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    startTransition(async () => {
      const r = await ligarAsaas(chave, ambiente)
      if (!r.ok) return setErro(r.erro)

      /* Deu certo: a chave sai da memória desta tela ANTES de qualquer
         outra coisa, e o campo fecha. */
      setChave('')
      setMostrando(false)
      setAbrindo(false)
      if (!r.avisoRegistrado && r.avisoUrl && r.avisoToken) {
        setPendencia({ url: r.avisoUrl, token: r.avisoToken, motivo: r.avisoMotivo ?? '' })
      } else {
        setPendencia(null)
      }
      router.refresh()
    })
  }

  const desligar = () => {
    setErro(null)
    startTransition(async () => {
      const r = await desligarAsaas()
      if (!r.ok) return setErro(r.erro)
      setConfirmandoDesligar(false)
      setPendencia(null)
      router.refresh()
    })
  }

  /* ---------------- LIGADO ---------------- */
  if (estado.ligado && !abrindo) {
    const producao = estado.ambiente === 'producao'
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/80 to-white shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]">
          <div className="flex flex-wrap items-start gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[0_4px_12px_-2px_rgba(18,128,90,0.4)]">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.1} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-[15.5px] font-bold text-brand-950">
                  Cobrança on-line ligada
                </h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[11px] font-bold ring-1 ${
                    producao
                      ? 'bg-brand-600 text-white ring-brand-700'
                      : 'bg-amber-50 text-amber-800 ring-amber-200'
                  }`}
                >
                  {producao ? 'Produção' : 'Teste (sandbox)'}
                </span>
              </div>

              <p className="mt-1 text-[13px] leading-relaxed text-brand-900/75">
                {estado.contaNome ? (
                  <>
                    Conta <b>{estado.contaNome}</b> no Asaas.{' '}
                  </>
                ) : null}
                Quem comprar recebe o link de pagamento na hora, e o pedido vira{' '}
                <b>pago</b> sozinho assim que o dinheiro cair.
              </p>

              <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-2 text-[12px]">
                <div>
                  <dt className="text-brand-900/55">Chave guardada</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 font-semibold text-brand-950">
                    <Lock className="h-3 w-3" strokeWidth={2.4} />
                    <span className="tracking-[0.15em] text-brand-900/50">••••••</span>
                    <span className="font-mono tabular-nums">{estado.chaveFinal}</span>
                  </dd>
                </div>
                {estado.ligadoEm && (
                  <div>
                    <dt className="text-brand-900/55">Ligada em</dt>
                    <dd className="mt-0.5 font-semibold text-brand-950">
                      {new Date(estado.ligadoEm).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                      {estado.ligadoPor ? ` · ${estado.ligadoPor}` : ''}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-brand-900/55">Aviso de pagamento</dt>
                  <dd
                    className={`mt-0.5 flex items-center gap-1.5 font-semibold ${
                      estado.avisoRegistrado ? 'text-brand-950' : 'text-amber-700'
                    }`}
                  >
                    {estado.avisoRegistrado ? (
                      <>
                        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                        cadastrado sozinho
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />
                        falta cadastrar
                      </>
                    )}
                  </dd>
                </div>
              </dl>

              {estado.porVariavelDeAmbiente && (
                <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-[11.5px] text-brand-900/70 ring-1 ring-brand-200">
                  Esta chave veio de uma variável de ambiente configurada por fora. Colar uma chave
                  aqui passa a valer no lugar dela.
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setChave('')
                  setAmbiente(estado.ambiente)
                  setAbrindo(true)
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-[13px] font-semibold text-brand-800 ring-1 ring-brand-300 transition-all hover:bg-brand-50 active:scale-[0.98]"
              >
                <CreditCard className="h-4 w-4" strokeWidth={2.1} />
                Trocar chave
              </button>

              {confirmandoDesligar ? (
                <span className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={desligar}
                    className="h-9 rounded-lg bg-red-600 px-3 text-[12.5px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isPending ? 'Desligando...' : 'Desligar mesmo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoDesligar(false)}
                    className="h-9 rounded-lg px-2.5 text-[12.5px] font-semibold text-gray-500 hover:bg-gray-100"
                  >
                    Não
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoDesligar(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  <Plug className="h-4 w-4" strokeWidth={2.1} />
                  Desligar
                </button>
              )}
            </div>
          </div>

          {confirmandoDesligar && (
            <p className="border-t border-brand-200 bg-white px-5 py-3 text-[12.5px] text-gray-600">
              Desligar apaga a chave do cofre. Os pedidos já feitos continuam onde estão, e a loja
              volta a funcionar com confirmação manual na tela de Pedidos.
            </p>
          )}
        </div>

        {erro && <Alerta>{erro}</Alerta>}
        {pendencia && <AvisoManual {...pendencia} />}
      </div>
    )
  }

  /* ---------------- DESLIGADO, ou trocando a chave ---------------- */
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]">
        <div className="flex flex-wrap items-start gap-4 border-b border-gray-100 bg-gray-50/50 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
            <PlugZap className="h-5 w-5" strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[15.5px] font-bold text-gray-900">
              {estado.ligado ? 'Trocar a chave do Asaas' : 'Ligar a cobrança on-line'}
            </h3>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-gray-500">
              {estado.ligado ? (
                <>
                  Cole a chave nova. A antiga é apagada do cofre no mesmo instante — não ficam duas
                  chaves válidas.
                </>
              ) : (
                <>
                  A loja já funciona sem isto: o aluno faz o pedido e a secretaria confirma o
                  recebimento na tela de Pedidos. O que a chave acrescenta é o{' '}
                  <b>link de pagamento automático</b> e a baixa sozinha quando o dinheiro cai.
                </>
              )}
            </p>
          </div>
          {!abrindo && (
            <button
              type="button"
              onClick={() => {
                setChave('')
                setAbrindo(true)
              }}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-brand-800 active:scale-[0.98]"
            >
              <CreditCard className="h-4 w-4" strokeWidth={2.1} />
              Colar a chave
            </button>
          )}
        </div>

        {abrindo && (
          <form onSubmit={enviar} className="p-5">
            {/* O AMBIENTE VEM ANTES DA CHAVE de propósito: cada ambiente do
                Asaas tem a SUA chave, e uma não vale no lugar da outra.
                Escolher depois de colar é o caminho mais curto para o
                "chave recusada" que ninguém entende. */}
            <fieldset className="mb-4">
              <legend className="mb-1.5 text-[12.5px] font-semibold text-gray-700">
                De qual ambiente é esta chave
              </legend>
              <div className="grid max-w-lg grid-cols-2 gap-2">
                {(
                  [
                    {
                      valor: 'producao' as const,
                      titulo: 'Produção',
                      ajuda: 'cobra de verdade',
                    },
                    {
                      valor: 'sandbox' as const,
                      titulo: 'Teste (sandbox)',
                      ajuda: 'para experimentar',
                    },
                  ]
                ).map((o) => (
                  <button
                    key={o.valor}
                    type="button"
                    onClick={() => setAmbiente(o.valor)}
                    className={`rounded-xl border-2 px-3.5 py-2.5 text-left transition-colors ${
                      ambiente === o.valor
                        ? 'border-brand-600 bg-brand-50/60'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="block text-[13px] font-semibold text-gray-900">
                      {o.titulo}
                    </span>
                    <span className="block text-[11.5px] text-gray-500">{o.ajuda}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="mb-1.5 block text-[12.5px] font-semibold text-gray-700" htmlFor="chave-asaas">
              Chave da API
            </label>
            <div className="relative max-w-2xl">
              <input
                id="chave-asaas"
                type={mostrando ? 'text' : 'password'}
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                placeholder="$aact_..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50/60 py-2.5 pl-3.5 pr-11 font-mono text-[13px] tracking-tight transition-all placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
              />
              <button
                type="button"
                onClick={() => setMostrando((v) => !v)}
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label={mostrando ? 'Esconder a chave' : 'Mostrar a chave'}
              >
                {mostrando ? (
                  <EyeOff className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={2} />
                )}
              </button>
            </div>

            <p className="mt-2 flex max-w-2xl items-start gap-2 text-[11.5px] leading-relaxed text-gray-500">
              <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={2.2} />
              <span>
                No Asaas: <b>Configurações → Integrações → Chave de API</b>. Aqui ela vai para um
                cofre cifrado do banco e <b>nunca mais é exibida</b> — nem para você. Depois de
                salvar, esta tela mostra só os seis últimos caracteres, para você reconhecer qual
                chave está ligada.
              </span>
            </p>

            {erro && (
              <div className="mt-4 max-w-2xl">
                <Alerta>{erro}</Alerta>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isPending || chave.trim().length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-[13.5px] font-semibold text-white shadow-sm transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" strokeWidth={2.2} />
                {isPending ? 'Conferindo com o Asaas...' : 'Conferir e ligar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setChave('')
                  setErro(null)
                  setAbrindo(false)
                }}
                className="h-10 rounded-lg px-4 text-[13.5px] font-semibold text-gray-600 transition-colors hover:bg-gray-100"
              >
                Cancelar
              </button>
            </div>

            <p className="mt-3 text-[11.5px] text-gray-400">
              A chave é conferida com o Asaas antes de ser guardada. Se ele recusar, nada é salvo.
            </p>
          </form>
        )}
      </div>

      {erro && !abrindo && <Alerta>{erro}</Alerta>}
      {pendencia && <AvisoManual {...pendencia} />}
    </div>
  )
}

/* ------------------------------------------------------------
   O PLANO B DO AVISO DE PAGAMENTO

   A plataforma tenta cadastrar o aviso sozinha pela API do Asaas. Quando
   isso não dá certo — conta sem permissão, aviso já cadastrado, uma
   instabilidade —, a chave continua valendo e a cobrança funciona; o que
   falta é a BAIXA automática.

   Então esta caixa aparece uma vez, com o endereço e a senha para colar no
   painel do Asaas. É a única situação em que essa senha passa pelo
   navegador, e ela some da tela assim que a página for recarregada.
   ------------------------------------------------------------ */
function AvisoManual({ url, token, motivo }: { url: string; token: string; motivo: string }) {
  const [copiado, setCopiado] = useState<string | null>(null)

  const copiar = async (texto: string, qual: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(qual)
      setTimeout(() => setCopiado(null), 1800)
    } catch {
      setCopiado(null)
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2.2} />
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-[14.5px] font-bold text-amber-900">
            A chave está ligada, mas o aviso de pagamento ficou faltando
          </h4>
          <p className="mt-1 text-[12.5px] leading-relaxed text-amber-900/85">
            Tentei cadastrar sozinha e o Asaas respondeu: <i>{motivo}</i>. A cobrança já funciona —
            o que falta é o pedido virar &ldquo;pago&rdquo; sozinho. No Asaas, em{' '}
            <b>Configurações → Integrações → Webhooks</b>, cadastre com estes dois valores.{' '}
            <b>Copie agora:</b> a senha não é mostrada de novo.
          </p>

          <div className="mt-3 space-y-2">
            {[
              { rotulo: 'Endereço (URL)', valor: url, qual: 'url' },
              { rotulo: 'Token de autenticação', valor: token, qual: 'token' },
            ].map((c) => (
              <div
                key={c.qual}
                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white p-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-amber-700/70">
                    {c.rotulo}
                  </div>
                  <div className="truncate font-mono text-[12px] text-gray-800">{c.valor}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copiar(c.valor, c.qual)}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-300 transition-colors hover:bg-amber-100"
                >
                  {copiado === c.qual ? (
                    <>
                      <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                      copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />
                      copiar
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
