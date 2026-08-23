-- ============================================================
-- A CHAVE DO ASAAS GUARDADA PELA PRÓPRIA PLATAFORMA
--
-- Até aqui, ligar a cobrança on-line exigia três variáveis de ambiente na
-- Vercel — ou seja, exigia que a chave passasse por mim, por mensagem, e
-- que alguém mexesse num painel de fora. Chave que anda por conversa é
-- chave que fica na conversa.
--
-- Agora a coordenação cola a chave na própria tela de Loja e pagamentos, e
-- a plataforma guarda. Três decisões sustentam isso:
--
-- 1. A CHAVE NÃO FICA EM TEXTO PURO. Vai para o cofre do Supabase (extensão
--    `supabase_vault`), que cifra com uma raiz que NÃO mora neste banco.
--    Um dump do banco, sozinho, não devolve a chave.
--
-- 2. A TABELA NÃO É LEGÍVEL POR NINGUÉM. RLS ligada e NENHUMA policy — o
--    que, no Postgres, significa "ninguém passa". Nem o admin logado. Só o
--    servidor, com a chave administrativa, que ignora RLS por natureza e
--    nunca chega ao navegador.
--
-- 3. AS FUNÇÕES QUE LEEM O COFRE SÓ EXISTEM PARA O SERVIDOR. São
--    SECURITY DEFINER (para poderem abrir o cofre) com o EXECUTE tirado de
--    PUBLIC e devolvido apenas ao `service_role`. Sem isso, qualquer pessoa
--    logada chamaria a função pela API e leria a chave — que é exatamente o
--    buraco que uma função SECURITY DEFINER mal fechada costuma abrir.
--
-- O que a tela mostra depois de ligar são só os últimos seis caracteres.
-- Suficiente para reconhecer qual chave está lá; inútil para quem copiar.
-- ============================================================

create table if not exists public.pagamento_config (
  id               boolean primary key default true,
  ambiente         text    not null default 'sandbox'
                   check (ambiente in ('sandbox', 'producao')),
  -- Ponteiros para o cofre. O segredo em si nunca mora nesta tabela.
  chave_id         uuid,
  webhook_token_id uuid,
  -- O que o Asaas devolveu quando a chave foi conferida.
  conta_nome       text,
  conta_email      text,
  -- Últimos caracteres da chave, para a tela dizer QUAL chave está ligada.
  chave_final      text,
  -- O aviso de pagamento registrado lá. Nulo = não deu para registrar
  -- sozinho, e a tela explica o que fazer.
  webhook_id       text,
  ligado_em        timestamptz,
  ligado_por       uuid references public.users(id) on delete set null,
  atualizado_em    timestamptz not null default now(),
  constraint pagamento_config_linha_unica check (id)
);

comment on table public.pagamento_config is
  'Linha única. Guarda PONTEIROS para o cofre, nunca o segredo. Inacessível por RLS: só o service_role.';

alter table public.pagamento_config enable row level security;
revoke all on public.pagamento_config from anon, authenticated;

-- ------------------------------------------------------------
-- SALVAR
--
-- Recebe a chave já CONFERIDA pelo servidor (ele chamou o Asaas antes e o
-- Asaas respondeu com o nome da conta). A conferência não acontece aqui
-- porque o banco não fala com a internet — e uma função que gravasse sem
-- conferir deixaria a tela dizer "ligado" com uma chave errada.
-- ------------------------------------------------------------
create or replace function public.pagamento_asaas_salvar(
  p_chave         text,
  p_ambiente      text,
  p_webhook_token text,
  p_conta_nome    text,
  p_conta_email   text,
  p_webhook_id    text,
  p_usuario       uuid
) returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_chave_velha uuid;
  v_token_velho uuid;
  v_chave_id    uuid;
  v_token_id    uuid;
  v_marca       text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
begin
  if coalesce(btrim(p_chave), '') = '' then
    raise exception 'A chave não pode ficar em branco.';
  end if;
  if p_ambiente not in ('sandbox', 'producao') then
    raise exception 'Ambiente inválido: use sandbox ou producao.';
  end if;

  select chave_id, webhook_token_id
    into v_chave_velha, v_token_velho
    from public.pagamento_config
   where id;

  /* Trocar a chave é APAGAR e criar de novo, e não sobrescrever. O cofre
     guarda histórico de versão de segredo; deixar a chave antiga viva ao
     lado da nova é manter uma credencial válida que ninguém mais controla. */
  v_chave_id := vault.create_secret(
    btrim(p_chave), 'asaas_api_key_' || v_marca, 'Chave da API do Asaas'
  );
  v_token_id := vault.create_secret(
    p_webhook_token, 'asaas_webhook_token_' || v_marca, 'Senha do aviso de pagamento do Asaas'
  );

  insert into public.pagamento_config (
    id, ambiente, chave_id, webhook_token_id, conta_nome, conta_email,
    chave_final, webhook_id, ligado_em, ligado_por, atualizado_em
  ) values (
    true, p_ambiente, v_chave_id, v_token_id, p_conta_nome, p_conta_email,
    right(btrim(p_chave), 6), p_webhook_id, now(), p_usuario, now()
  )
  on conflict (id) do update set
    ambiente         = excluded.ambiente,
    chave_id         = excluded.chave_id,
    webhook_token_id = excluded.webhook_token_id,
    conta_nome       = excluded.conta_nome,
    conta_email      = excluded.conta_email,
    chave_final      = excluded.chave_final,
    webhook_id       = excluded.webhook_id,
    ligado_em        = excluded.ligado_em,
    ligado_por       = excluded.ligado_por,
    atualizado_em    = now();

  delete from vault.secrets where id in (v_chave_velha, v_token_velho);
