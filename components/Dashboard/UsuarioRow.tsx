'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  KeyRound,
  Check,
  X,
  GraduationCap,
  Copy,
  UserMinus,
  UserCheck,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import {
  trocarSenha,
  atualizarPapel,
  definirAtivoDoUsuario,
  resumoDoUsuario,
  excluirUsuario,
  type ResumoDoUsuario,
} from '@/app/dashboard/admin/actions'
import { Selecao } from '@/components/ui'

/* O que contamos para a pessoa antes de ela confirmar a exclusão, e como
   cada coisa se chama no singular e no plural. A ordem é proposital: do
   que dói mais perder para o que dói menos. */
const O_QUE_SE_PERDE: { chave: keyof ResumoDoUsuario; um: string; varios: string }[] = [
  { chave: 'certificados', um: 'certificado emitido', varios: 'certificados emitidos' },
  { chave: 'notas', um: 'nota lançada', varios: 'notas lançadas' },
  { chave: 'presencas', um: 'presença registrada', varios: 'presenças registradas' },
  { chave: 'entregas', um: 'trabalho entregue', varios: 'trabalhos entregues' },
  { chave: 'matriculas', um: 'matrícula em turma', varios: 'matrículas em turmas' },
  { chave: 'aulas_assistidas', um: 'aula concluída', varios: 'aulas concluídas' },
  { chave: 'mensagens', um: 'mensagem no chat', varios: 'mensagens no chat' },
  { chave: 'anotacoes_biblia', um: 'marcação na Bíblia', varios: 'marcações na Bíblia' },
  { chave: 'paginas_caderno', um: 'página de caderno', varios: 'páginas de caderno' },
]

const ROLE_LABEL: Record<string, string> = {
  aluno: 'Aluno',
  professor: 'Professor',
  admin: 'Administrador',
}

const ROLE_STYLE: Record<string, string> = {
  aluno: 'bg-blue-50 text-blue-700 ring-blue-200',
  professor: 'bg-purple-50 text-purple-700 ring-purple-200',
  admin: 'bg-brand-50 text-brand-700 ring-brand-200',
}

function gerarSenha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let senha = ''
  for (let i = 0; i < 10; i++) senha += chars[Math.floor(Math.random() * chars.length)]
  return senha
}

