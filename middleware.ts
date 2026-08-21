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
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

    if (!user) return desviarPara(paraLogin())

    const role = (user.app_metadata?.role as string | undefined) ?? undefined
    const home = role ? HOME_POR_PAPEL[role] : undefined

    if (!home) return desviarPara(paraLogin())

    const regra = PAPEIS_PERMITIDOS.find((r) => path.startsWith(r.prefixo))

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
