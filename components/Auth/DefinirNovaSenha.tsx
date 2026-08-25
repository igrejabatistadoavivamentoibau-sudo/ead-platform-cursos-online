'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  KeyRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  conferirNovaSenha,
  forcaDaSenha,
  lerLinkDeRecuperacao,
  traduzirErroDoSupabase,
  DESTINO_DEPOIS_DE_TROCAR,
  MOTIVO_INVALIDO,
  MOTIVO_SEM_LINK,
  TAMANHO_MINIMO_DA_SENHA,
} from '@/lib/nucleo/recuperacaoDeSenha'
import { CHAVE_DO_LINK } from '@/lib/porteiroDoLink'

/* ============================================================
   DEFINIR A NOVA SENHA

   A pessoa chega aqui vinda do e-mail. O porteiro do <head> já tirou a
   chave de entrada da barra de endereço e guardou na memória da aba
   (ver lib/porteiroDoLink.ts) — aqui ela é pega, usada uma vez e apagada.

   TRÊS FINAIS POSSÍVEIS, e os três precisam existir:
   1. o link vale  → o formulário aparece;
   2. o link venceu ou foi adulterado → a tela explica e oferece pedir
      outro, no mesmo lugar. Mandar a pessoa "voltar e tentar de novo"
      sem um botão é onde a maioria desiste;
   3. não veio link nenhum (alguém digitou o endereço na mão) → a mesma
      saída do caso 2.

   O QUE ELA NÃO FAZ: deixar trocar a senha de uma sessão comum. Quem já
   está dentro da plataforma troca a senha pelo painel; esta porta é só
   para quem chegou pelo link do e-mail. Aceitar sessão qualquer aqui
   transformaria um computador emprestado e destravado numa troca de senha
   a dois cliques.
   ============================================================ */

type Estado =
  | { fase: 'conferindo' }
  | { fase: 'pronto'; email: string | null }
  | { fase: 'recusado'; motivo: string }
  | { fase: 'trocada' }

