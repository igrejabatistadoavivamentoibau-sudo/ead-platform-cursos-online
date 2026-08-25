import MolduraDeEntrada from '@/components/Auth/MolduraDeEntrada'
import DefinirNovaSenha from '@/components/Auth/DefinirNovaSenha'

export const metadata = {
  title: 'Criar nova senha — Escola de Líderes IBAU',
  /* Uma tela que se abre com a chave do e-mail não tem por que aparecer em
     busca nenhuma. */
  robots: { index: false, follow: false },
}

/* Esta tela é sempre desenhada na hora: o que ela mostra depende do link
   que a pessoa acabou de abrir, e uma versão guardada de "link inválido"
   apareceria para quem chegou com um link perfeitamente bom. */
export const dynamic = 'force-dynamic'

export default function NovaSenhaPage() {
  return (
    <MolduraDeEntrada
      titulo="Crie sua nova senha"
      subtitulo="Escolha uma senha que você lembre e ninguém adivinhe."
      tituloCelular="Crie sua nova senha"
      subtituloCelular="Escolha uma senha que você lembre e ninguém adivinhe."
      voltar={{ href: '/auth/login', label: 'Voltar para entrar' }}
    >
      <DefinirNovaSenha />
    </MolduraDeEntrada>
  )
}
