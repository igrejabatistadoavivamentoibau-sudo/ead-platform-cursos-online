'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clapperboard, Check, Trash2, X } from 'lucide-react'
import { definirBoasVindasDoModulo } from '@/app/dashboard/admin/actions'
import { analisarVideo, ORIGEM_VIDEO } from '@/lib/video'
import { Alerta } from '@/components/ui'

/* ============================================================
   O VÍDEO DE BOAS-VINDAS DO MÓDULO

   Pedido dela: "Módulo é só um nome, as disciplinas que têm as aulas, no
   módulo deixe disponível a possibilidade de incluir um vídeo de boas
   vindas."

   POR QUE ISTO EXISTE

   Depois que as aulas passaram a morar dentro das disciplinas, o módulo
   ficou sendo uma pasta: um nome, e nada dentro dele que seja dele. Mas o
   módulo é a etapa da escola — é onde a turma entra. Faltava o momento em
   que alguém diz "bem-vindo ao Módulo 1, é isto que vamos fazer aqui".

   DUAS DECISÕES

   1. O LINK É CONFERIDO ENQUANTO SE DIGITA. A tela diz "YouTube",
      "Google Drive", "OneDrive" assim que reconhece — e diz que não
      reconheceu antes de deixar salvar. Descobrir que o link estava
      errado só quando o aluno reclama é o pior jeito de descobrir.

   2. TIRAR O VÍDEO É UM BOTÃO, não um campo em branco. Um campo vazio ao
      lado de "Salvar" apaga vídeo sem querer; um botão "Tirar o vídeo"
      só apaga quando é isso que a pessoa quer.
   ============================================================ */

export default function BoasVindasDoModulo({
  cursoId,
  moduloId,
  moduloNome,
  videoAtual,
}: {
  cursoId: string
  moduloId: string
  moduloNome: string
  videoAtual: string | null
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [link, setLink] = useState(videoAtual ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [salvando, iniciar] = useTransition()

  const info = analisarVideo(link)
  const reconhecido = link.trim().length > 0 && info.tipo !== 'desconhecido'

  const salvar = (valor: string) => {
    setErro(null)
    setSalvo(false)
    iniciar(async () => {
      const r = await definirBoasVindasDoModulo(moduloId, cursoId, { video: valor })
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setLink(valor)
      setSalvo(true)
      if (!valor) setAberto(false)
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        data-teste="abrir-boas-vindas"
        className={`flex w-full items-center gap-2.5 rounded-xl border border-dashed px-3.5 py-2.5 text-left text-[12.5px] font-medium transition-colors ${
          videoAtual
            ? 'border-brand-300 bg-brand-50/40 text-brand-800 hover:bg-brand-50'
            : 'border-gray-300 text-gray-500 hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700'
        }`}
      >
        <Clapperboard className="h-4 w-4 shrink-0" strokeWidth={2} />
        {videoAtual ? (
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Vídeo de boas-vindas anexado</span>
            <span className="block truncate text-[11.5px] font-normal opacity-80">
              {ORIGEM_VIDEO[analisarVideo(videoAtual).tipo]} · {videoAtual}
            </span>
          </span>
        ) : (
          <span>Anexar um vídeo de boas-vindas em {moduloNome}</span>
        )}
      </button>
    )
  }

  return (
    <div className="rounded-xl bg-white p-3.5 ring-1 ring-brand-200" data-teste="boas-vindas">
      <div className="mb-2 flex items-center gap-2">
        <Clapperboard className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
        <h4 className="flex-1 text-[13px] font-bold text-gray-900">
          Vídeo de boas-vindas de {moduloNome}
        </h4>
        <button
          type="button"
          onClick={() => {
            setAberto(false)
            setLink(videoAtual ?? '')
            setErro(null)
            setSalvo(false)
          }}
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mb-2 text-[11.5px] leading-snug text-gray-500">
        Aparece para o aluno logo ao abrir o módulo, antes das disciplinas. Cole o link do
        YouTube, Vimeo, Google Drive ou OneDrive.
      </p>

      {erro && (
        <div className="mb-2">
          <Alerta>{erro}</Alerta>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={link}
          onChange={(e) => {
            setLink(e.target.value)
            setSalvo(false)
            setErro(null)
          }}
          placeholder="https://youtu.be/..."
          data-teste="link-de-boas-vindas"
          className="campo h-9 min-w-0 flex-1 !py-1.5 text-[13px]"
        />
        <button
          type="button"
          disabled={salvando || !reconhecido}
          onClick={() => salvar(link.trim())}
          data-teste="salvar-boas-vindas"
          className="h-9 shrink-0 rounded-lg bg-brand-700 px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
        {videoAtual && (
          <button
            type="button"
            disabled={salvando}
            onClick={() => salvar('')}
            data-teste="tirar-boas-vindas"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Tirar o vídeo
          </button>
        )}
      </div>

      {/* O que a plataforma entendeu do link, ANTES de salvar. */}
      <p className="mt-2 text-[11.5px]" data-teste="origem-do-video">
        {link.trim().length === 0 ? (
          <span className="text-gray-400">Cole o link acima.</span>
        ) : reconhecido ? (
          <span className="font-semibold text-brand-700">
            Reconhecido: {ORIGEM_VIDEO[info.tipo]}.
          </span>
        ) : (
          <span className="font-semibold text-amber-700">
            Não reconheci esse link. Vale YouTube, Vimeo, Google Drive, OneDrive ou um arquivo
            de vídeo direto.
          </span>
        )}
      </p>

      {salvo && (
        <p
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700"
          data-teste="boas-vindas-salvo"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
          Salvo.
        </p>
      )}
    </div>
  )
}
