'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Highlighter,
  Undo2,
  Redo2,
  Clock,
  BookMarked,
  Check,
  Loader2,
  Save,
  CloudOff,
  RotateCcw,
} from 'lucide-react'
import { salvarPagina } from '@/app/dashboard/caderno/actions'
import { abrirCanalDaAula, minutoLegivel, type CanalDaAula } from '@/lib/duasTelas'
import { rascunhoLocal, tamanhoDoTexto } from '@/lib/rascunhoLocal'
import SeletorVersiculo from '@/components/Caderno/SeletorVersiculo'
import { MarcaDeMinuto } from '@/components/Caderno/MarcaDeMinuto'

/* ============================================================
   O CADERNO

   O QUE ELE PRECISA SER
   Um lugar onde o aluno escreve DURANTE a aula. Isso muda tudo: quem anota
   com o professor falando não pode parar para procurar botão, nem perder
   uma frase porque o texto não salvou. Daí as três decisões que mandam
   aqui:

   1. Salva sozinho. Nunca há um botão "salvar" a apertar — o caderno
      guarda dois segundos depois da última tecla, e avisa discretamente
      que guardou. Quem anota em aula não lembra de salvar, e não deveria
      precisar.
   2. A barra tem só o que se usa escutando: título, tópicos, negrito,
      marca-texto e citação. Editor cheio de botão vira um programa de
      escritório, e ninguém formata texto no meio de uma aula.
   3. Dois botões que só existem aqui: MARCAR O MINUTO do vídeo e COLAR UM
      VERSÍCULO. São os dois gestos que o aluno faria à mão no caderno de
      papel — "isso ele falou lá pelos 12 minutos" e "ele citou Efésios 4".
   ============================================================ */

const CORES_MARCA = [
  { nome: 'Amarelo', cor: '#fdf3d0', bolinha: 'bg-[#f2d24b]' },
  { nome: 'Verde', cor: '#d9f2e4', bolinha: 'bg-[#3fbf85]' },
  { nome: 'Azul', cor: '#d9e9fb', bolinha: 'bg-[#4b9df2]' },
  { nome: 'Rosa', cor: '#fbdfe9', bolinha: 'bg-[#ef6f9c]' },
  { nome: 'Roxo', cor: '#e6ddf7', bolinha: 'bg-[#9271e0]' },
]

