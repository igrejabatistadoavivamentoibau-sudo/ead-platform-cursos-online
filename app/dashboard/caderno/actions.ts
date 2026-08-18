'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { LIVROS, acharLivro, buscar, lerCapitulo, VERSAO_PADRAO, versaoValida } from '@/lib/biblia'

/* O documento vazio do editor. Precisa existir com essa forma exata:
   é o que o TipTap entende como "página em branco". */
const PAGINA_EM_BRANCO = { type: 'doc', content: [{ type: 'paragraph' }] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Documento = any

/**
 * Puxa o texto puro de dentro do documento do editor.
 *
 * Serve para a prévia na lista de páginas e para a busca. Ler o JSON
 * inteiro só para mostrar duas linhas seria caro, então o texto é extraído
 * uma vez, na hora de salvar, e guardado ao lado.
 */
function textoPuro(doc: Documento): string {
  const pedacos: string[] = []
  const andar = (no: Documento) => {
    if (!no) return
    if (typeof no.text === 'string') pedacos.push(no.text)
    if (Array.isArray(no.content)) no.content.forEach(andar)
  }
  andar(doc)
  return pedacos.join(' ').replace(/\s+/g, ' ').trim()
}

/** O título sai da primeira linha escrita, quando o aluno não deu um. */
function tituloSugerido(doc: Documento, atual: string): string {
  if (atual && atual !== 'Sem título') return atual
  const texto = textoPuro(doc)
  if (!texto) return 'Sem título'
  return texto.slice(0, 60) + (texto.length > 60 ? '…' : '')
}

async function pessoaLogada() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')
  return { supabase, userId: user.id }
}

/**
 * Abre (ou cria) a página do caderno daquela aula.
 *
 * Chamada toda vez que o aluno abre uma aula. Por isso ela é idempotente:
 * a segunda visita tem que cair na MESMA página, e não criar uma nova —
 * quem anota espera reencontrar o que escreveu, não uma folha em branco.
 */
export async function abrirCadernoDaAula(
  aulaId: string,
  cursoId: string | null,
  tituloAula: string
) {
  const { supabase, userId } = await pessoaLogada()

  const { data: existente } = await supabase
    .from('caderno_paginas')
    .select('id, titulo, conteudo')
    .eq('user_id', userId)
    .eq('aula_id', aulaId)
    .maybeSingle()

  if (existente) return existente

  const { data: criada, error } = await supabase
    .from('caderno_paginas')
    .insert({
      user_id: userId,
      aula_id: aulaId,
      curso_id: cursoId,
      titulo: tituloAula.slice(0, 200),
      conteudo: PAGINA_EM_BRANCO,
    })
    .select('id, titulo, conteudo')
    .single()

  if (error) throw new Error(error.message)
  return criada
}

/** Uma folha nova, sem aula nenhuma — anotação de culto, de leitura. */
export async function criarPagina(titulo = 'Sem título') {
  const { supabase, userId } = await pessoaLogada()

  const { data, error } = await supabase
    .from('caderno_paginas')
    .insert({ user_id: userId, titulo, conteudo: PAGINA_EM_BRANCO })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/caderno')
  return data.id as string
}

export async function salvarPagina(id: string, conteudo: Documento, titulo: string) {
  const { supabase, userId } = await pessoaLogada()

  const texto = textoPuro(conteudo)
  const { error } = await supabase
    .from('caderno_paginas')
    .update({
      conteudo,
      titulo: tituloSugerido(conteudo, titulo).slice(0, 200),
      resumo: texto.slice(0, 400),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return { salvoEm: new Date().toISOString() }
}

export async function renomearPagina(id: string, titulo: string) {
  const { supabase, userId } = await pessoaLogada()
  const limpo = titulo.trim().slice(0, 200) || 'Sem título'

  const { error } = await supabase
    .from('caderno_paginas')
    .update({ titulo: limpo, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/caderno')
  return { titulo: limpo }
}

export async function excluirPagina(id: string) {
  const { supabase, userId } = await pessoaLogada()
  const { error } = await supabase
    .from('caderno_paginas')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/caderno')
}

/* ---------------- Versículos para colar no caderno ---------------- */

export interface VersiculoAchado {
  referencia: string
  texto: string
  livro: number
  capitulo: number
  versiculo: number
}

/**
 * Procura o versículo que o aluno quer colar na anotação.
 *
 * Aceita os dois jeitos de pedir, porque as pessoas usam os dois:
 *   - pela referência: "Jo 3.16", "salmos 23", "1 Co 13 4"
 *   - pelas palavras: "bem-aventurados os mansos"
 *
 * A referência vem primeiro por ser o caso mais comum durante uma aula —
 * o professor fala o endereço, e o aluno digita o endereço.
 */
export async function procurarVersiculo(
  termo: string,
  siglaVersao = VERSAO_PADRAO
): Promise<VersiculoAchado[]> {
  const busca = termo.trim()
  if (busca.length < 2) return []

  const versao = versaoValida(siglaVersao)

  // "Jo 3.16" / "1 Co 13:4" / "salmos 23"
  const comoReferencia = busca.match(/^(\d?\s*[^\d\s.:,]+)[\s.]*(\d+)?[\s.:,]*(\d+)?$/i)
  if (comoReferencia) {
    const livro = acharLivro(comoReferencia[1])
    if (livro) {
      const cap = Math.min(livro.capitulos, Math.max(1, Number(comoReferencia[2] ?? 1)))
      const lido = await lerCapitulo(versao.sigla, livro.i, cap)
      if (lido) {
        const pedido = Number(comoReferencia[3])
        const versiculos = Number.isFinite(pedido) && pedido > 0 ? [pedido] : null

        const lista = (versiculos ?? lido.versiculos.map((_, i) => i + 1))
          .filter((n) => n >= 1 && n <= lido.versiculos.length)
          .slice(0, 20)

        return lista.map((n) => ({
          referencia: `${livro.nome} ${cap}.${n}`,
          texto: lido.versiculos[n - 1],
          livro: livro.i,
          capitulo: cap,
          versiculo: n,
        }))
      }
    }
  }

  const resultado = await buscar(versao.sigla, busca, { limite: 20 })
  return resultado.achados.map((a) => ({
    referencia: `${a.livro.nome} ${a.capitulo}.${a.versiculo}`,
    texto: a.texto,
    livro: a.livro.i,
    capitulo: a.capitulo,
    versiculo: a.versiculo,
  }))
}

/** Nome do livro pelo índice — usado ao montar a citação no caderno. */
export async function nomeDoLivro(indice: number) {
  return LIVROS[indice]?.nome ?? ''
}
