'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  MessageSquare,
  Upload,
  X,
  Lock,
  Clock,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react'
import {
  autorizarEnvioDeEntrega,
  registrarEntrega,
  linksDosMeusAnexos,
} from '@/app/dashboard/aluno/actions'
import { createClient } from '@/lib/supabase/client'
import { enviarAoArmazenamento } from '@/lib/envioDireto'
import { lerJanela, momentoPorExtenso } from '@/lib/janelaDaAtividade'
import {
  TIPOS_ACEITOS,
  MAXIMO_DE_ANEXOS,
  TAMANHO_MAXIMO_ENTREGA,
  ACEITE_DO_CAMPO,
  tamanhoLegivel,
} from '@/lib/anexosDaEntrega'
import { BlocoDeAssinatura } from '@/components/Assinatura'
import type { EstiloDeAssinatura } from '@/lib/assinatura'
import { Botao, Alerta, Selo, CAMPO } from '@/components/ui'

export interface AnexoDaEntrega {
  id: string
  nome: string
  tipo: string
}

export interface AtividadeAluno {
  id: string
  titulo: string
  descricao: string | null
  /** O recado de COMO entregar — "faça à punho e fotografe". */
  aviso: string | null
  abre_em: string | null
  vence_em: string | null
  nota_maxima: number
  turma: string
  entrega: {
    id: string
    texto: string | null
    nota: number | null
    feedback: string | null
    entregue_em: string
    anexos: AnexoDaEntrega[]
    /** Quem corrigiu, quando. Null enquanto ninguém corrigiu. */
    assinatura: {
      assinanteId: string
      nome: string
      papel: string
      estilo: EstiloDeAssinatura | null
      em: string
    } | null
  } | null
}

