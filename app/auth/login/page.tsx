import LoginForm from '@/components/Auth/LoginForm'
import MolduraDeEntrada from '@/components/Auth/MolduraDeEntrada'

export const metadata = {
  title: 'Entrar — Escola de Líderes IBAU',
}

/* O desenho desta tela (o lado escuro da marca, os anéis, o capelo, o
   rodapé) foi para `components/Auth/MolduraDeEntrada.tsx` sem uma linha
   de estilo alterada — as telas de recuperação de senha usam a MESMA
   moldura, em vez de uma cópia que um dia divergiria desta. */
export default function LoginPage() {
  return (
    <MolduraDeEntrada
      titulo="Bem-vindo de volta"
      subtitulo="Escolha seu portal e entre para continuar seus estudos."
      tituloCelular="Acesse sua conta"
      subtituloCelular="Escolha seu portal para entrar."
    >
      <LoginForm />
    </MolduraDeEntrada>
  )
}
