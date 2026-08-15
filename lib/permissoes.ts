export type UserRole = 'aluno' | 'professor' | 'admin'

/**
 * Cada chave é uma capacidade concreta dentro da plataforma. O admin pode
 * ligar/desligar qualquer uma delas por pessoa, no painel de permissões.
 */
export const CHAVES_PERMISSAO = [
  'gerenciar_turmas',
  'fazer_chamada',
  'gerenciar_aulas',
  'ver_alunos',
  'gerenciar_usuarios',
  'gerenciar_fotos',
] as const

export type ChavePermissao = (typeof CHAVES_PERMISSAO)[number]

export type Permissoes = Record<ChavePermissao, boolean>

export const ROTULO_PERMISSAO: Record<ChavePermissao, { titulo: string; descricao: string }> = {
  gerenciar_turmas: {
    titulo: 'Gerenciar turmas',
    descricao: 'Criar turmas, iniciar, encerrar e matricular alunos.',
  },
  fazer_chamada: {
    titulo: 'Fazer chamada',
    descricao: 'Criar encontros e registrar a presença dos alunos.',
  },
  gerenciar_aulas: {
    titulo: 'Gerenciar vídeo aulas',
    descricao: 'Adicionar, editar e publicar as vídeo aulas das turmas.',
  },
  ver_alunos: {
    titulo: 'Ver lista de alunos',
    descricao: 'Consultar quem está matriculado e o progresso de cada um.',
  },
  gerenciar_usuarios: {
    titulo: 'Gerenciar usuários',
    descricao: 'Criar contas, trocar senhas e definir papéis. Área sensível.',
  },
  gerenciar_fotos: {
    titulo: 'Gerenciar fotos da capa',
    descricao: 'Trocar as fotos que aparecem na página inicial.',
  },
}

/** O que cada papel recebe quando o admin não personalizou nada. */
const PADRAO_POR_PAPEL: Record<UserRole, Permissoes> = {
  admin: {
    gerenciar_turmas: true,
    fazer_chamada: true,
    gerenciar_aulas: true,
    ver_alunos: true,
    gerenciar_usuarios: true,
    gerenciar_fotos: true,
  },
  professor: {
    gerenciar_turmas: false,
    fazer_chamada: true,
    gerenciar_aulas: true,
    ver_alunos: true,
    gerenciar_usuarios: false,
    gerenciar_fotos: false,
  },
  aluno: {
    gerenciar_turmas: false,
    fazer_chamada: false,
    gerenciar_aulas: false,
    ver_alunos: false,
    gerenciar_usuarios: false,
    gerenciar_fotos: false,
  },
}

export function permissoesPadrao(role: UserRole): Permissoes {
  return { ...PADRAO_POR_PAPEL[role] }
}

/**
 * Resolve as permissões efetivas: parte do padrão do papel e aplica por cima
 * o que o admin personalizou para aquela pessoa.
 *
 * Regra de segurança importante: um administrador NUNCA perde acesso por
 * personalização — senão seria possível travar a si mesmo para fora do
 * sistema e ninguém conseguiria destravar.
 */
export function resolverPermissoes(
  role: UserRole,
  personalizadas: Partial<Permissoes> | null | undefined
): Permissoes {
  if (role === 'admin') return permissoesPadrao('admin')

  const base = permissoesPadrao(role)
  if (!personalizadas) return base

  for (const chave of CHAVES_PERMISSAO) {
    const valor = personalizadas[chave]
    if (typeof valor === 'boolean') base[chave] = valor
  }
  return base
}
