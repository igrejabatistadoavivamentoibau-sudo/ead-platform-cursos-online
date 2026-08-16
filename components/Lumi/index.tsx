import AvisoDeAtualizacao from './AvisoDeAtualizacao'
import SaudacaoDiaria from './SaudacaoDiaria'

/** A LUMI inteira, para os layouts montarem com uma linha só. */
export default function Lumi() {
  return (
    <>
      <SaudacaoDiaria />
      <AvisoDeAtualizacao />
    </>
  )
}
