'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NotebookPen, Loader2, ExternalLink } from 'lucide-react'
import { abrirCadernoDaAula } from '@/app/dashboard/caderno/actions'
import EditorCaderno from '@/components/Caderno/EditorCaderno'
import AbrirEmOutraJanela from '@/components/Caderno/AbrirEmOutraJanela'

/**
 * O caderno logo abaixo do vídeo da aula.
 *
 * POR QUE ELE SÓ NASCE QUANDO A PESSOA PEDE
 * Criar a folha no instante em que a aula abre encheria o caderno de
 * páginas em branco de toda aula que o aluno espiou. A folha nasce no
 * primeiro clique em "abrir o caderno" — e a partir daí ela existe e é
 * sempre a mesma, em qualquer visita.
 *
 * A aula que o professor está preparando (pré-visualização) não ganha
 * caderno: ali ele está conferindo o material, não estudando.
 */
export default function CadernoDaAula({
  aulaId,
  cursoId,
  tituloAula,
  desligado = false,
}: {
  aulaId: string
  cursoId: string | null
  tituloAula: string
  desligado?: boolean
}) {
  const [pagina, setPagina] = useState<{
    id: string
    titulo: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conteudo: any
  } | null>(null)
  const [abrindo, setAbrindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  /* Trocar de aula tem de trocar de folha — senão o caderno da aula
     anterior ficaria aberto embaixo do vídeo da aula nova.
     Quem cuida disso é quem monta este componente, dando a ele uma
     identidade que muda junto com a aula (ver VisaoDoCurso). Assim o React
     monta um caderno novo, em vez de este aqui reescrever o próprio estado
     depois de já ter desenhado. */

  if (desligado) return null

  const abrir = async () => {
    setAbrindo(true)
    setErro(null)
    try {
      const p = await abrirCadernoDaAula(aulaId, cursoId, tituloAula)
      setPagina(p as { id: string; titulo: string; conteudo: unknown })
    } catch {
      setErro('Não consegui abrir seu caderno agora. Tente de novo em um instante.')
    } finally {
      setAbrindo(false)
    }
  }

  if (!pagina) {
    return (
      <div className="mt-6 rounded-2xl border border-brand-950/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-200 bg-brand-50 text-brand-700">
            <NotebookPen className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[14px] font-bold tracking-[-0.01em] text-gray-900">
              Caderno desta aula
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
              Anote enquanto assiste, grife o que importa e marque o minuto do vídeo. É só seu —
              nem o professor lê.
            </p>
          </div>
          <button
            type="button"
            onClick={abrir}
            disabled={abrindo}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
          >
            {abrindo ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
            ) : (
              <NotebookPen className="h-4 w-4" strokeWidth={2.1} />
            )}
            Abrir o caderno
          </button>
        </div>
        {erro && <p className="mt-3 text-[12.5px] text-red-600">{erro}</p>}
      </div>
    )
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <NotebookPen className="h-3.5 w-3.5 text-brand-700" strokeWidth={2} />
        <h3 className="micro-rotulo text-[11px] font-extrabold tracking-[0.14em] text-[#41514a]">
          CADERNO DESTA AULA
        </h3>
        <span className="h-px flex-1 bg-gradient-to-r from-brand-950/[0.08] to-transparent" />
        <AbrirEmOutraJanela paginaId={pagina.id} />
        <Link
          href={`/dashboard/caderno/${pagina.id}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-950/[0.08] bg-white px-3 text-[12px] font-semibold text-gray-600 transition-colors hover:border-brand-500/40 hover:text-brand-800"
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          Tela cheia
        </Link>
      </div>

      <EditorCaderno
        paginaId={pagina.id}
        tituloInicial={pagina.titulo}
        conteudoInicial={pagina.conteudo}
        aulaId={aulaId}
      />
    </div>
  )
}
