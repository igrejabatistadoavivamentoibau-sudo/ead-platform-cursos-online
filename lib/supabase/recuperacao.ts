import { createClient as criarCliente } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let cliente: SupabaseClient | undefined

/* ============================================================
   O CLIENTE QUE SÓ PEDE O E-MAIL DE RECUPERAÇÃO

   Isto NÃO substitui nem altera o cliente de sempre
   (`lib/supabase/client.ts`). O login, a sessão, o Google, tudo continua
   exatamente como está. Este aqui existe para um único pedido — "mande o
   e-mail de troca de senha" — e some depois.

   POR QUE ELE PRECISA SER OUTRO

   O cliente da plataforma usa o fluxo PKCE. É o mais seguro para login, e
   funciona assim: ao pedir o e-mail, o navegador guarda um SEGREDO
   LOCAL e manda ao provedor só o resumo dele. Quando a pessoa volta pelo
   link, o navegador precisa daquele segredo para concluir.

   Isso quebra o caso mais comum da vida real: a pessoa pede a recuperação
   no computador e abre o e-mail no celular. Ou pede no navegador e o link
   abre dentro do aplicativo do Gmail, que é outro navegador. O segredo
   ficou no primeiro; o segundo não tem como concluir, e — pior — o cliente
   nem tenta: a tela simplesmente diz que o link não vale, e a pessoa pede
   outro, e outro, sempre com o mesmo resultado. Numa escola isso vira
   ligação para a secretaria.

   Para RECUPERAÇÃO DE SENHA, então, usamos o fluxo clássico: o provedor
   devolve a chave de entrada direto no endereço, e qualquer navegador
   consegue concluir. É o mecanismo oficial do Supabase, o mesmo
   `resetPasswordForEmail`; muda só por onde a resposta volta.

   E o que se perde em troca é pequeno e está coberto: a chave viaja depois
   do "#", que o navegador **nunca envia ao servidor**; ela vale poucos
   minutos; serve uma vez só; e o porteiro (`lib/porteiroDoLink.ts`) a tira
   da barra de endereço no primeiro instante.

   `persistSession: false` é o detalhe que mantém os dois mundos
   separados: este cliente não escreve sessão nenhuma. Quem escreve é o
   cliente de sempre, depois, com a chave que o link trouxe. E a chave de
   armazenamento é própria — sem isso o navegador acusaria dois clientes
   disputando o mesmo lugar.
   ============================================================ */
export function clienteDeRecuperacao() {
  if (!cliente) {
    cliente = criarCliente(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'implicit',
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: 'ibau-recuperacao',
        },
      }
    )
  }
  return cliente
}
