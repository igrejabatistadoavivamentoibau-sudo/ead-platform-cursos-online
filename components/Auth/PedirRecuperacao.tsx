'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mail, AlertCircle, Loader2, ArrowRight, ArrowLeft, MailCheck, Users } from 'lucide-react'
import { clienteDeRecuperacao } from '@/lib/supabase/recuperacao'
import {
  conferirEmail,
  traduzirErroDoSupabase,
  RECADO_DE_ENVIO,
  CHAVE_DO_EMAIL_DIGITADO,
} from '@/lib/nucleo/recuperacaoDeSenha'
import { TELA_DE_NOVA_SENHA } from '@/lib/porteiroDoLink'

/* ============================================================
   PEDIR O LINK DE RECUPERAÇÃO

   O QUE ESTA TELA NUNCA FAZ: dizer se a conta existe.

   Dê certo ou não, o recado é o mesmo. Não é frescura de segurança — é
   que uma tela que responde "não encontramos este e-mail" transforma a
   plataforma numa lista de quem estuda aqui, consultável um endereço por
   vez, por qualquer pessoa de fora. Numa escola de igreja isso é
   informação sobre a vida das pessoas.

   O provedor já ajuda: o Supabase responde a mesma coisa para e-mail
   cadastrado e não cadastrado. O cuidado que falta é NOSSO — não deixar
   um erro técnico vazar a diferença. Por isso a única coisa que muda a
   resposta aqui é falha de conexão ou limite de envio, e nenhuma das duas
   tem a ver com a conta existir.
   ============================================================ */

const ESPERA_ENTRE_ENVIOS = 60 // segundos

export default function PedirRecuperacao() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [espera, setEspera] = useState(0)

  /* O e-mail que a pessoa já digitou no login, se ela veio de lá. Lido
     depois da montagem: no primeiro desenho o servidor não conhece a
     memória do navegador, e ler antes daria diferença entre o que o
     servidor mandou e o que a tela mostra. */
  useEffect(() => {
    try {
      const guardado = window.sessionStorage.getItem(CHAVE_DO_EMAIL_DIGITADO)
      if (guardado) setEmail(guardado)
    } catch {
      /* armazenamento bloqueado: a pessoa digita, e pronto */
    }
  }, [])

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    const conferido = conferirEmail(email)
    if (!conferido.ok) {
      setErro(conferido.erro)
      return
    }

    setEnviando(true)
    try {
      const supabase = clienteDeRecuperacao()

      /* O mecanismo oficial do Supabase, sem invenção nenhuma por cima.
         `redirectTo` pede para voltar direto na tela de nova senha; se o
         painel do provedor não conhecer este endereço, ele devolve para a
         página inicial e o porteiro do <head> conduz a pessoa até aqui do
         mesmo jeito (ver lib/porteiroDoLink.ts). */
      const { error } = await supabase.auth.resetPasswordForEmail(conferido.valor, {
        redirectTo: `${window.location.origin}${TELA_DE_NOVA_SENHA}`,
      })

      /* Repare que o erro NÃO é mostrado como "e-mail não encontrado":
         `traduzirErroDoSupabase` devolve o recado neutro nesse caso. */
      if (error) {
        setErro(traduzirErroDoSupabase(error.message, (error as { code?: string }).code))
        setEnviando(false)
        return
      }

      setEnviado(true)
      setEspera(ESPERA_ENTRE_ENVIOS)
      setEnviando(false)
    } catch (err) {
      setErro(traduzirErroDoSupabase(err instanceof Error ? err.message : ''))
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="w-full">
        <div
          className="flex items-start gap-3 rounded-xl bg-brand-50/80 px-4 py-4 ring-1 ring-brand-200 animate-float-in"
          role="status"
          data-teste="recado-de-envio"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-soft">
            <MailCheck className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 mb-1">Pronto, já enviamos.</p>
            <p className="text-sm text-gray-600 leading-snug">{RECADO_DE_ENVIO}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-gray-50 px-4 py-3.5 text-[13px] leading-snug text-gray-600 ring-1 ring-gray-200">
          <p className="font-semibold text-gray-700 mb-1">O link vale por pouco tempo.</p>
          <p>
            É de propósito: um link de troca de senha que ficasse valendo por dias seria uma chave
            solta na caixa de e-mail. Se ele vencer, é só pedir outro aqui.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEnviado(false)
            setErro(null)
          }}
          disabled={espera > 0}
          className="mt-5 w-full rounded-xl border border-gray-200 py-3 font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
        >
          {espera > 0 ? `Enviar de novo em ${espera}s` : 'Não chegou? Enviar de novo'}
        </button>

        <Link
          href="/auth/login"
          className="group mt-4 flex items-center justify-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors"
        >
          <ArrowLeft
            className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
            strokeWidth={2.25}
          />
          Voltar para a tela de entrar
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full">
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
            E-mail da sua conta
          </label>
          <div className="group relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400 transition-colors group-focus-within:text-brand-600">
              <Mail className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setErro(null)
              }}
              placeholder="seu@email.com"
              disabled={enviando}
              aria-invalid={erro ? true : undefined}
              className="w-full pl-11 pr-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-[15px] transition-all duration-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 disabled:opacity-50"
            />
          </div>
          <p className="mt-2 text-[13px] leading-snug text-gray-500">
            Use o mesmo e-mail com que você entra na plataforma.
          </p>
        </div>

        {erro && (
          <div
            role="alert"
            data-teste="erro"
            className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm leading-snug animate-float-in"
          >
            <AlertCircle className="h-[18px] w-[18px] shrink-0 mt-px" strokeWidth={2.25} />
            <span>{erro}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="group w-full flex items-center justify-center gap-2 bg-brand-700 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:bg-brand-800 hover:shadow-float active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100 shadow-card"
        >
          {enviando ? (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.25} />
              Enviando...
            </>
          ) : (
            <>
              Enviar link de recuperação
              <ArrowRight
                className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2.25}
              />
            </>
          )}
        </button>
      </form>

      <Link
        href="/auth/login"
        className="group mt-6 flex items-center justify-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors"
      >
        <ArrowLeft
          className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
          strokeWidth={2.25}
        />
        Lembrei a senha, voltar para entrar
      </Link>

      <div className="mt-7 flex items-start gap-3 bg-gradient-to-br from-brand-50/80 to-gray-50 rounded-xl p-4 ring-1 ring-brand-100">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-soft">
          <Users className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <p className="text-sm text-gray-600 leading-snug">
          <span className="font-semibold text-gray-800">Não lembra qual e-mail usou?</span>
          <br />
          Fale com a secretaria da escola — ela consegue conferir seu cadastro.
        </p>
      </div>
    </div>
  )
}