end $$;

-- ------------------------------------------------------------
-- LER (só o servidor, na hora de cobrar ou de conferir um aviso)
-- ------------------------------------------------------------
create or replace function public.pagamento_asaas_credenciais()
returns table (ambiente text, chave text, webhook_token text)
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
begin
  return query
  select c.ambiente,
         (select d.decrypted_secret from vault.decrypted_secrets d where d.id = c.chave_id),
         (select d.decrypted_secret from vault.decrypted_secrets d where d.id = c.webhook_token_id)
    from public.pagamento_config c
   where c.id;
end $$;

-- ------------------------------------------------------------
-- O ESTADO, PARA A TELA
--
-- Sem segredo nenhum: ambiente, nome da conta e os últimos seis caracteres.
-- É de propósito que exista uma função separada da que lê a chave — assim a
-- tela nunca precisa passar perto do valor de verdade.
-- ------------------------------------------------------------
create or replace function public.pagamento_asaas_estado()
returns table (
  ligado         boolean,
  ambiente       text,
  conta_nome     text,
  conta_email    text,
  chave_final    text,
  webhook_id     text,
  ligado_em      timestamptz,
  ligado_por_nome text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select c.chave_id is not null,
         c.ambiente,
         c.conta_nome,
         c.conta_email,
         c.chave_final,
         c.webhook_id,
         c.ligado_em,
         u.name
    from public.pagamento_config c
    left join public.users u on u.id = c.ligado_por
   where c.id;
$$;

-- ------------------------------------------------------------
-- DESLIGAR
-- ------------------------------------------------------------
create or replace function public.pagamento_asaas_desligar()
returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_chave uuid;
  v_token uuid;
begin
  select chave_id, webhook_token_id into v_chave, v_token
    from public.pagamento_config where id;

  update public.pagamento_config
     set chave_id = null, webhook_token_id = null, conta_nome = null,
         conta_email = null, chave_final = null, webhook_id = null,
         ligado_em = null, ligado_por = null, atualizado_em = now()
   where id;

  delete from vault.secrets where id in (v_chave, v_token);
end $$;

-- ------------------------------------------------------------
-- QUEM PODE CHAMAR
--
-- Esta é a parte que faz o resto valer. Uma função SECURITY DEFINER que
-- abre o cofre e continua executável pelos papéis do navegador é uma porta
-- destrancada com um aviso de "não entre".
--
-- REVOGAR DE `public` NÃO BASTA — e isso quase passou.
-- O Supabase tem DEFAULT PRIVILEGES que dão EXECUTE em toda função nova do
-- esquema `public` DIRETAMENTE para `anon` e `authenticated`. Privilégio
-- dado direto a um papel não some quando se revoga de PUBLIC: são
-- concessões separadas, e a específica sobrevive.
--
-- Na primeira versão desta migração eu revoguei só de `public`. O teste de
-- impersonação mostrou o estrago: qualquer pessoa logada — inclusive aluno
-- — chamava `pagamento_asaas_credenciais()` pela API e recebia a chave do
-- Asaas em texto puro, e podia até sobrescrevê-la. Nenhuma leitura de
-- código teria mostrado isso; a função "parecia" fechada.
-- ------------------------------------------------------------
revoke execute on function public.pagamento_asaas_salvar(text, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.pagamento_asaas_credenciais() from public, anon, authenticated;
revoke execute on function public.pagamento_asaas_estado() from public, anon, authenticated;
revoke execute on function public.pagamento_asaas_desligar() from public, anon, authenticated;

grant execute on function public.pagamento_asaas_salvar(text, text, text, text, text, text, uuid) to service_role;
grant execute on function public.pagamento_asaas_credenciais() to service_role;
grant execute on function public.pagamento_asaas_estado() to service_role;
grant execute on function public.pagamento_asaas_desligar() to service_role;
