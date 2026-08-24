import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { resolverPermissoes, type Permissoes, type UserRole } from '@/lib/permissoes'

/* ============================================================
   QUEM ESTÁ CHAMANDO — UMA IDENTIDADE, DUAS PORTAS

   Este é o arquivo que torna um aplicativo nativo possível sem reescrever
   nada. Ele responde a uma pergunta só, e a resposta é igual venha de onde
   vier:

     navegador  → a sessão chega em COOKIE     (lib/auth.ts, obterSessao)
     iOS/Android → a sessão chega em CABEÇALHO  (Authorization: Bearer ...)

   As duas devolvem o MESMO objeto. Daí para dentro, nenhuma regra de
   negócio sabe — nem precisa saber — por onde a pessoa entrou.

   POR QUE ISTO FUNCIONA SEM TRUQUE
   O aplicativo nativo não vai ter um login próprio. Ele entra no MESMO
   Supabase Auth, com as bibliotecas oficiais (supabase-swift no iOS,
   supabase-kt no Android), e recebe o MESMO JWT que o navegador recebe.
   Aqui esse token é conferido contra o servidor de autenticação — não
   decodificado por conta própria. Token só é identidade depois que quem
   o emitiu confirma que ele vale.

   E AS PERMISSÕES SÃO AS MESMAS
   Papel e permissões saem da tabela `users`, exatamente como no site. Não
   existe "permissão do app": existe a permissão da pessoa.
   ============================================================ */

export interface QuemChama {
  id: string
  email: string
  name: string
  role: UserRole
  permissoes: Permissoes
}

/**
 * Resolve a identidade a partir de um token de acesso do Supabase.
 *
 * Devolve `null` para token ausente, expirado, forjado — ou de alguém que
 * foi DESATIVADO. Esse último caso é o que costuma escapar: o token
 * continua criptograficamente válido por até uma hora depois de a conta ser
 * desligada, e sem esta conferência a pessoa desligada seguiria usando o
 * aplicativo durante esse tempo.
 */
export async function quemChamaPorToken(token: string | null): Promise<QuemChama | null> {
  const limpo = (token ?? '').trim()
  if (!limpo) return null

  /* Um cliente por chamada, carimbado com o token de quem está pedindo.
     Ele NÃO usa a chave administrativa: a leitura do perfil passa pelo RLS
     como a de qualquer pessoa logada. Se um dia alguém apontar esta função
     para o cliente administrativo, o RLS deixa de valer aqui — e é assim
     que uma API "só de leitura" começa a devolver dado dos outros. */
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${limpo}` },
        fetch: (url: RequestInfo | URL, options?: RequestInit) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser(limpo)
  if (!user) return null

  const { data: perfil } = await supabase
    .from('users')
    .select('name, email, role, ativo, permissoes')
    .eq('id', user.id)
    .single()

  if (!perfil) return null
  if (perfil.ativo === false) return null

  const role = (perfil.role as UserRole) ?? 'aluno'
  return {
    id: user.id,
    email: (perfil.email as string) ?? user.email ?? '',
    name: (perfil.name as string) ?? '',
    role,
    permissoes: resolverPermissoes(role, perfil.permissoes as Partial<Permissoes> | null),
  }
}

/** Lê o token do cabeçalho `Authorization: Bearer <token>`. */
export function tokenDoCabecalho(req: Request): string | null {
  const bruto = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? ''
  const [esquema, valor] = bruto.split(' ')
  if (!valor || esquema.toLowerCase() !== 'bearer') return null
  return valor
}
