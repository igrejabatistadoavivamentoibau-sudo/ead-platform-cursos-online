import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  resolverPermissoes,
  type ChavePermissao,
  type Permissoes,
  type UserRole,
} from '@/lib/permissoes'

export interface SessaoAtual {
  id: string
  email: string
  name: string
  role: UserRole
  permissoes: Permissoes
}

/* ============================================================
   POR QUE ESTA FUNÇÃO FOI REESCRITA: ELA ERA O PEDÁGIO DE TODA TELA

   Ela é chamada pelo LAYOUT do portal e de novo pela PÁGINA. Cada chamada
   custava duas idas ao servidor, uma depois da outra:

     1. `getUser()` — que NÃO é leitura local: é uma requisição ao servidor
        de autenticação do Supabase, feita toda vez;
     2. a consulta do perfil, que só começava depois que a primeira voltava.

   Layout + página = QUATRO idas em fila, antes de a tela pedir o primeiro
   dado de verdade. Somando o middleware, eram cinco. Numa conexão de
   celular, meio segundo se vai só nisso — em toda troca de tela, sempre.

   Duas mudanças, e nenhuma delas afrouxa a conferência:

   `cache()` (do React) faz a função rodar UMA VEZ por requisição. Layout e
   página passam a dividir o mesmo resultado em vez de repetirem o trabalho.
   Isso corta metade do custo sem mudar uma linha das telas.

   E as duas idas restantes passam a ser SIMULTÂNEAS. O identificador da
   pessoa já está no cookie, então dá para começar a buscar o perfil no
   mesmo instante em que se pede a conferência — e só usar o perfil depois
   que a conferência confirmar que é a mesma pessoa. Se não bater (cookie
   adulterado, sessão trocada no meio), o perfil buscado é descartado e a
   busca é refeita com o identificador conferido. A resposta continua sendo
   sempre a da pessoa que o servidor de autenticação confirmou.
   ============================================================ */

type PerfilBruto = {
  name: string
  email: string
  role: string
  ativo: boolean | null
  permissoes: Partial<Permissoes> | null
} | null

export const obterSessao = cache(async function obterSessao(): Promise<SessaoAtual | null> {
  const supabase = await createClient()

  const buscarPerfil = async (id: string): Promise<PerfilBruto> => {
    const { data } = await supabase
      .from('users')
      .select('name, email, role, ativo, permissoes')
      .eq('id', id)
      .single()
    return (data as PerfilBruto) ?? null
  }

  /* Leitura do cookie, sem rede. Serve só para ADIANTAR a busca do perfil;
     nada é decidido a partir daqui. */
  const { data: local } = await supabase.auth.getSession()
  const idProvavel = local.session?.user?.id ?? null

  const [{ data: conferido }, perfilAdiantado] = await Promise.all([
    supabase.auth.getUser(),
    idProvavel ? buscarPerfil(idProvavel) : Promise.resolve(null),
  ])

  const user = conferido.user
  if (!user) return null

  const perfil =
    idProvavel === user.id && perfilAdiantado ? perfilAdiantado : await buscarPerfil(user.id)

  if (!perfil) return null

  /* DESATIVADO NÃO ENTRA — nem quem já estava dentro.
     Suspender a conta no serviço de autenticação impede logins NOVOS, mas
     quem estava com a plataforma aberta continuaria navegando até o token
     vencer (até uma hora). Aqui a sessão morre na requisição seguinte:
     `exigirSessao` devolve a pessoa para o login. */
  if (perfil.ativo === false) return null

  const role = perfil.role as UserRole

  return {
    id: user.id,
    email: perfil.email,
    name: perfil.name,
    role,
    permissoes: resolverPermissoes(role, perfil.permissoes),
  }
})

/** Exige uma sessão válida; caso contrário manda para o login. */
export async function exigirSessao(): Promise<SessaoAtual> {
  const sessao = await obterSessao()
  if (!sessao) redirect('/auth/login')
  return sessao
}

const HOME_POR_PAPEL: Record<UserRole, string> = {
  admin: '/dashboard/admin',
  professor: '/dashboard/professor',
  aluno: '/dashboard/aluno',
}

/** Exige uma permissão específica; caso contrário manda para a home do papel. */
export async function exigirPermissao(chave: ChavePermissao): Promise<SessaoAtual> {
  const sessao = await exigirSessao()
  if (!sessao.permissoes[chave]) {
    redirect(HOME_POR_PAPEL[sessao.role])
  }
  return sessao
}
