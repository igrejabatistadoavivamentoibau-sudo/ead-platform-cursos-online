import MolduraDeEntrada from '@/components/Auth/MolduraDeEntrada'
import PedirRecuperacao from '@/components/Auth/PedirRecuperacao'

export const metadata = {
  title: 'Esqueci minha senha — Escola de Líderes IBAU',
}

export default function EsqueciSenhaPage() {
  return (
    <MolduraDeEntrada
      titulo="Esqueceu sua senha?"
      subtitulo="Sem problema. Digite seu e-mail e enviamos um link para você criar uma nova."
      tituloCelular="Esqueceu sua senha?"
      subtituloCelular="Digite seu e-mail e enviamos um link para criar uma nova."
      voltar={{ href: '/auth/login', label: 'Voltar para entrar' }}
    >
      <PedirRecuperacao />
    </MolduraDeEntrada>
  )
}
