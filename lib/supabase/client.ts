import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Client único (singleton) para uso no navegador. Evita o aviso "Multiple
// GoTrueClient instances detected" e possível dessincronia de sessão quando
// vários componentes chamam createClient() ao mesmo tempo.
let browserClient: SupabaseClient | undefined

export function createClient() {
  if (!browserClient) {
    browserClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}
