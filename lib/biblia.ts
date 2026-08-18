import livrosJson from '@/data/biblia/livros.json'

/* ============================================================
   A BÍBLIA DA PLATAFORMA

   ONDE O TEXTO MORA
   Nos arquivos data/biblia/*.json, dentro do próprio projeto — não num
   serviço de terceiros. Três motivos:

   1. Não depende de ninguém. Nenhum site fora do ar derruba a leitura da
      Palavra na escola.
   2. Não custa nada e não gasta banco.
   3. As três traduções aqui são de DOMÍNIO PÚBLICO. Podem ser copiadas e
      distribuídas livremente. NVI, NAA, ACF, ARA e as demais pertencem a
      editoras: entram aqui no dia em que a igreja tiver a licença delas, e
      o lugar para encaixar já está pronto (basta somar à lista VERSOES).

   COMO É LIDO
   Cada tradução é um arquivo de cerca de 4 MB. Ele é carregado UMA vez, na
   primeira leitura, e fica guardado na memória do servidor. Quem lê um
   capítulo recebe só aquele capítulo — os 4 MB nunca vão para o navegador
   do aluno.
   ============================================================ */

export interface LivroBiblia {
  /** Índice na ordem canônica, de 0 (Gênesis) a 65 (Apocalipse). */
  i: number
  abrev: string
  nome: string
  testamento: 'AT' | 'NT'
  capitulos: number
}

export const LIVROS = livrosJson as LivroBiblia[]

export interface VersaoBiblia {
  sigla: string
  nome: string
  ano: string
  /** Uma linha honesta sobre o texto, para a pessoa escolher com critério. */
  sobre: string
  arquivo: string
}

export const VERSOES: VersaoBiblia[] = [
  {
    sigla: 'BLIVRE',
    nome: 'Bíblia Livre',
    ano: '2018',
    sobre: 'Português de hoje, fácil de ler. É a leitura padrão da escola.',
    arquivo: 'blivre',
  },
  {
    sigla: 'TB',
    nome: 'Tradução Brasileira',
    ano: '1917',
    sobre: 'Tradução clássica e literal, feita no Brasil. Boa para estudo.',
    arquivo: 'tb',
  },
  {
    sigla: 'ALM1911',
    nome: 'Almeida 1911',
    ano: '1911',
    sobre: 'A Almeida antiga, na grafia da época. Sabor histórico.',
    arquivo: 'alm1911',
  },
]

export const VERSAO_PADRAO = 'BLIVRE'

export function versaoValida(sigla: string | undefined | null): VersaoBiblia {
  return VERSOES.find((v) => v.sigla === sigla) ?? VERSOES[0]
}

/**
 * O texto carregado, por tradução.
 *
 * Fica fora da função de propósito: em Node o módulo sobrevive entre uma
 * visita e outra, então o arquivo é lido uma vez só. Sem isto, cada capítulo
 * aberto releria 4 MB do disco.
 */
type TextoBiblia = string[][][]
const carregadas = new Map<string, TextoBiblia>()

async function carregar(versao: VersaoBiblia): Promise<TextoBiblia> {
  const guardada = carregadas.get(versao.sigla)
  if (guardada) return guardada

  // O `import` dinâmico garante que o arquivo seja empacotado junto com o
  // servidor. Ler pelo caminho do disco falharia na publicação: lá o projeto
  // é recortado, e só entra o que aparece explicitamente no código.
  const modulo = await import(`@/data/biblia/${versao.arquivo}.json`)
  const texto = (modulo.default ?? modulo) as TextoBiblia
  carregadas.set(versao.sigla, texto)
  return texto
}

export interface CapituloLido {
  livro: LivroBiblia
  capitulo: number
  versiculos: string[]
}

