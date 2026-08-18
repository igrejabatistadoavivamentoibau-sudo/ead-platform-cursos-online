import { exigirSessao } from '@/lib/auth'

/**
 * A moldura da SEGUNDA JANELA — que é justamente não ter moldura.
 *
 * Quando o aluno abre o caderno numa janela à parte, para escrever com o
 * vídeo na outra tela, a barra lateral e a barra de cima só atrapalham:
 * numa janela estreita, cada pedaço gasto com menu é uma linha a menos de
 * anotação. E ele não veio navegar — veio escrever.
 *
 * A sessão continua sendo exigida aqui: janela sem moldura não pode virar
 * janela sem porta.
 */
export default async function JanelaLayout({ children }: { children: React.ReactNode }) {
  await exigirSessao()
  return <div className="min-h-screen bg-gray-50">{children}</div>
}
