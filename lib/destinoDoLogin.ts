import type { UserRole } from '@/lib/permissoes'

/* ============================================================
   PARA ONDE A PESSOA VAI DEPOIS DE ENTRAR

   Antes: sempre a porta do portal. Quem estava numa aula específica e
   precisou entrar de novo — sessão vencida, F5, aba nova — perdia o lugar
   e refazia todo o caminho a pé.

   Agora o middleware guarda o destino em `?proximo=` e o login devolve a
   pessoa nele.

   POR QUE ISTO É UM ARQUIVO, E NÃO UMA FUNÇÃO DENTRO DO FORMULÁRIO
   Porque é uma regra de segurança, e regra de segurança precisa poder ser
   lida e testada sozinha. Enterrada no meio de um componente de tela, ela
   seria conferida "de olho" — que é exatamente como esse tipo de falha
   passa.

   A CONFERÊNCIA NÃO É PARANOIA
   `?proximo=` chega pela barra de endereço: qualquer um escreve o que
   quiser ali. Sem filtro, um link montado por fora ("entre aqui",
   apontando para `?proximo=//site-falso`) levaria a pessoa para outro
   site logo depois de ela digitar a senha — e ela juraria que continua
   na página da igreja. É o golpe clássico de redirecionamento aberto.

   Três barreiras, nesta ordem:
     1. tem que começar com UMA barra — e não duas: `//site-falso` é um
        endereço externo disfarçado de caminho;
     2. tem que ser do painel (`/dashboard`);
     3. tem que ser uma área que ESTE papel pode abrir — senão a pessoa
        entraria e seria desviada no instante seguinte, o que é pior do
        que ter ido direto para a porta.
   ============================================================ */

export const PORTA_DO_PORTAL: Record<UserRole, string> = {
  aluno: '/dashboard/aluno',
  professor: '/dashboard/professor',
  admin: '/dashboard/admin',
}

/** As áreas que cada papel pode abrir. Espelha o middleware. */
const AREAS_POR_PAPEL: Record<UserRole, string[]> = {
  aluno: ['/dashboard/aluno', '/dashboard/biblia', '/dashboard/caderno'],
  professor: ['/dashboard/professor', '/dashboard/biblia', '/dashboard/caderno'],
  admin: [
    '/dashboard/admin',
    '/dashboard/professor',
    '/dashboard/biblia',
    '/dashboard/caderno',
  ],
}

export function destinoDoLogin(proximo: string | null | undefined, papel: UserRole): string {
  const padrao = PORTA_DO_PORTAL[papel]
  if (!proximo) return padrao
  if (!proximo.startsWith('/') || proximo.startsWith('//')) return padrao
  if (!proximo.startsWith('/dashboard')) return padrao
  return AREAS_POR_PAPEL[papel].some((a) => proximo.startsWith(a)) ? proximo : padrao
}
