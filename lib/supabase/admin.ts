import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com a service role key — ignora completamente as
 * políticas de RLS. Só deve ser usado em código que roda exclusivamente
 * no servidor (Server Actions / Route Handlers), e SEMPRE depois de
 * confirmar por sessão (lib/supabase/server.ts) que quem está chamando é
 * de fato um administrador.
 *
 * Nunca importar este arquivo em um Client Component.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
