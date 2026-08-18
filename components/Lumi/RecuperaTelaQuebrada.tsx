/**
 * Este componente foi APOSENTADO — de propósito, e o arquivo continua aqui
 * só para não quebrar quem o importa.
 *
 * POR QUE ELE NÃO FUNCIONAVA
 * Ele instalava o ouvinte de erro dentro de um efeito do React, ou seja,
 * DEPOIS que a página já tinha sido montada. Só que a falha do arquivo de
 * estilo acontece muito antes disso: no instante em que o navegador lê o
 * cabeçalho da página. Quando o React acordava e instalava o ouvinte, o
 * erro já tinha passado e ninguém o escutou. A rede de segurança existia,
 * mas chegava sempre atrasada.
 *
 * Quem faz esse trabalho agora é o guardião injetado no cabeçalho da
 * página (ver lib/guardiaoDaTela.ts): ele roda antes de tudo, escuta a
 * falha no momento em que ela ocorre e, além disso, confere depois se o
 * estilo realmente valeu.
 */
export default function RecuperaTelaQuebrada() {
  return null
}
