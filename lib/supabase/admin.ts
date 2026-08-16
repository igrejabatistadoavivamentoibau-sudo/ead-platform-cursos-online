import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com a service role key — ignora completamente as
 * políticas de RLS. Só deve ser usado em código que roda exclusivamente
 * no servidor (Server Actions / Route Handlers / Server Components), e
 * SEMPRE depois de confirmar por sessão que quem chama tem direito.
 *
 * Nunca importar este arquivo em um Client Component.
 *
 * POR QUE O `cache: 'no-store'` ABAIXO É OBRIGATÓRIO
 *
 * O Supabase conversa com o banco por `fetch`. Dentro do Next, `fetch` em
 * componente de servidor é GUARDADO EM CACHE por padrão — o Next assume
 * que a mesma URL devolve a mesma coisa e reaproveita a primeira resposta
 * indefinidamente.
 *
 * O efeito era este: a ficha pública foi renderizada uma vez quando ainda
 * não havia perguntas cadastradas. A resposta vazia ficou guardada, e toda
 * pergunta criada depois continuava invisível — mesmo com os dados certos
 * no banco e o código certo no ar. Um caso perfeito de "não é bug do
 * código, é bug do cache", que só aparece em produção.
 *
 * Marcando as chamadas como `no-store`, toda leitura vai ao banco de fato.
 * É o comportamento que qualquer pessoa espera de um painel administrativo.
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
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}
