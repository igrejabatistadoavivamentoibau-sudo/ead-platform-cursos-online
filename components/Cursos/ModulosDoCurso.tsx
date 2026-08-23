/* ============================================================
   APOSENTADO — virou components/Cursos/ConteudoDoCurso.tsx

   Este arquivo mostrava os módulos com uma lista resumida das aulas de
   cada um — e logo abaixo, na mesma página, AulasManager mostrava as
   mesmas aulas de novo, plana. A pessoa via cada aula duas vezes e não
   sabia qual das duas listas era "a" lista.

   A árvore nova junta as duas: o módulo continua sendo o cabeçalho, com
   ordem, contagem de aulas e de turmas, mas agora as aulas de verdade
   ficam dentro dele — com vídeo, publicação, ordem e material de apoio.

   Fica aqui vazio porque o script de publicação copia por cima e não
   apaga arquivo nenhum.
   ============================================================ */

/** @deprecated Use ModuloComAulas de components/Cursos/ConteudoDoCurso. */
export interface ModuloItem {
  id: string
  nome: string
  descricao: string | null
  ordem: number
  turmas: number
}
