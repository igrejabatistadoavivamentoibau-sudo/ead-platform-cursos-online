import AvisoDeAtualizacao from './AvisoDeAtualizacao'
import SaudacaoDiaria from './SaudacaoDiaria'
import RecuperaTelaQuebrada from './RecuperaTelaQuebrada'

/**
 * A LUMI inteira.
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
      <AvisoDeAtualizacao versaoDaPagina={versaoDaPagina} />
    </>
  )
}
