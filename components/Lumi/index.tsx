import AvisoDeAtualizacao from './AvisoDeAtualizacao'
import SaudacaoDiaria from './SaudacaoDiaria'
import RecuperaTelaQuebrada from './RecuperaTelaQuebrada'
import RecadoDaLumi from './RecadoDaLumi'
import CantoDaLumi from './Canto'

/**
 * A LUMI inteira.
 *
 * QUATRO PEÇAS, E CADA UMA TEM O SEU MOMENTO — nenhuma substitui a outra:
 *
 * 1. `RecuperaTelaQuebrada` — aposentada, mas o arquivo continua aqui: o
 *    trabalho dela passou para o guardião do cabeçalho da página, que
 *    chega a tempo de ver a falha acontecer (lib/guardiaoDaTela.ts).
 * 2. `SaudacaoDiaria` — uma vez por dia, no primeiro acesso, no meio da
 *    tela. É a conversa com calma.
 * 3. `AvisoDeAtualizacao` — quando saiu versão nova. Pastilha discreta.
 * 4. `RecadoDaLumi` — quando acontece algo com a pessoa (nota, aula,
 *    atividade, prazo, pedido). Discreto também, e no mesmo canto.
 *
 * A 3 e a 4 dividem o canto inferior direito, empilhadas por `CantoDaLumi`
 * — sem ele, uma cobria a outra.
 *
 * A versão publicada é lida AQUI, no servidor, e desce para o aviso como
 * propriedade. É isso que permite comparar "o que esta página carregou"
 * com "o que está no ar" — se fosse lida no navegador, seria sempre a
 * versão atual e a comparação nunca acusaria nada.
 */
export default function Lumi() {
  const versaoDaPagina = (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    'desenvolvimento'
  ).slice(0, 12)

  return (
    <>
      <RecuperaTelaQuebrada />
      <SaudacaoDiaria />
      <CantoDaLumi>
        <AvisoDeAtualizacao versaoDaPagina={versaoDaPagina} />
        <RecadoDaLumi />
      </CantoDaLumi>
    </>
  )
}