export default function EntregaAtividade({ atividade }: { atividade: AtividadeAluno }) {
  const jaEntregue = !!atividade.entrega
  const corrigida = atividade.entrega?.nota !== null && atividade.entrega?.nota !== undefined

  /* A JANELA É CALCULADA NO NAVEGADOR, E PRECISA ESPERAR A HIDRATAÇÃO.
     Calculada durante o desenho no servidor, o relógio usado seria o do
     servidor (UTC na nuvem) e o texto sairia com horas de diferença — além
     de o React reclamar da divergência entre os dois lados. Começamos sem
     travar nada e corrigimos no primeiro instante do navegador; o relógio
     de meio em meio minuto faz o cartão fechar sozinho quando o prazo
     estoura com a página aberta. */
  const [agora, setAgora] = useState<number | null>(null)
  useEffect(() => {
    setAgora(Date.now())
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const janela = lerJanela(atividade.abre_em, atividade.vence_em, agora ?? undefined)
  // Travar por engano é pior que destravar por um instante, e o servidor
  // barra de todo jeito.
  const podeEntregar = agora === null ? true : janela.podeEntregar

  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState(atividade.entrega?.texto ?? '')
  const [novos, setNovos] = useState<File[]>([])
  const [trocarAnexos, setTrocarAnexos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [pct, setPct] = useState(0)
  const [links, setLinks] = useState<
    { id: string; nome: string; tipo: string; url: string | null }[] | null
  >(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const ocupado = isPending || enviando !== null
  const anexosAtuais = atividade.entrega?.anexos ?? []

  const escolher = (lista: FileList | null) => {
    if (!lista) return
    setError(null)
    const aceitos: File[] = []
    for (const f of Array.from(lista)) {
      if (!TIPOS_ACEITOS.includes(f.type)) {
        setError(`"${f.name}" não é PDF nem JPEG. Só esses dois formatos são aceitos.`)
        continue
      }
      if (f.size > TAMANHO_MAXIMO_ENTREGA) {
        setError(`"${f.name}" tem ${tamanhoLegivel(f.size)} e o limite é 20 MB por arquivo.`)
        continue
      }
      aceitos.push(f)
    }
    if (inputRef.current) inputRef.current.value = ''
    if (!aceitos.length) return
    if (novos.length + aceitos.length > MAXIMO_DE_ANEXOS) {
      setError(`São no máximo ${MAXIMO_DE_ANEXOS} arquivos por entrega.`)
    }
    setNovos((atuais) => [...atuais, ...aceitos].slice(0, MAXIMO_DE_ANEXOS))
    setTrocarAnexos(true)
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const semNada = !texto.trim() && !novos.length && (trocarAnexos || !anexosAtuais.length)
    if (semNada) {
      setError('Escreva uma resposta ou anexe pelo menos um arquivo.')
      return
    }

    try {
      let anexos: { path: string; nome: string; tipo: string; tamanho: number }[] = []

      if (novos.length) {
        /* 1. O servidor autoriza e diz onde cada arquivo deve ficar.
              Se o prazo já venceu, morre AQUI — antes de gastar a internet
              da pessoa mandando fotos que seriam recusadas no fim. */
        const permissoes = await autorizarEnvioDeEntrega(
          atividade.id,
          novos.map((f) => ({ nome: f.name, tipo: f.type, tamanho: f.size }))
        )

        // 2. O navegador manda direto para o armazenamento.
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) throw new Error('Sua sessão expirou. Entre de novo.')

        for (let i = 0; i < novos.length; i++) {
          setEnviando(`Enviando ${i + 1} de ${novos.length}: ${novos[i].name}`)
          setPct(0)
          await enviarAoArmazenamento({
            baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
            bucket: 'entregas',
            path: permissoes[i].path,
            token: session.access_token,
            arquivo: novos[i],
            aoProgredir: setPct,
          })
        }
        anexos = permissoes
      }

      setEnviando('Registrando a entrega...')

      // 3. Só agora a entrega é registrada.
      await registrarEntrega({
        atividadeId: atividade.id,
        texto,
        anexos,
        substituirAnexos: trocarAnexos,
      })

      setEnviando(null)
      setSalvo(true)
      setAberto(false)
      setNovos([])
      setTrocarAnexos(false)
      setLinks(null)
      setTimeout(() => setSalvo(false), 3500)
      startTransition(() => router.refresh())
    } catch (err) {
      setEnviando(null)
      setError(err instanceof Error ? err.message : 'Erro ao entregar.')
    }
  }

  const abrirMeusArquivos = async () => {
    if (!atividade.entrega) return
    try {
      setLinks(await linksDosMeusAnexos(atividade.entrega.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui abrir os arquivos.')
    }
  }

  const listaExibida = links ?? anexosAtuais.map((a) => ({ ...a, url: null as string | null }))

  return (
    <div className="rounded-xl bg-white ring-1 ring-brand-950/[0.07]">
      <div className="p-4">
        <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-display text-[15px] font-bold text-gray-900">{atividade.titulo}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {corrigida ? (
              <Selo tom="verde" icone="Check">
                Nota {Number(atividade.entrega!.nota)} / {Number(atividade.nota_maxima)}
              </Selo>
            ) : jaEntregue ? (
              <Selo tom="azul">Entregue — aguardando correção</Selo>
            ) : janela.estado === 'encerrada' ? (
              <Selo tom="vermelho">Prazo encerrado</Selo>
            ) : janela.estado === 'ainda_nao_abriu' ? (
              <Selo tom="neutro">Ainda não abriu</Selo>
            ) : (
              <Selo tom="ambar">A entregar</Selo>
            )}
          </div>
        </div>

        <p className="mb-2 text-[12px] text-gray-500">
          {atividade.turma}
          {` · vale até ${Number(atividade.nota_maxima)}`}
        </p>

        {/* A JANELA, EM UMA LINHA — o aluno tem que saber até quando sem
            precisar procurar. Quando falta menos de um dia o aviso muda de
            cor: é o instante em que a informação vira urgência. */}
        <div
          className={`mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium ${
            janela.estado === 'encerrada'
              ? 'bg-red-50 text-red-800 ring-1 ring-red-200'
              : janela.estado === 'ainda_nao_abriu'
                ? 'bg-gray-50 text-gray-600 ring-1 ring-gray-200'
                : janela.correndo
                  ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                  : 'bg-brand-50/70 text-brand-800 ring-1 ring-brand-200'
          }`}
        >
          {janela.estado === 'encerrada' ? (
            <Lock className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
          ) : (
            <Clock className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
          )}
          <span>{janela.recado}</span>
        </div>

        {/* O AVISO DO PROFESSOR.
            Separado do enunciado e ANTES do formulário, de propósito: é a
            instrução de COMO entregar ("faça à punho e fotografe as
            páginas"), e não adianta aparecer depois que a pessoa já digitou
            a resposta no computador. */}
        {atividade.aviso && (
          <div className="mb-3 flex items-start gap-2.5 rounded-lg bg-accent-50 p-3 ring-1 ring-accent-300/60">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-700" strokeWidth={2.2} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-accent-800">
                Como entregar
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800">
                {atividade.aviso}
              </p>
            </div>
          </div>
        )}

        {atividade.descricao && (
          <p className="mb-3 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-600">
            {atividade.descricao}
          </p>
        )}

        {/* Entrega já feita */}
        {jaEntregue && !aberto && (
          <div className="rounded-lg bg-gray-50 p-3.5">
            {atividade.entrega?.texto && (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
                {atividade.entrega.texto}
              </p>
            )}
            {anexosAtuais.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {listaExibida.map((a) => (
                  <div key={a.id} className="flex items-center gap-1.5 text-[12.5px]">
                    {a.tipo === 'application/pdf' ? (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-brand-700" strokeWidth={2} />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-brand-700" strokeWidth={2} />
                    )}
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
                      >
                        {a.nome}
                        <ExternalLink className="h-3 w-3" strokeWidth={2} />
                      </a>
                    ) : (
                      <span className="font-medium text-gray-700">{a.nome}</span>
                    )}
                  </div>
                ))}
                {!links && (
                  <button
                    type="button"
                    onClick={abrirMeusArquivos}
                    className="text-[12px] font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
                  >
                    Conferir o que eu enviei
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* A ASSINATURA DA CORREÇÃO.
            Vem depois do comentário e antes de tudo o mais, porque é o
            fecho: quem corrigiu, quando, e quanto. Antes disto o aluno via
            um número aparecer na tela sem dono e sem data — e não tinha a
            quem perguntar. */}
        {atividade.entrega?.assinatura && (
          <BlocoDeAssinatura
            dados={{
              entregaId: atividade.entrega.id,
              assinanteId: atividade.entrega.assinatura.assinanteId,
              nome: atividade.entrega.assinatura.nome,
              papel: atividade.entrega.assinatura.papel,
              estilo: atividade.entrega.assinatura.estilo,
              em: atividade.entrega.assinatura.em,
              nota: atividade.entrega.nota,
              notaMaxima: atividade.nota_maxima,
            }}
          />
        )}

        {atividade.entrega?.feedback && (
          <div className="mt-3 rounded-lg bg-brand-50/70 p-3.5 ring-1 ring-brand-200">
            <p className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-brand-800">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.2} />
              Comentário do professor
            </p>
            <p className="text-[13px] leading-relaxed text-brand-900/90">
              {atividade.entrega.feedback}
            </p>
          </div>
        )}

        {salvo && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Entrega enviada
          </p>
        )}

        {/* Formulário de entrega */}
        {aberto && podeEntregar ? (
          <form onSubmit={enviar} className="mt-3 space-y-2.5">
            <textarea
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva sua resposta aqui (se o professor pediu por escrito)"
              className={`${CAMPO} resize-y leading-relaxed`}
            />

            {anexosAtuais.length > 0 && !trocarAnexos && (
              <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-[12.5px]">
                <p className="font-medium text-gray-700">
                  {anexosAtuais.length === 1
                    ? '1 arquivo já enviado'
                    : `${anexosAtuais.length} arquivos já enviados`}
                </p>
                <p className="mt-0.5 text-[12px] text-gray-500">
                  Continuam valendo. Só saem se você anexar outros aqui embaixo.
                </p>
              </div>
            )}
            {trocarAnexos && anexosAtuais.length > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ring-1 ring-amber-200">
                Os {anexosAtuais.length} arquivos anteriores serão substituídos pelos novos.
              </p>
            )}

            {novos.length > 0 && (
              <ul className="space-y-1.5">
                {novos.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded-lg bg-brand-50/60 px-3 py-2 ring-1 ring-brand-200/70"
                  >
                    {f.type === 'application/pdf' ? (
                      <FileText className="h-4 w-4 shrink-0 text-brand-700" strokeWidth={2} />
                    ) : (
                      <ImageIcon className="h-4 w-4 shrink-0 text-brand-700" strokeWidth={2} />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-gray-800">
                      {f.name}
                    </span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-gray-500">
                      {tamanhoLegivel(f.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setNovos((a) => a.filter((_, j) => j !== i))}
                      className="shrink-0 text-gray-400 transition-colors hover:text-red-600"
                      aria-label={`Tirar ${f.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border-2 border-dashed border-gray-200 px-3.5 py-2.5 transition-colors hover:border-brand-400 hover:bg-brand-50/40">
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACEITE_DO_CAMPO}
                onChange={(e) => escolher(e.target.files)}
                className="sr-only"
              />
              <Upload className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
              <span className="min-w-0 text-[12.5px] text-gray-600">
                Anexar PDF ou foto JPEG — pode escolher várias de uma vez
                <span className="block text-[11.5px] text-gray-400">
                  até {MAXIMO_DE_ANEXOS} arquivos, 20 MB cada
                </span>
              </span>
            </label>

            {enviando && (
              <div className="rounded-lg bg-brand-50 px-3 py-2.5 ring-1 ring-brand-200">
                <p className="text-[12.5px] font-medium text-brand-800">{enviando}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-200/60">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-[width] duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            {error && <Alerta>{error}</Alerta>}

            <div className="flex gap-2">
              <Botao type="submit" icone="Send" disabled={ocupado}>
                {ocupado ? 'Enviando...' : jaEntregue ? 'Reenviar' : 'Entregar'}
              </Botao>
              <Botao
                type="button"
                variante="fantasma"
                disabled={ocupado}
                onClick={() => {
                  setAberto(false)
                  setNovos([])
                  setTrocarAnexos(false)
                  setError(null)
                }}
              >
                Cancelar
              </Botao>
            </div>
          </form>
        ) : (
          <div className="mt-3">
            {podeEntregar ? (
              <Botao
                variante={jaEntregue ? 'secundario' : 'primario'}
                icone={jaEntregue ? 'PenLine' : 'Upload'}
                onClick={() => setAberto(true)}
              >
                {jaEntregue ? 'Editar entrega' : 'Fazer entrega'}
              </Botao>
            ) : (
              /* PORTA FECHADA, E DITA COM TODAS AS LETRAS.
                 Sumir com o botão faria a pessoa achar que a plataforma
                 está com defeito e procurar o professor por causa disso.
                 Dizer o motivo resolve a dúvida sem ninguém no meio. */
              <div className="flex items-start gap-2.5 rounded-lg bg-gray-50 px-3.5 py-3 ring-1 ring-gray-200">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" strokeWidth={2.2} />
                <div className="text-[12.5px] leading-relaxed text-gray-600">
                  <p className="font-semibold text-gray-800">
                    {janela.estado === 'encerrada'
                      ? 'O prazo desta atividade encerrou.'
                      : 'Esta atividade ainda não abriu.'}
                  </p>
                  <p className="mt-0.5">
                    {janela.estado === 'encerrada'
                      ? jaEntregue
                        ? 'Sua entrega foi registrada e continua valendo. Não dá mais para trocar os arquivos.'
                        : 'Não é mais possível anexar. Procure o professor da turma.'
                      : atividade.abre_em
                        ? `A entrega libera em ${momentoPorExtenso(atividade.abre_em)}.`
                        : janela.recado}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
