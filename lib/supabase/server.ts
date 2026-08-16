import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente Supabase "com sessão" para uso em Server Components, Route
 * Handlers e Server Actions — lê a sessão do usuário logado a partir dos
 * cookies (sincronizados pelo cliente do navegador + middleware).
 *
 * Respeita as políticas de RLS normalmente (não usa a service role key).
 * Para operações administrativas privilegiadas (criar usuário, trocar
 * senha de terceiros, etc.), use lib/supabase/admin.ts.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Mesma armadilha do cliente administrativo: sem `no-store`, o Next
      // guarda a resposta do banco e a tela passa a mostrar dados velhos.
      // Ver a explicação completa em lib/supabase/admin.ts.
      global: {
        fetch: (url: RequestInfo | URL, options?: RequestInit) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Chamado a partir de um Server Component (não pode escrever
            // cookies). O middleware já cuida de renovar a sessão nesses
            // casos, então é seguro ignorar aqui.
          }
        },
      },
    }
  )
}
