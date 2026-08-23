/* ============================================================
   APOSENTADO — virou components/Cursos/ConteudoDoCurso.tsx

   Este arquivo era a lista PLANA de todas as aulas do curso. Ao lado
   dela, na mesma página, existia ModulosDoCurso, que mostrava as MESMAS
   aulas agrupadas por módulo. Duas listas do mesmo conteúdo: quem
   chegava para anexar um vídeo ou uma apostila não sabia em qual das
   duas mexer, e as aulas de módulos diferentes apareciam em sequência
   corrida — "fica tudo misturado".

   Hoje existe uma árvore só (módulo → suas aulas), com o botão de nova
   aula dentro da seção do módulo e o material de apoio dentro da linha
   da aula. Ver e anexar acontecem no mesmo lugar.

   O arquivo continua aqui, vazio de comportamento, de propósito: o
   script de publicação COPIA arquivos por cima e não apaga nenhum.
   Deixá-lo com o conteúdo antigo seria manter uma segunda tela viva,
   pronta para ser importada de novo sem querer.
   ============================================================ */

export type { AulaItem } from '@/components/Aulas/LinhaDaAula'

/** @deprecated Use ModuloComAulas de components/Cursos/ConteudoDoCurso. */
export interface ModuloDaLista {
  id: string
  nome: string
  ordem: number
}
