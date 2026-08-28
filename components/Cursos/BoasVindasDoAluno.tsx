'use client'

import { useState } from 'react'
import { Clapperboard, ChevronDown, ChevronUp } from 'lucide-react'
import { analisarVideo } from '@/lib/video'

/* ============================================================
   AS BOAS-VINDAS DO MÓDULO, DO LADO DO ALUNO

   Aparece dentro da faixa do módulo, fechado. Um clique abre o vídeo ali
   mesmo, sem sair da lista de aulas.

   POR QUE ELE NÃO USA O `VideoPlayer` DAS AULAS

   Aquele player não é só um vídeo: ele é o instrumento de MEDIÇÃO da
   plataforma. Conta segundos assistidos, grava progresso, marca conclusão,
   trava o avanço para quem tenta pular, e conversa com o caderno na
   segunda tela. Tudo isso existe porque a aula vale presença.

   O vídeo de boas-vindas não vale presença: é o "bem-vindo ao Módulo 1,
   é isto que vamos fazer aqui". Usar o player das aulas aqui significaria
   ou gravar progresso de uma coisa que não é aula — sujando o boletim —
   ou ligar o modo pré-visualização, que mostra ao aluno uma tarja amarela
   dizendo "seu progresso não é salvo", uma frase que só faz sentido para
   quem está testando a tela.

   O QUE CONTINUA SENDO UM SÓ: a leitura do link. De onde vem o vídeo,
   como se monta o endereço de exibição e quais provedores valem é decisão
   de `lib/video.ts`, e é a mesma para a aula e para as boas-vindas. No dia
   em que a plataforma aprender um provedor novo, os dois aprendem juntos.
   ============================================================ */

export default function BoasVindasDoAluno({
  moduloNome,
  video,
}: {
  moduloNome: string
  video: string
}) {
  const [aberto, setAberto] = useState(false)
  const info = analisarVideo(video)

  if (info.tipo === 'desconhecido') return null

  return (
    <div className="mt-2" data-teste="boas-vindas-do-aluno">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-left text-[12px] font-semibold text-brand-800 ring-1 ring-brand-200 transition-colors hover:bg-white"
      >
        <Clapperboard className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
        <span className="min-w-0 flex-1 truncate">
          Boas-vindas {aberto ? '' : `a ${moduloNome}`}
        </span>
        {aberto ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
        )}
      </button>

      {aberto && (
        <div className="mt-2 overflow-hidden rounded-xl bg-black ring-1 ring-brand-950/10">
          {info.tipo === 'youtube' && info.id ? (
            <iframe
              src={`https://www.youtube.com/embed/${info.id}?rel=0`}
              title={`Boas-vindas a ${moduloNome}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="aspect-video w-full"
            />
          ) : info.embed && info.tipo !== 'arquivo' ? (
            <iframe
              src={info.embed}
              title={`Boas-vindas a ${moduloNome}`}
              allowFullScreen
              className="aspect-video w-full"
            />
          ) : (
            <video src={info.embed ?? info.url} controls className="aspect-video w-full" />
          )}
        </div>
      )}
    </div>
  )
}
