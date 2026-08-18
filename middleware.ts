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

  // Valida a sessão com o Supabase. Antes fazíamos isto E MAIS uma consulta
  // ao banco só para descobrir o papel da pessoa — duas idas e voltas em
  // toda navegação. Agora o papel vem dentro do próprio token (app_metadata),
  // sincronizado por gatilho no banco, então sobra apenas esta chamada.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (path.startsWith('/dashboard')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    const role = (user.app_metadata?.role as string | undefined) ?? undefined
    const home = role ? HOME_POR_PAPEL[role] : undefined

    if (!home) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    const regra = PAPEIS_PERMITIDOS.find((r) => path.startsWith(r.prefixo))

    // Área desconhecida ou área que este papel não pode acessar →
    // manda para a casa dele.
    if (!regra || !regra.papeis.includes(role!)) {
      const url = request.nextUrl.clone()
      url.pathname = home
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
