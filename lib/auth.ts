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

/**
 * Carrega a pessoa logada com papel e permissões já resolvidos.
 *
 * O papel vem do token (sem consulta), mas nome e permissões vêm do banco —
 * permissões precisam ser lidas do banco mesmo, senão uma mudança feita pelo
 * admin só valeria quando o token fosse renovado (até 1 hora depois).
 * É uma única consulta, e as funções agora rodam em São Paulo, ao lado do
 * banco, então o custo é de poucos milissegundos.
 */
export async function obterSessao(): Promise<SessaoAtual | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: perfil } = await supabase
    .from('users')
    .select('name, email, role, permissoes')
    .eq('id', user.id)
    .single()

  if (!perfil) return null

  const role = perfil.role as UserRole

  return {
    id: user.id,
    email: perfil.email as string,
    name: perfil.name as string,
    role,
    permissoes: resolverPermissoes(role, perfil.permissoes),
  }
}

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
