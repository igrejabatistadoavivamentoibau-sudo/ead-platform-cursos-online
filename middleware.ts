import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const HOME_POR_PAPEL: Record<string, string> = {
  admin: '/dashboard/admin',
  professor: '/dashboard/professor',
  aluno: '/dashboard/aluno',
}

/** Quem pode entrar em cada área. Admin também entra na área de professor. */
const PAPEIS_PERMITIDOS: { prefixo: string; papeis: string[] }[] = [
  { prefixo: '/dashboard/admin', papeis: ['admin'] },
  { prefixo: '/dashboard/professor', papeis: ['professor', 'admin'] },
  { prefixo: '/dashboard/aluno', papeis: ['aluno'] },
  // A Bíblia é da casa inteira: aluno, professor e liderança leem a mesma,
  // e cada um guarda os próprios grifos. Por isso ela mora fora dos portais,
  // em vez de existir uma cópia em cada um deles.
  { prefixo: '/dashboard/biblia', papeis: ['aluno', 'professor', 'admin'] },
  // O caderno segue a mesma lógica da Bíblia: é de quem estuda, e todo
  // mundo estuda.
  { prefixo: '/dashboard/caderno', papeis: ['aluno', 'professor', 'admin'] },
]

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  /* ============================================================
     O DEFEITO QUE FAZIA A PESSOA VOLTAR PARA O COMEÇO

     A chamada abaixo faz duas coisas: confere quem está logado E, quando
     o token está perto de vencer, RENOVA a sessão. A renovação chega aqui
     pelo `setAll` acima, que monta uma `response` nova carregando os
     cookies novos.

     O problema estava logo adiante: cada desvio criava um
     `NextResponse.redirect(...)` do zero e devolvia esse — jogando fora a
     `response` com os cookies renovados. O navegador continuava com o
     token velho, a requisição seguinte falhava de novo, e a pessoa era
     mandada para o login. Ela entrava, caía na porta do portal, e tinha
     que refazer a pé todo o caminho até onde estava.

     Silencioso, e por isso difícil de perceber: não dava erro nenhum.
     Parecia "a plataforma me desconectou do nada".

     `desviarPara` é a correção: todo desvio copia os cookies que a
     `response` acumulou antes de sair daqui.
     ============================================================ */

  /* ============================================================
     O PEDÁGIO QUE ESTAVA EM TODA REQUISIÇÃO

     `getUser()` não é leitura local: é uma requisição ao servidor de
     autenticação, feita ANTES de qualquer coisa aparecer na tela. E o
     middleware roda em tudo — na página, no pedido de dados de cada
     navegação, e também nos pedidos de PREPARO que o navegador dispara
     sozinho quando um link entra na tela. Aquela ida à rede acontecia
     dezenas de vezes numa sessão de uso normal, sempre na frente da
     pessoa.

     Agora a leitura vem do cookie, sem rede. Só se recorre à rede quando
     ela é mesmo necessária: sem sessão guardada, ou com o token perto de
     vencer — que é justamente quando `getUser()` também RENOVA a sessão.
     Essa renovação continua acontecendo como antes; é o conserto do "F5 me
     joga para o começo", e ele não foi mexido.

     ISTO NÃO AFROUXA NADA, e vale dizer por quê. O middleware nunca foi a
     tranca: ele decide para qual tela mandar a pessoa. Quem confere de
     verdade é o layout de cada portal, que chama `exigirSessao()` — uma
     conferência real, no servidor de autenticação — e, embaixo dele, as
     regras do próprio banco, que decidem linha por linha o que cada pessoa
     pode ler. Um cookie forjado passaria por aqui e esbarraria nas duas
     camadas seguintes, sem ver dado de ninguém.
     ============================================================ */
  const MARGEM_DE_RENOVACAO = 120 // segundos

  const { data: guardada } = await supabase.auth.getSession()
  const expiraEm = guardada.session?.expires_at ?? 0
  const aindaVale = expiraEm - Math.floor(Date.now() / 1000) > MARGEM_DE_RENOVACAO

  const veioDoCookie = !!(guardada.session?.user && aindaVale)
  let user = veioDoCookie
    ? guardada.session!.user
    : (await supabase.auth.getUser()).data.user

  /**
   * Reconfere no servidor antes de NEGAR alguma coisa.
   *
   * O papel guardado no cookie envelhece: se a coordenação promove alguém
   * de aluno a professor, o cookie dele continua dizendo "aluno" até a
   * sessão ser renovada — até uma hora depois. Deixar isso passar seria
   * trocar lentidão por um defeito pior: o professor recém-promovido
   * batendo na porta da própria área e sendo mandado de volta, sem
   * entender por quê.
   *
   * Então o atalho do cookie só vale para DEIXAR PASSAR. Toda vez que a
   * conta daria em desvio, perguntamos ao servidor antes — e aí sim
   * decidimos. A ida à rede volta a acontecer, mas só no caso raro.
   */
  const reconferir = async () => {
    if (!veioDoCookie) return false
    const { data } = await supabase.auth.getUser()
    user = data.user
    return true
  }

  const desviarPara = (url: URL) => {
    const desvio = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) desvio.cookies.set(cookie)
    return desvio
  }

  const path = request.nextUrl.pathname

  if (path.startsWith('/dashboard')) {
    /* PARA ONDE A PESSOA ESTAVA INDO.
       Sem isto, o login despejava todo mundo na porta do portal. Quem
       estava numa aula específica e precisou entrar de novo perdia o
       lugar. Guardamos o destino e o login devolve a pessoa nele.

       Só o caminho interno, nunca um endereço completo: um destino vindo
       de fora poderia ser usado para levar alguém para outro site logo
       depois de entrar. */
    const paraLogin = () => {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.search = ''
      url.searchParams.set('proximo', path + (request.nextUrl.search || ''))
      return url
    }

    const papelDe = () => (user?.app_metadata?.role as string | undefined) ?? undefined
    const regra = PAPEIS_PERMITIDOS.find((r) => path.startsWith(r.prefixo))
    const podeEntrar = () => {
      const p = papelDe()
      return !!p && !!HOME_POR_PAPEL[p] && !!regra && regra.papeis.includes(p)
    }

    // Antes de negar qualquer coisa, confere no servidor — o papel do
    // cookie pode estar velho. Ver `reconferir` acima.
    if (!podeEntrar()) await reconferir()

    if (!user) return desviarPara(paraLogin())

    const role = papelDe()
    const home = role ? HOME_POR_PAPEL[role] : undefined

    if (!home) return desviarPara(paraLogin())

    // Área desconhecida ou área que este papel não pode acessar → manda
    // para a casa dele. Aqui NÃO guardamos o destino: seria devolver a
    // pessoa exatamente ao lugar onde ela não pode entrar.
    if (!regra || !regra.papeis.includes(role!)) {
      const url = request.nextUrl.clone()
      url.pathname = home
      url.search = ''
      return desviarPara(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
