import Esqueleto from '@/components/ui/Esqueleto'

/**
 * O que aparece enquanto a tela é montada no servidor.
 *
 * Vale para esta área inteira e para tudo o que está dentro dela. Sem
 * este arquivo, o Next segura a navegação e a tela ANTERIOR fica parada
 * na frente da pessoa até o servidor responder — o clique parece não ter
 * pego, e ela clica de novo.
 */
export default function Carregando() {
  return <Esqueleto />
}