/** Um capítulo, na tradução pedida. */
export async function lerCapitulo(
  siglaVersao: string,
  indiceLivro: number,
  capitulo: number
): Promise<CapituloLido | null> {
  const livro = LIVROS[indiceLivro]
  if (!livro) return null
  if (capitulo < 1 || capitulo > livro.capitulos) return null

  const texto = await carregar(versaoValida(siglaVersao))
  const versiculos = texto[indiceLivro]?.[capitulo - 1]
  if (!versiculos) return null

  return { livro, capitulo, versiculos }
}

/** O mesmo capítulo em outra tradução, para a leitura lado a lado. */
export async function lerCapituloComparado(
  siglaVersao: string,
  indiceLivro: number,
  capitulo: number
): Promise<string[] | null> {
  const texto = await carregar(versaoValida(siglaVersao))
  return texto[indiceLivro]?.[capitulo - 1] ?? null
}

/* ---------------- Busca ---------------- */

/**
 * Tira acento e caixa para comparar.
 *
 * Ninguém digita "coração" com o acento certo quando está com pressa, e
 * muito menos "Jó" com o circunflexo. Uma busca que exige acento perfeito é
 * uma busca que não acha nada — e a pessoa conclui que o versículo não
 * existe na plataforma.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export interface AchadoBusca {
  livro: LivroBiblia
  capitulo: number
  versiculo: number
  texto: string
}

export interface ResultadoBusca {
  achados: AchadoBusca[]
  total: number
  /** Verdadeiro quando havia mais resultados do que o limite pedido. */
  truncado: boolean
}

/**
 * Procura uma expressão em toda a Bíblia.
 *
 * Percorre os 31 mil versículos na força bruta. Parece ingênuo, mas em
 * memória isso leva poucos centésimos de segundo — e evita depender de um
 * índice de busca que precisaria ser construído, guardado e mantido em dia.
 * Simplicidade que se paga.
 *
 * `apenas` restringe a Antigo ou Novo Testamento; sem ele, procura na
 * Bíblia inteira.
 */
export async function buscar(
  siglaVersao: string,
  termo: string,
  opcoes: { apenas?: 'AT' | 'NT'; limite?: number } = {}
): Promise<ResultadoBusca> {
  const limite = opcoes.limite ?? 200
  const alvo = normalizar(termo.trim())
  if (alvo.length < 2) return { achados: [], total: 0, truncado: false }

  const texto = await carregar(versaoValida(siglaVersao))
  const achados: AchadoBusca[] = []
  let total = 0

  for (let l = 0; l < texto.length; l++) {
    const livro = LIVROS[l]
    if (opcoes.apenas && livro.testamento !== opcoes.apenas) continue

    const capitulos = texto[l]
    for (let c = 0; c < capitulos.length; c++) {
      const versiculos = capitulos[c]
      for (let v = 0; v < versiculos.length; v++) {
        if (!normalizar(versiculos[v]).includes(alvo)) continue
        total++
        if (achados.length < limite) {
          achados.push({ livro, capitulo: c + 1, versiculo: v + 1, texto: versiculos[v] })
        }
      }
    }
  }

  return { achados, total, truncado: total > achados.length }
}

/* ---------------- Referências ---------------- */

/** "Gn", "gênesis", "1 Co" — tudo cai no livro certo. */
export function acharLivro(entrada: string): LivroBiblia | null {
  const alvo = normalizar(entrada).replace(/\s+/g, '')
  return (
    LIVROS.find((l) => normalizar(l.abrev).replace(/\s+/g, '') === alvo) ??
    LIVROS.find((l) => normalizar(l.nome).replace(/\s+/g, '') === alvo) ??
    LIVROS.find((l) => normalizar(l.nome).replace(/\s+/g, '').startsWith(alvo)) ??
    null
  )
}

/** Como a referência aparece na tela: "João 3.16". */
export function referencia(livro: LivroBiblia, capitulo: number, versiculo?: number) {
  return versiculo ? `${livro.nome} ${capitulo}.${versiculo}` : `${livro.nome} ${capitulo}`
}
