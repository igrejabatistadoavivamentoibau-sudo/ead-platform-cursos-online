'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { registrarPasso, passoAnterior, type PassoDaTrilha } from '@/lib/trilha'

/* ============================================================
   O BOTÃO VOLTAR QUE VOLTA DE VERDADE

   Antes ele era um link para um endereço fixo. Da turma → Notas, "voltar"
   levava para "Minhas turmas" — a lista, lá no começo. Quem estava três
   telas adentro refazia o caminho inteiro a pé.

   Agora ele pergunta à trilha (lib/trilha.ts) se existe uma tela anterior
   aqui dentro:

     existe  → `router.back()`, que volta E devolve a rolagem no ponto em
               que a pessoa estava. O rótulo passa a ser o nome daquela
               tela, não um nome inventado.
     não existe (chegou por link, abriu em aba nova, apertou F5 no meio)
             → vai para o endereço declarado, que continua sendo um
               destino seguro e sensato.

   POR QUE O RÓTULO É CALCULADO DEPOIS DA PRIMEIRA PINTURA
   A trilha mora no navegador; o servidor não a conhece. Se o texto fosse
   decidido no servidor, o React reclamaria da diferença entre os dois
   lados. Então nasce com o rótulo declarado — que está sempre certo — e
   se ajusta no primeiro instante do navegador, sem piscar layout.
   ============================================================ */

export default function Voltar({
  href,
  label,
  titulo,
  margem = 'mb-3',
}: {
  href: string
  label: string
  /** O título desta tela, para a trilha poder nomear o "voltar" da próxima. */
  titulo?: string
  /**
   * O espaço embaixo do botão. Existe porque em algumas telas ele fica
   * dentro de uma fileira ao lado de outros itens, e ali a margem
   * desalinharia a fileira inteira — nesses casos passa `margem=""`.
   */
  margem?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [anterior, setAnterior] = useState<PassoDaTrilha | null>(null)

  useEffect(() => {
    registrarPasso(pathname, titulo)
    setAnterior(passoAnterior())
  }, [pathname, titulo])

  const voltar = (e: React.MouseEvent) => {
    // Ctrl/⌘/meio: deixa o navegador abrir em aba nova, como qualquer link.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
    e.preventDefault()
    if (anterior) router.back()
    else router.push(href)
  }

  const texto = anterior?.t ?? (anterior ? 'Voltar' : label)

  return (
    <a
      href={anterior?.p ?? href}
      onClick={voltar}
      className={`group ${margem} inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-500 transition-colors hover:text-brand-700`}
    >
      <ArrowLeft
        className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-0.5"
        strokeWidth={2.2}
      />
      {texto}
    </a>
  )
}

/**
 * Registra a tela na trilha sem desenhar nada.
 *
 * Vai em TODA tela que tem cabeçalho, inclusive as que não têm botão de
 * voltar. Sem isso, a trilha teria buracos: a pessoa passaria por uma tela
 * sem botão, e o "voltar" da tela seguinte apontaria para duas telas atrás.
 */
export function RegistroDaTrilha({ titulo }: { titulo: string }) {
  const pathname = usePathname()
  useEffect(() => {
    registrarPasso(pathname, titulo)
  }, [pathname, titulo])
  return null
}

/**
 * Registra QUALQUER tela do painel na trilha, tenha ela cabeçalho ou não.
 *
 * POR QUE ISTO É NECESSÁRIO, E NÃO EXAGERO
 * Se uma tela sem cabeçalho ficasse de fora, a trilha teria um buraco: a
 * pessoa passaria por ela, e o "voltar" da tela seguinte diria o nome de
 * uma tela DUAS casas atrás — mas `router.back()` a levaria para a de
 * trás mesmo, a que ficou de fora. O botão prometeria um lugar e entregaria
 * outro, que é pior do que não ter botão.
 *
 * Mora no layout do painel, então vale para toda tela de agora e para toda
 * tela nova que vier depois, sem ninguém precisar lembrar de plugá-la.
 *
 * Ele registra só o CAMINHO. O título chega logo em seguida, pelo cabeçalho
 * da tela — `registrarPasso` sabe juntar os dois sem duplicar o passo.
 */
export function RegistroDaRota() {
  const pathname = usePathname()
  useEffect(() => {
    registrarPasso(pathname)
  }, [pathname])
  return null
}
