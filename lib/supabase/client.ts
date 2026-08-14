import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined

/**
 * Cliente Supabase para uso no navegador. Usa createBrowserClient do
 * @supabase/ssr para que a sessão seja sincronizada em cookies (e não só
 * em localStorage) — assim o servidor (Server Components, middleware,
 * Server Actions) também consegue saber quem está logado.
 *
 * Mantido como singleton para evitar o aviso "Multiple GoTrueClient
 * instances detected".
 */
export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}