export default function UsuarioRow({
  id,
  name,
  email,
  role,
  turmas = [],
  ativo = true,
  souEu = false,
}: {
  id: string
  name: string
  email: string
  role: 'aluno' | 'professor' | 'admin'
  turmas?: string[]
  ativo?: boolean
  /** A própria conta de quem está olhando: não dá para se desativar nem se apagar. */
  souEu?: boolean
}) {
  const [trocando, setTrocando] = useState(false)
  const [novaSenha, setNovaSenha] = useState(gerarSenha)
  const [resultado, setResultado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [excluindo, setExcluindo] = useState(false)
  const [resumo, setResumo] = useState<ResumoDoUsuario | null>(null)
  const [confirmacao, setConfirmacao] = useState('')
  const router = useRouter()

  const handleTrocarSenha = () => {
    setError(null)
    startTransition(async () => {
      try {
        await trocarSenha(id, novaSenha)
        setResultado(novaSenha)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao trocar senha.')
      }
    })
  }

  const handleMudarPapel = (novoPapel: string) => {
    setError(null)
    startTransition(async () => {
      try {
        await atualizarPapel(id, novoPapel as 'aluno' | 'professor' | 'admin')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar papel.')
      }
    })
  }

  /* As ações devolvem o motivo em vez de lançar: quando lançam, a versão
     publicada do Next apaga a mensagem e a pessoa recebe um parágrafo em
     inglês no lugar da frase em português. Ver o comentário em actions.ts. */
  const handleAtivo = (novo: boolean) => {
    setError(null)
    startTransition(async () => {
      const r = await definirAtivoDoUsuario(id, novo)
      if (!r.ok) return setError(r.erro)
      router.refresh()
    })
  }

  /* Abrir a caixa de exclusão JÁ vai buscar o que será perdido. É a
     informação que transforma "apagar o usuário" em "apagar 3 notas, 12
     presenças e 1 certificado" — e essa é a diferença entre uma escolha e
     um acidente. */
  const abrirExclusao = () => {
    setError(null)
    setConfirmacao('')
    setExcluindo(true)
    setResumo(null)
    startTransition(async () => {
      const r = await resumoDoUsuario(id)
      if (!r.ok) return setError(r.erro)
      setResumo(r.resumo)
    })
  }

  const handleExcluir = () => {
    setError(null)
    startTransition(async () => {
      const r = await excluirUsuario(id, confirmacao)
      if (!r.ok) return setError(r.erro)
      setExcluindo(false)
      router.refresh()
    })
  }

  const perdas = resumo
    ? O_QUE_SE_PERDE.filter((x) => (resumo[x.chave] ?? 0) > 0).map(
        (x) => `${resumo[x.chave]} ${resumo[x.chave] === 1 ? x.um : x.varios}`
      )
    : []

  const turmasOrfas = resumo?.turmas_como_professor ?? 0

  return (
    <li className={`py-3.5 ${ativo ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-gray-800">{name}</p>
            {!ativo && (
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-200 px-1.5 py-0.5 text-[11px] font-bold text-gray-600">
                <UserMinus className="h-3 w-3" strokeWidth={2.25} />
                Sem acesso
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{email}</p>

          {/* Onde a pessoa está. Antes o painel dizia só nome e papel, e
              descobrir isso exigia abrir turma por turma. */}
          {turmas.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {turmas.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-brand-200"
                >
                  <GraduationCap className="h-3 w-3" strokeWidth={2} />
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-amber-700">Sem turma ainda</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="w-[150px]">
            <Selecao
              valorInicial={role}
              aoMudar={handleMudarPapel}
              disabled={isPending}
              opcoes={Object.entries(ROLE_LABEL).map(([valor, rotulo]) => ({ valor, rotulo }))}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setTrocando((v) => !v)
              setResultado(null)
              setError(null)
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-brand-700 px-2.5 py-1.5 rounded-full hover:bg-brand-50"
          >
            <KeyRound className="h-3.5 w-3.5" strokeWidth={2.25} />
            Trocar senha
          </button>

          {/* DESATIVAR é o caminho do dia a dia, e por isso vem primeiro e
              com aparência de ação comum. EXCLUIR fica ao lado, discreto e
              vermelho: existe, mas não convida. */}
          {!souEu && (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleAtivo(!ativo)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                  ativo
                    ? 'text-gray-500 hover:bg-amber-50 hover:text-amber-700'
                    : 'text-brand-700 hover:bg-brand-50'
                }`}
              >
                {ativo ? (
                  <>
                    <UserMinus className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Desativar
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Reativar
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => (excluindo ? setExcluindo(false) : abrirExclusao())}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                Excluir
              </button>
            </>
          )}
        </div>
      </div>

      {excluindo && (
        <div className="mt-3 rounded-xl bg-red-50/70 p-4 ring-1 ring-red-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-red-900">
                Excluir {name} de vez, sem possibilidade de desfazer.
              </p>

              {!resumo ? (
                <p className="mt-1 text-[12.5px] text-red-800">Conferindo o que será perdido…</p>
              ) : perdas.length > 0 ? (
                <>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-red-800">
                    Junto com o cadastro, some também:
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {perdas.map((p) => (
                      <li key={p} className="text-[12.5px] font-semibold text-red-900">
                        • {p}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12px] leading-relaxed text-red-700">
                    Se a ideia é só tirar o acesso, use <strong>Desativar</strong>: a pessoa sai da
                    plataforma e tudo isso continua guardado.
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-red-800">
                  Esta pessoa ainda não deixou histórico nenhum na plataforma — nenhuma nota,
                  presença ou trabalho.
                </p>
              )}

              {turmasOrfas > 0 && (
                <p className="mt-2 rounded-lg bg-amber-100 px-2.5 py-1.5 text-[12px] font-semibold text-amber-900">
                  Atenção: {turmasOrfas === 1 ? 'uma turma fica' : `${turmasOrfas} turmas ficam`} sem
                  professor responsável. As turmas continuam existindo, mas você precisa indicar
                  outro professor.
                </p>
              )}

              {resumo && (
                <div className="mt-3">
                  <label className="block text-[12px] font-semibold text-red-900">
                    Para confirmar, digite o nome da pessoa: <span className="font-bold">{name}</span>
                  </label>
                  <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={confirmacao}
                      onChange={(e) => setConfirmacao(e.target.value)}
                      placeholder={name}
                      className="flex-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                    />
                    <button
                      type="button"
                      onClick={handleExcluir}
                      disabled={isPending || !confirmacao.trim()}
                      className="whitespace-nowrap rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-40"
                    >
                      {isPending ? 'Excluindo...' : 'Excluir de vez'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcluindo(false)}
                      className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
            </div>
          </div>
        </div>
      )}

      {error && !excluindo && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {trocando && (
        <div className="mt-3 bg-gray-50 rounded-xl p-3.5">
          {resultado ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />
                <span className="text-gray-700">Nova senha de {name.split(' ')[0]}:</span>
                <span className="rounded-md bg-white px-2 py-1 font-mono text-[13px] font-bold text-gray-900 ring-1 ring-gray-200">
                  {resultado}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(resultado)
                    setCopiado(true)
                    setTimeout(() => setCopiado(false), 2000)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-gray-600 transition-colors hover:bg-white hover:text-brand-700"
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                  {copiado ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              {/* Aviso necessário: depois que esta caixa fecha, a senha some
                  para sempre. O banco guarda só um resumo irreversível dela —
                  por isso o painel oferece redefinir, e nunca "ver a senha". */}
              <p className="text-[11.5px] leading-relaxed text-amber-700">
                Copie agora: esta senha não aparece de novo. Ninguém consegue consultá-la depois —
                se perder, é só redefinir outra aqui.
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setNovaSenha(gerarSenha())}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 ring-1 ring-gray-200 whitespace-nowrap"
              >
                Gerar nova
              </button>
              <button
                type="button"
                onClick={handleTrocarSenha}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50 whitespace-nowrap"
              >
                {isPending ? 'Salvando...' : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={() => setTrocando(false)}
                className="px-2 py-2 rounded-lg text-gray-400 hover:text-gray-600"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      )}
    </li>
  )
}