function Botao({
  ativo,
  titulo,
  aoClicar,
  children,
  desabilitado,
}: {
  ativo?: boolean
  titulo: string
  aoClicar: () => void
  children: React.ReactNode
  desabilitado?: boolean
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      disabled={desabilitado}
      onMouseDown={(e) => e.preventDefault()} // não rouba o cursor do texto
      onClick={aoClicar}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-30 ${
        ativo
          ? 'bg-brand-700 text-white'
          : 'text-gray-500 hover:bg-[#f1f5f3] hover:text-brand-800'
      }`}
    >
      {children}
    </button>
  )
}

export interface EditorCadernoProps {
  paginaId: string
  tituloInicial: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conteudoInicial: any
  /** Quando o caderno é de uma aula, ele conversa com o player dela. */
  aulaId?: string | null
  /** Modo janela separada: sem margens grandes, para caber numa tela só. */
  compacto?: boolean
}

export default function EditorCaderno({
  paginaId,
  tituloInicial,
  conteudoInicial,
  aulaId,
  compacto = false,
}: EditorCadernoProps) {
  const [estado, setEstado] = useState<'limpo' | 'escrevendo' | 'salvando' | 'salvo' | 'falhou'>(
    'limpo'
  )
  const [salvoAs, setSalvoAs] = useState<string | null>(null)
  const [abrirVersiculo, setAbrirVersiculo] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)
  const [minutoDoVideo, setMinutoDoVideo] = useState<number | null>(null)
  const [avisoTrava, setAvisoTrava] = useState<string | null>(null)
  const [recuperado, setRecuperado] = useState(false)

  const tituloRef = useRef(tituloInicial)
  const canalRef = useRef<CanalDaAula | null>(null)
  const relogioRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendenteRef = useRef<any>(null)

  /* O título pode ser trocado no campo de cima enquanto se escreve aqui.
     Sem acompanhar essa troca, o caderno salvaria sempre o título ANTIGO e
     desfaria a renomeação que a pessoa acabou de fazer. */
  useEffect(() => {
    tituloRef.current = tituloInicial
  }, [tituloInicial])

  /* ---------------- Conversa com o player ---------------- */
  useEffect(() => {
    if (!aulaId) return
    const canal = abrirCanalDaAula(aulaId, (recado) => {
      if (recado.tipo === 'tempo') setMinutoDoVideo(recado.segundos)
      if (recado.tipo === 'travado') {
        setAvisoTrava(`Você ainda não assistiu até aí — a aula está liberada até ${minutoLegivel(recado.ate)}.`)
        setTimeout(() => setAvisoTrava(null), 3600)
      }
    })
    canalRef.current = canal
    return () => {
      canal.fechar()
      canalRef.current = null
    }
  }, [aulaId])

  const editor = useEditor({
    immediatelyRender: false, // o servidor não desenha editor; evita descompasso
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Link e código não entram: caderno de aula não é página de site.
        codeBlock: false,
        horizontalRule: false,
      }),
      Highlight.configure({ multicolor: true }),
      MarcaDeMinuto,
      Placeholder.configure({
        placeholder: 'Comece a escrever o que a aula está falando...',
      }),
    ],
    content: conteudoInicial,
    /**
     * A cópia que ficou no aparelho é mais nova que a do servidor?
     *
     * Acontece quando a internet caiu no meio da anotação. Em vez de abrir
     * a folha do servidor (mais velha) e a pessoa achar que perdeu tudo, o
     * caderno devolve o que ela escreveu e avisa que recuperou.
     *
     * Isto vive aqui, no nascimento do editor, e não num efeito: efeito que
     * reescreve a folha depois de já ter desenhado faz o texto piscar.
     */
    onCreate: ({ editor }) => {
      const guardado = rascunhoLocal.ler(paginaId)
      if (!guardado) return
      if (tamanhoDoTexto(guardado.doc) <= tamanhoDoTexto(conteudoInicial)) {
        rascunhoLocal.limpar(paginaId)
        return
      }
      editor.commands.setContent(guardado.doc, { emitUpdate: false })
      pendenteRef.current = guardado.doc
      setRecuperado(true)
      void guardarAgora()
    },
    editorProps: {
      attributes: {
        class: 'caderno-folha focus:outline-none',
      },
      handleDOMEvents: {
        /* Clicar numa marca de minuto pede ao player que volte àquele ponto.
           O pedido vai pelo canal entre janelas, então funciona tanto com o
           vídeo logo acima quanto com o vídeo na outra tela. */
        click: (_visao, evento) => {
          const alvo = (evento.target as HTMLElement | null)?.closest?.('[data-minuto]')
          if (!alvo) return false
          const segundos = Number(alvo.getAttribute('data-minuto') ?? 0)
          canalRef.current?.publicar({ tipo: 'ir', segundos })
          return true
        },
      },
    },
    onUpdate: ({ editor }) => {
      const doc = editor.getJSON()
      pendenteRef.current = doc
      rascunhoLocal.guardar(paginaId, doc)
      setEstado('escrevendo')

      if (relogioRef.current) clearTimeout(relogioRef.current)
      // Dois segundos parado = fim da frase. Salvar a cada tecla encheria a
      // rede à toa; salvar só ao sair perderia a aula inteira num tombo.
      relogioRef.current = setTimeout(() => {
        void guardarAgora()
      }, 2000)
    },
  })

  /**
   * Guarda o que está escrito. É o ÚNICO caminho de salvamento — o
   * automático, o botão e o Ctrl+S passam todos por aqui, para não existir
   * um jeito que funciona e outro que não.
   */
  const guardarAgora = useCallback(async () => {
    const doc = pendenteRef.current ?? editorRef.current?.getJSON()
    if (!doc) return
    if (relogioRef.current) {
      clearTimeout(relogioRef.current)
      relogioRef.current = null
    }
    setEstado('salvando')
    try {
      await salvarPagina(paginaId, doc, tituloRef.current)
      pendenteRef.current = null
      // Só apagamos a cópia local DEPOIS que o servidor confirmou. Se a
      // internet cair no meio, o rascunho continua no aparelho e volta na
      // próxima vez que a pessoa abrir a página.
      rascunhoLocal.limpar(paginaId)
      setSalvoAs(
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      )
      setEstado('salvo')
    } catch {
      setEstado('falhou')
    }
  }, [paginaId])

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  /* Sair da página, trocar de aba ou fechar o navegador com algo por salvar
     não pode custar a anotação. `visibilitychange` é o único momento que o
     navegador garante antes de descartar a página — inclusive no celular,
     onde `beforeunload` muitas vezes nem chega a acontecer. */
  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === 'hidden' && pendenteRef.current) void guardarAgora()
    }
    document.addEventListener('visibilitychange', aoEsconder)
    window.addEventListener('pagehide', aoEsconder)
    return () => {
      document.removeEventListener('visibilitychange', aoEsconder)
      window.removeEventListener('pagehide', aoEsconder)
    }
  }, [guardarAgora])

  /* Ctrl+S / Cmd+S — o reflexo de quem já usou qualquer editor na vida. */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void guardarAgora()
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [guardarAgora])

  useEffect(() => {
    const relogio = relogioRef
    return () => {
      if (relogio.current) clearTimeout(relogio.current)
      if (pendenteRef.current) {
        salvarPagina(paginaId, pendenteRef.current, tituloRef.current).catch(() => {})
      }
    }
  }, [paginaId])

  const marcarMinuto = useCallback(() => {
    if (!editor || minutoDoVideo === null) return
    editor.commands.inserirMinuto(minutoDoVideo, minutoLegivel(minutoDoVideo))
  }, [editor, minutoDoVideo])

  const colarVersiculo = useCallback(
    (referencia: string, texto: string) => {
      if (!editor) return
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: `“${texto}” ` },
                  { type: 'text', marks: [{ type: 'bold' }], text: `— ${referencia}` },
                ],
              },
            ],
          },
          { type: 'paragraph' },
        ])
        .run()
      setAbrirVersiculo(false)
    },
    [editor]
  )

  if (!editor) {
    return (
      <div className="grid h-40 place-items-center rounded-2xl border border-brand-950/[0.07] bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-gray-300" strokeWidth={2} />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-950/[0.07] bg-white shadow-[0_1px_2px_rgba(5,38,29,0.04),0_10px_24px_-20px_rgba(5,38,29,0.14)]">
      {/* ---------------- Barra de ferramentas ---------------- */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-brand-950/[0.07] bg-white px-2.5 py-1.5">
        <Botao
          titulo="Título de tópico"
          ativo={editor.isActive('heading', { level: 2 })}
          aoClicar={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" strokeWidth={2} />
        </Botao>
        <Botao
          titulo="Subtítulo"
          ativo={editor.isActive('heading', { level: 3 })}
          aoClicar={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" strokeWidth={2} />
        </Botao>

        <span className="mx-1 h-5 w-px bg-brand-950/[0.08]" />

        <Botao
          titulo="Lista de tópicos"
          ativo={editor.isActive('bulletList')}
          aoClicar={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" strokeWidth={2} />
        </Botao>
        <Botao
          titulo="Lista numerada"
          ativo={editor.isActive('orderedList')}
          aoClicar={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" strokeWidth={2} />
        </Botao>
        <Botao
          titulo="Citação"
          ativo={editor.isActive('blockquote')}
          aoClicar={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" strokeWidth={2} />
        </Botao>

        <span className="mx-1 h-5 w-px bg-brand-950/[0.08]" />

        <Botao
          titulo="Negrito"
          ativo={editor.isActive('bold')}
          aoClicar={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" strokeWidth={2.4} />
        </Botao>
        <Botao
          titulo="Itálico"
          ativo={editor.isActive('italic')}
          aoClicar={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" strokeWidth={2.2} />
        </Botao>

        {/* Marca-texto: as cinco cores ficam à mostra, não escondidas atrás
            de um menu. Grifar é o gesto mais repetido numa aula. */}
        <span className="mx-1 h-5 w-px bg-brand-950/[0.08]" />
        <span className="grid h-8 w-7 place-items-center text-gray-300" title="Marca-texto">
          <Highlighter className="h-4 w-4" strokeWidth={2} />
        </span>
        {CORES_MARCA.map((c) => (
          <button
            key={c.cor}
            type="button"
            title={`Marcar de ${c.nome.toLowerCase()}`}
            aria-label={`Marcar de ${c.nome.toLowerCase()}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHighlight({ color: c.cor }).run()}
            className={`h-5 w-5 rounded-full ${c.bolinha} transition-transform hover:scale-110 ${
              editor.isActive('highlight', { color: c.cor })
                ? 'ring-2 ring-brand-700 ring-offset-1'
                : ''
            }`}
          />
        ))}

        <span className="mx-1 h-5 w-px bg-brand-950/[0.08]" />

        <Botao
          titulo="Desfazer"
          aoClicar={() => editor.chain().focus().undo().run()}
          desabilitado={!editor.can().undo()}
        >
          <Undo2 className="h-4 w-4" strokeWidth={2} />
        </Botao>
        <Botao
          titulo="Refazer"
          aoClicar={() => editor.chain().focus().redo().run()}
          desabilitado={!editor.can().redo()}
        >
          <Redo2 className="h-4 w-4" strokeWidth={2} />
        </Botao>

        {/* Numa largura estreita a barra quebra em duas linhas. O
            `ml-auto` só entra a partir do tamanho em que TUDO cabe numa
            linha — senão a segunda linha nasceria encostada à direita, com
            um vão vazio no meio da barra. */}
        <span className="flex items-center gap-1.5 lg:ml-auto">
          {aulaId && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={marcarMinuto}
              disabled={minutoDoVideo === null}
              title={
                minutoDoVideo === null
                  ? 'Deixe o vídeo da aula tocando para marcar o minuto'
                  : 'Marcar o minuto do vídeo aqui'
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-950/[0.08] px-2.5 text-[12px] font-semibold text-gray-600 transition-colors hover:border-brand-500/40 hover:text-brand-800 disabled:opacity-40"
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={2} />
              {minutoDoVideo === null ? 'minuto' : minutoLegivel(minutoDoVideo)}
            </button>
          )}

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setAbrirVersiculo(true)}
            title="Colar um versículo"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-950/[0.08] px-2.5 text-[12px] font-semibold text-gray-600 transition-colors hover:border-brand-500/40 hover:text-brand-800"
          >
            <BookMarked className="h-3.5 w-3.5" strokeWidth={2} />
            Versículo
          </button>

          {/* O BOTÃO DE SALVAR

              O caderno guarda sozinho — e mesmo assim o botão existe.
              A primeira versão não tinha, por elegância: "não precisa
              salvar, ele salva". Só que a primeira pergunta que a escola
              fez foi "como eu salvo?". Quando a pessoa precisa perguntar,
              a elegância virou dúvida — e dúvida sobre anotação de aula é
              angústia. O botão custa um canto da barra e devolve a certeza.
              Quem confia no automático simplesmente nunca clica nele. */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void guardarAgora()}
            disabled={estado === 'salvando'}
            title="Salvar agora (Ctrl+S)"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition-colors disabled:opacity-60 ${
              estado === 'escrevendo' || estado === 'falhou'
                ? 'bg-brand-700 text-white hover:bg-brand-800'
                : 'border border-brand-950/[0.08] text-gray-600 hover:border-brand-500/40 hover:text-brand-800'
            }`}
          >
            {estado === 'salvando' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
            ) : estado === 'falhou' ? (
              <CloudOff className="h-3.5 w-3.5" strokeWidth={2.1} />
            ) : (
              <Save className="h-3.5 w-3.5" strokeWidth={2.1} />
            )}
            {estado === 'salvando' ? 'Salvando' : estado === 'falhou' ? 'Tentar de novo' : 'Salvar'}
          </button>

          {/* O recado de estado, ao lado do botão. Discreto quando está
              tudo bem, e impossível de ignorar quando não está. */}
          <span className="hidden items-center gap-1 text-[10.5px] font-semibold sm:flex">
            {estado === 'salvo' && (
              <span className="flex items-center gap-1 text-brand-600/80">
                <Check className="h-3 w-3" strokeWidth={3} />
                salvo{salvoAs ? ` às ${salvoAs}` : ''}
              </span>
            )}
            {estado === 'escrevendo' && <span className="text-gray-300">alterações por salvar</span>}
            {estado === 'falhou' && (
              <span className="text-red-600">sem conexão — o texto está guardado no aparelho</span>
            )}
          </span>
        </span>
      </div>

      {/* A pessoa perdeu a internet, escreveu assim mesmo, e o caderno
          devolveu o texto. Ela precisa SABER disso — senão vai achar que a
          plataforma inventou conteúdo, ou pior, não vai confiar mais nela. */}
      {recuperado && (
        <p className="flex items-center gap-2 border-b border-brand-200 bg-brand-50 px-4 py-2 text-[12px] font-semibold text-brand-800">
          <RotateCcw className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
          Recuperei o que você tinha escrito por último — a internet caiu antes de guardar.
        </p>
      )}

      {avisoTrava && (
        <p className="border-b border-[#f0e2bd] bg-[#fdf8ec] px-4 py-2 text-[12px] font-semibold text-[#8a6116]">
          {avisoTrava}
        </p>
      )}

      <EditorContent
        editor={editor}
        className={compacto ? 'px-5 py-5' : 'px-6 py-7 sm:px-10 sm:py-9'}
      />

      {abrirVersiculo && (
        <SeletorVersiculo aoEscolher={colarVersiculo} aoFechar={() => setAbrirVersiculo(false)} />
      )}
    </div>
  )
}

export type { Editor }