export default function DefinirNovaSenha() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>({ fase: 'conferindo' })
  const [senha, setSenha] = useState('')
  const [repetida, setRepetida] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const jaConferiu = useRef(false)

  /* ---------- 1. Ler o link e abrir (ou não) a porta ---------- */
  const conferirOLink = useCallback(async () => {
    const supabase = createClient()

    /* A chave só serve uma vez. Apagar ANTES de usar é de propósito: se a
       troca falhar no meio, a pessoa pede um link novo — o que não pode
       acontecer é a chave ficar guardada na aba esperando o próximo que
       sentar naquele computador. */
    let guardado: string | null = null
    try {
      guardado = window.sessionStorage.getItem(CHAVE_DO_LINK)
      if (guardado) window.sessionStorage.removeItem(CHAVE_DO_LINK)
    } catch {
      /* armazenamento bloqueado — caímos no endereço, logo abaixo */
    }

    const hash = guardado || window.location.hash || ''
    const busca = window.location.search || ''
    const link = lerLinkDeRecuperacao(hash, busca)

    /* Se a chave veio pelo endereço (armazenamento bloqueado), ela some da
       barra agora. Não deixa rastro em histórico nem em print. */
    if (!guardado && (window.location.hash || window.location.search)) {
      try {
        window.history.replaceState(window.history.state, '', window.location.pathname)
      } catch {
        /* sem problema: o pior caso é o endereço continuar visível */
      }
    }

    if (link.tipo === 'recusado') {
      setEstado({ fase: 'recusado', motivo: link.motivo })
      return
    }

    if (link.tipo === 'nada') {
      setEstado({ fase: 'recusado', motivo: MOTIVO_SEM_LINK })
      return
    }

    try {
      if (link.tipo === 'entrada') {
        const { data, error } = await supabase.auth.setSession({
          access_token: link.accessToken,
          refresh_token: link.refreshToken,
        })
        if (error || !data.session) {
          setEstado({
            fase: 'recusado',
            motivo: traduzirErroDoSupabase(
              error?.message ?? '',
              (error as { code?: string })?.code,
              MOTIVO_INVALIDO
            ),
          })
          return
        }
        setEstado({ fase: 'pronto', email: data.user?.email ?? null })
        return
      }

      /* Caminho de reserva: link do formato antigo, com código em vez de
         chave. Só conclui no MESMO navegador em que foi pedido — é
         justamente a limitação que fez a recuperação usar o outro formato
         (ver lib/supabase/recuperacao.ts). Fica aqui para não quebrar um
         link que já esteja na caixa de e-mail de alguém. */
      const { data, error } = await supabase.auth.exchangeCodeForSession(link.code)
      if (error || !data.session) {
        setEstado({
          fase: 'recusado',
          motivo: traduzirErroDoSupabase(
            error?.message ?? '',
            (error as { code?: string })?.code,
            MOTIVO_INVALIDO
          ),
        })
        return
      }
      setEstado({ fase: 'pronto', email: data.user?.email ?? null })
    } catch (e) {
      /* Link cortado pelo programa de e-mail, endereço colado pela metade,
         chave que nem parece uma chave: tudo isso cai aqui, e para quem
         está lendo é a mesma coisa — este link não serve, peça outro. */
      setEstado({
        fase: 'recusado',
        motivo: traduzirErroDoSupabase(e instanceof Error ? e.message : '', undefined, MOTIVO_INVALIDO),
      })
    }
  }, [])

  useEffect(() => {
    /* O React monta duas vezes em desenvolvimento. Sem esta trava, a
       segunda montagem procuraria a chave que a primeira já apagou e a
       tela diria "link inválido" num link perfeitamente bom. */
    if (jaConferiu.current) return
    jaConferiu.current = true
    conferirOLink()
  }, [conferirOLink])

  /* ---------- 2. Gravar a senha nova ---------- */
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    const email = estado.fase === 'pronto' ? estado.email ?? undefined : undefined
    const conferida = conferirNovaSenha(senha, repetida, email)
    if (!conferida.ok) {
      setErro(conferida.erro)
      return
    }

    setSalvando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: conferida.valor })

      if (error) {
        setErro(traduzirErroDoSupabase(error.message, (error as { code?: string }).code))
        setSalvando(false)
        return
      }

      setEstado({ fase: 'trocada' })

      /* SAIR DE TODOS OS APARELHOS, e não só deste.
         Quem troca a senha depois de esquecê-la muitas vezes está
         justamente desconfiando de que alguém entrou. Deixar as outras
         sessões abertas manteria essa pessoa dentro, com a senha velha já
         inútil e o acesso ainda de pé. Sair de tudo é o que faz a troca de
         senha significar alguma coisa.

         E vale para esta aba também: a próxima entrada é com a senha nova,
         pela porta da frente. */
      await supabase.auth.signOut({ scope: 'global' }).catch(() => {})

      setTimeout(() => {
        router.push(DESTINO_DEPOIS_DE_TROCAR)
        router.refresh()
      }, 1400)
    } catch (err) {
      setErro(traduzirErroDoSupabase(err instanceof Error ? err.message : ''))
      setSalvando(false)
    }
  }

  /* ---------- Conferindo ---------- */
  if (estado.fase === 'conferindo') {
    return (
      <div
        className="flex flex-col items-center gap-3 py-10 text-gray-500"
        role="status"
        data-teste="conferindo"
      >
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" strokeWidth={2} />
        <p>Conferindo seu link...</p>
      </div>
    )
  }

  /* ---------- Link recusado ---------- */
  if (estado.fase === 'recusado') {
    return (
      <div className="w-full">
        <div
          role="alert"
          data-teste="link-recusado"
          className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-4 ring-1 ring-amber-200 animate-float-in"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-amber-600 shadow-soft">
            <AlertCircle className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-amber-900 mb-1">Este link não abre a troca de senha.</p>
            <p className="text-sm text-amber-900/80 leading-snug">{estado.motivo}</p>
          </div>
        </div>

        <Link
          href="/auth/esqueci-senha"
          data-teste="pedir-outro"
          className="group mt-6 w-full flex items-center justify-center gap-2 bg-brand-700 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:bg-brand-800 hover:shadow-float active:scale-[0.99] shadow-card"
        >
          Pedir um link novo
          <ArrowRight
            className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2.25}
          />
        </Link>

        <Link
          href="/auth/login"
          className="mt-4 flex items-center justify-center text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors"
        >
          Voltar para a tela de entrar
        </Link>
      </div>
    )
  }

  /* ---------- Trocada ---------- */
  if (estado.fase === 'trocada') {
    return (
      <div
        className="flex flex-col items-center gap-3 py-10 text-center"
        role="status"
        data-teste="senha-trocada"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-200">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
        </span>
        <p className="text-lg font-bold text-gray-900">Senha alterada.</p>
        <p className="text-sm text-gray-500 max-w-xs leading-snug">
          Levando você para a tela de entrar. Use a senha nova para acessar.
        </p>
      </div>
    )
  }

  /* ---------- O formulário ---------- */
  const forca = forcaDaSenha(senha)
  const coresDaForca = ['bg-gray-200', 'bg-red-400', 'bg-amber-400', 'bg-brand-500']

  return (
    <div className="w-full">
      {estado.email && (
        <div
          className="mb-6 flex items-start gap-2.5 rounded-xl bg-gray-50 px-3.5 py-3 text-[13px] leading-snug text-gray-600 ring-1 ring-gray-200"
          data-teste="conta"
        >
          <KeyRound className="mt-px h-4 w-4 shrink-0 text-gray-400" strokeWidth={2.25} />
          <span>
            Criando uma senha nova para{' '}
            <strong className="font-semibold text-gray-800 break-all">{estado.email}</strong>.
          </span>
        </div>
      )}

      <form onSubmit={salvar} className="space-y-4" noValidate>
        <div>
          <label htmlFor="senha" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Nova senha
          </label>
          <div className="group relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400 transition-colors group-focus-within:text-brand-600">
              <Lock className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <input
              id="senha"
              type={mostrar ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value)
                setErro(null)
              }}
              placeholder={`Pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres`}
              disabled={salvando}
              aria-invalid={erro ? true : undefined}
              className="w-full pl-11 pr-11 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-[15px] transition-all duration-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-brand-600 transition-colors"
              aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {mostrar ? (
                <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} />
              ) : (
                <Eye className="h-[18px] w-[18px]" strokeWidth={2} />
              )}
            </button>
          </div>

          {/* A barrinha é só um retorno visual — quem recusa é a regra. */}
          {senha.length > 0 && (
            <div className="mt-2 flex items-center gap-2" data-teste="forca">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      forca.nivel >= n ? coresDaForca[forca.nivel] : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[12px] font-medium text-gray-500 whitespace-nowrap">
                {forca.rotulo}
              </span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="repetida" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Repita a nova senha
          </label>
          <div className="group relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400 transition-colors group-focus-within:text-brand-600">
              <Lock className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <input
              id="repetida"
              type={mostrar ? 'text' : 'password'}
              autoComplete="new-password"
              value={repetida}
              onChange={(e) => {
                setRepetida(e.target.value)
                setErro(null)
              }}
              placeholder="A mesma senha de novo"
              disabled={salvando}
              className="w-full pl-11 pr-4 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-[15px] transition-all duration-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 disabled:opacity-50"
            />
          </div>
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
          disabled={salvando}
          data-teste="salvar"
          className="group w-full flex items-center justify-center gap-2 bg-brand-700 text-white py-3 rounded-xl font-semibold transition-all duration-300 hover:bg-brand-800 hover:shadow-float active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100 shadow-card"
        >
          {salvando ? (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.25} />
              Salvando...
            </>
          ) : (
            <>
              Salvar nova senha
              <ArrowRight
                className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2.25}
              />
            </>
          )}
        </button>
      </form>

      <div className="mt-7 flex items-start gap-3 bg-gradient-to-br from-brand-50/80 to-gray-50 rounded-xl p-4 ring-1 ring-brand-100">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-soft">
          <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <p className="text-sm text-gray-600 leading-snug">
          <span className="font-semibold text-gray-800">Ao salvar, você sai de todos os aparelhos.</span>
          <br />
          Se alguém tinha entrado na sua conta, perde o acesso na hora.
        </p>
      </div>
    </div>
  )
}
