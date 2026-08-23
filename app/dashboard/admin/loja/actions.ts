'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { centavosDoTexto } from '@/lib/precos'
import { conferirChave, registrarAviso, type Ambiente } from '@/lib/pagamentos/asaas'

/* ============================================================
   A LOJA, DO LADO DE QUEM ADMINISTRA

   Tudo aqui devolve o resultado em vez de lançar erro. O motivo está
   explicado em `app/dashboard/admin/actions.ts`: mensagem lançada por ação
   de servidor é apagada pelo Next na versão publicada, e a pessoa recebe
   um parágrafo em inglês no lugar da frase em português.
   ============================================================ */

export type Resultado<T = unknown> =
  | ({ ok: true } & (T extends object ? T : object))
  | { ok: false; erro: string }

async function exigirAdmin(): Promise<{ id: string } | null> {
  const session = await createSessionClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return null

  const { data } = await session.from('users').select('role').eq('id', user.id).single()
  return data?.role === 'admin' ? { id: user.id } : null
}

const SEM_PERMISSAO = { ok: false as const, erro: 'Apenas administradores podem fazer isso.' }

export interface DadosDoProduto {
  nome: string
  descricao?: string
  categoria: 'livro' | 'apostila' | 'vestuario' | 'outro'
  /** Como a pessoa digitou: "49,90", "R$ 49,90" ou "49.90". */
  preco: string
  /** Vazio = sem controle de estoque. */
  estoque?: string
  ativo?: boolean
  politica_id?: string | null
}

/**
 * Converte o que foi digitado em números conferidos.
 *
 * O preço chega como TEXTO porque é assim que a pessoa digita. Transformar
 * em centavos é a primeira coisa que acontece, e daqui para dentro da
 * plataforma o valor nunca mais é decimal.
 */
type ProdutoConferido =
  | { erro: string; valores?: undefined }
  | { erro?: undefined; valores: Record<string, unknown> }

function conferirProduto(d: DadosDoProduto): ProdutoConferido {
  const nome = (d.nome ?? '').trim()
  if (!nome) return { erro: 'Dê um nome ao produto.' as const }

  const preco = centavosDoTexto(d.preco ?? '')
  if (preco === null) return { erro: 'Informe o preço, por exemplo 49,90.' as const }
  if (preco <= 0) return { erro: 'O preço precisa ser maior que zero.' as const }
  if (preco > 100_000_00) {
    return { erro: 'Esse preço passa de R$ 100.000 — confira se não sobrou um zero.' as const }
  }

  const textoEstoque = (d.estoque ?? '').trim()
  let estoque: number | null = null
  if (textoEstoque) {
    const n = Number(textoEstoque.replace(/\D/g, ''))
    if (!Number.isFinite(n)) return { erro: 'O estoque precisa ser um número.' as const }
    estoque = n
  }

  return {
    valores: {
      nome,
      descricao: (d.descricao ?? '').trim() || null,
      categoria: d.categoria ?? 'outro',
      preco_centavos: preco,
      estoque,
      ativo: d.ativo !== false,
      politica_id: d.politica_id || null,
    },
  }
}

const recarregar = () => {
  revalidatePath('/dashboard/admin/loja')
  revalidatePath('/dashboard/aluno/loja')
}

export async function criarProduto(dados: DadosDoProduto): Promise<Resultado<{ id: string }>> {
  if (!(await exigirAdmin())) return SEM_PERMISSAO

  const conferido = conferirProduto(dados)
  if (conferido.erro) return { ok: false, erro: conferido.erro }

  const admin = createAdminClient()
  const { data: ultimo } = await admin
    .from('produtos')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('produtos')
    .insert({ ...conferido.valores, ordem: (Number(ultimo?.ordem) || 0) + 1 })
    .select('id')
    .single()

  if (error) return { ok: false, erro: error.message }
  recarregar()
  return { ok: true, id: data.id as string }
}

export async function atualizarProduto(
  id: string,
  dados: DadosDoProduto
): Promise<Resultado> {
  if (!(await exigirAdmin())) return SEM_PERMISSAO

  const conferido = conferirProduto(dados)
  if (conferido.erro) return { ok: false, erro: conferido.erro }

  const admin = createAdminClient()
  const { error } = await admin
    .from('produtos')
    .update({ ...conferido.valores, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, erro: error.message }
  recarregar()
  return { ok: true }
}

/**
 * Tirar da loja NÃO apaga o produto.
 *
 * O produto está dentro de pedidos antigos. Apagar de vez levaria junto o
 * registro do que foi vendido — e "tirar da vitrine" é o que a coordenação
 * quer dizer em 99 casos de 100 quando fala em remover.
 */
export async function definirProdutoAtivo(id: string, ativo: boolean): Promise<Resultado> {
  if (!(await exigirAdmin())) return SEM_PERMISSAO
  const admin = createAdminClient()
  const { error } = await admin
    .from('produtos')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, erro: error.message }
  recarregar()
  return { ok: true }
}

/** Apagar de vez — só se ninguém nunca comprou. */
export async function removerProduto(id: string): Promise<Resultado> {
  if (!(await exigirAdmin())) return SEM_PERMISSAO
  const admin = createAdminClient()

  const { count } = await admin
    .from('pedido_itens')
    .select('id', { count: 'exact', head: true })
    .eq('produto_id', id)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      erro: `Este produto já foi vendido ${count} vez(es), então apagá-lo apagaria parte do histórico de vendas. Use "Tirar da loja": ele some da vitrine e os pedidos antigos continuam certos.`,
    }
  }

  const { error } = await admin.from('produtos').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }
  recarregar()
  return { ok: true }
}

export interface DadosDaPolitica {
  parcelas_sem_juros: number
  parcelas_max: number
  juros_ao_mes_pct: number
  desconto_avista_pct: number
  /** Texto, como a pessoa digita: "20,00". */
  parcela_minima: string
  aceita_pix: boolean
  aceita_boleto: boolean
  aceita_cartao: boolean
}

/**
 * O painel de parcelas e descontos.
 *
 * As conferências aqui não são burocracia: cada uma delas corresponde a um
 * jeito de a loja ficar sem sentido para quem for comprar.
 */
export async function salvarPoliticaGeral(dados: DadosDaPolitica): Promise<Resultado> {
  if (!(await exigirAdmin())) return SEM_PERMISSAO

  const semJuros = Math.floor(Number(dados.parcelas_sem_juros) || 1)
  const maximo = Math.floor(Number(dados.parcelas_max) || 1)
  const juros = Number(dados.juros_ao_mes_pct) || 0
  const desconto = Number(dados.desconto_avista_pct) || 0
  const minima = centavosDoTexto(dados.parcela_minima ?? '0') ?? 0

  if (semJuros < 1 || semJuros > 24) return { ok: false, erro: 'As parcelas sem juros vão de 1 a 24.' }
  if (maximo < semJuros) {
    return {
      ok: false,
      erro: 'O máximo de parcelas não pode ser menor que o de parcelas sem juros.',
    }
  }
  if (maximo > 24) return { ok: false, erro: 'O máximo de parcelas é 24.' }
  if (desconto < 0 || desconto > 90) return { ok: false, erro: 'O desconto à vista vai de 0% a 90%.' }
  if (juros < 0) return { ok: false, erro: 'Os juros não podem ser negativos.' }
  if (maximo > semJuros && juros === 0) {
    return {
      ok: false,
      erro: 'Você permitiu mais parcelas do que as sem juros, mas deixou os juros em 0% — nesse caso as parcelas a mais nunca vão aparecer. Ou iguale os dois números, ou informe os juros.',
    }
  }
  if (!dados.aceita_pix && !dados.aceita_boleto && !dados.aceita_cartao) {
    return { ok: false, erro: 'Deixe pelo menos uma forma de pagamento ligada.' }
  }

  const admin = createAdminClient()
  const { data: geral } = await admin
    .from('politicas_de_pagamento')
    .select('id')
    .eq('geral', true)
    .maybeSingle()

  const valores = {
    parcelas_sem_juros: semJuros,
    parcelas_max: maximo,
    juros_ao_mes_pct: juros,
    desconto_avista_pct: desconto,
    parcela_minima_centavos: minima,
    aceita_pix: !!dados.aceita_pix,
    aceita_boleto: !!dados.aceita_boleto,
    aceita_cartao: !!dados.aceita_cartao,
    updated_at: new Date().toISOString(),
  }

  const { error } = geral
    ? await admin.from('politicas_de_pagamento').update(valores).eq('id', geral.id)
    : await admin
        .from('politicas_de_pagamento')
        .insert({ ...valores, nome: 'Regra geral da loja', geral: true })

  if (error) return { ok: false, erro: error.message }

  revalidatePath('/dashboard/admin/loja')
  revalidatePath('/dashboard/aluno/loja')
  return { ok: true }
}

/** A secretaria entregou o produto. */
export async function marcarRetirado(pedidoId: string, retirado: boolean): Promise<Resultado> {
  const quem = await exigirAdmin()
  if (!quem) return SEM_PERMISSAO

  const admin = createAdminClient()
  const { error } = await admin
    .from('pedidos')
    .update({
      retirado_em: retirado ? new Date().toISOString() : null,
      retirado_por: retirado ? quem.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedidoId)

  if (error) return { ok: false, erro: error.message }
  revalidatePath('/dashboard/admin/pedidos')
  return { ok: true }
}

/**
 * Confirma o pagamento na mão.
 *
 * Enquanto o pagamento on-line não está ligado, é assim que um pedido vira
 * "pago": alguém da secretaria recebeu o dinheiro e registra. Isso continua
 * existindo depois, porque sempre vai haver quem pague em espécie na
 * secretaria — e quando isso acontece, o registro precisa dizer que foi na
 * mão, e de quem.
 */
export async function confirmarPagamentoNaMao(
  pedidoId: string,
  observacao?: string
): Promise<Resultado> {
  const quem = await exigirAdmin()
  if (!quem) return SEM_PERMISSAO

  const admin = createAdminClient()
  const { data: pedido } = await admin
    .from('pedidos')
    .select('status, observacao')
    .eq('id', pedidoId)
    .maybeSingle()

  if (!pedido) return { ok: false, erro: 'Pedido não encontrado.' }
  if (pedido.status === 'pago') return { ok: false, erro: 'Este pedido já está pago.' }

  const nota = `Pagamento confirmado na secretaria em ${new Date().toLocaleString('pt-BR')}.${
    observacao?.trim() ? ` ${observacao.trim()}` : ''
  }`

  const { error } = await admin
    .from('pedidos')
    .update({
      status: 'pago',
      pago_em: new Date().toISOString(),
      observacao: [pedido.observacao, nota].filter(Boolean).join('\n'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedidoId)

  if (error) return { ok: false, erro: error.message }

  await admin.from('pagamento_eventos').insert({
    pedido_id: pedidoId,
    provedor: 'secretaria',
    evento: 'PAGAMENTO_NA_MAO',
    corpo: { por: quem.id, observacao: observacao ?? null },
  })

  revalidatePath('/dashboard/admin/pedidos')
  revalidatePath('/dashboard/aluno/pedidos')
  return { ok: true }
}

export async function cancelarPedido(pedidoId: string): Promise<Resultado> {
  if (!(await exigirAdmin())) return SEM_PERMISSAO
  const admin = createAdminClient()
  const { error } = await admin
    .from('pedidos')
    .update({ status: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', pedidoId)
  if (error) return { ok: false, erro: error.message }
  revalidatePath('/dashboard/admin/pedidos')
  revalidatePath('/dashboard/aluno/pedidos')
  return { ok: true }
}

/* ============================================================
   LIGAR A COBRANÇA ON-LINE — A CHAVE COLADA NA PRÓPRIA PLATAFORMA

   Antes, ligar o Asaas queria dizer: a coordenação manda a chave da conta
   bancária da igreja por mensagem, alguém coloca num painel de fora. Chave
   que anda por conversa fica na conversa — no histórico do aplicativo, no
   backup do aparelho, em toda cópia por onde a conversa passou. E chave do
   Asaas movimenta dinheiro de verdade.

   Agora ela é colada aqui, e a plataforma faz os quatro passos sozinha:

     1. CONFERE a chave com o Asaas antes de guardar. Guardar sem conferir
        faria a tela dizer "ligado" com uma chave errada, e o erro só
        apareceria na primeira compra de um aluno.
     2. SORTEIA a senha do aviso de pagamento. Ninguém precisa inventar,
        digitar nem guardar essa senha em lugar nenhum.
     3. CADASTRA o aviso lá, pela API do Asaas, apontando para o endereço
        desta plataforma — em vez de mandar alguém procurar o menu certo no
        painel deles.
     4. GUARDA no cofre cifrado do banco (migração 026).

   E devolve para a tela só o que ela precisa mostrar. A chave não volta.
   ============================================================ */

export interface LigacaoFeita {
  conta: string
  ambiente: Ambiente
  avisoRegistrado: boolean
  /** Preenchidos SÓ quando o cadastro automático do aviso falhou. */
  avisoUrl?: string
  avisoToken?: string
  avisoMotivo?: string
}

export async function ligarAsaas(
  chave: string,
  ambiente: Ambiente
): Promise<Resultado<LigacaoFeita>> {
  const quem = await exigirAdmin()
  if (!quem) return SEM_PERMISSAO

  const limpa = (chave ?? '').trim()
  if (!limpa) return { ok: false, erro: 'Cole a chave da API do Asaas.' }
  if (limpa.length < 20) {
    return {
      ok: false,
      erro: 'Isso parece curto demais para ser a chave. Copie a linha inteira que o Asaas mostrou.',
    }
  }

  const conferida = await conferirChave(limpa, ambiente)
  if (!conferida.ok) return { ok: false, erro: conferida.erro }

  /* A senha do aviso é sorteada aqui e nunca mostrada. `randomUUID` usa o
     gerador criptográfico do sistema — uma senha "fácil de digitar" não
     precisa existir, porque ninguém vai digitá-la. */
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')

  /* O endereço do aviso sai do domínio por onde esta página está sendo
     acessada. Escrever o domínio no código quebraria em qualquer troca de
     endereço, e ninguém lembraria de vir corrigir aqui. */
  const cabecalhos = await headers()
  const host = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host') ?? ''
  const protocolo = host.startsWith('localhost') ? 'http' : 'https'
  const url = `${protocolo}://${host}/api/pagamentos/asaas/webhook`

  const aviso = await registrarAviso(limpa, ambiente, url, token)

  const admin = createAdminClient()
  const { error } = await admin.rpc('pagamento_asaas_salvar', {
    p_chave: limpa,
    p_ambiente: ambiente,
    p_webhook_token: token,
    p_conta_nome: conferida.nome,
    p_conta_email: conferida.email,
    p_webhook_id: aviso.ok ? aviso.webhookId : null,
    p_usuario: quem.id,
  })
  if (error) return { ok: false, erro: `Não consegui guardar a chave: ${error.message}` }

  revalidatePath('/dashboard/admin/loja')
  revalidatePath('/dashboard/aluno/loja')

  return {
    ok: true,
    conta: conferida.nome,
    ambiente,
    avisoRegistrado: aviso.ok,
    /* Só quando o cadastro automático falhou. Enquanto der certo, esta
       senha não passa nem perto do navegador. */
    ...(aviso.ok ? {} : { avisoUrl: url, avisoToken: token, avisoMotivo: aviso.erro }),
  }
}

export async function desligarAsaas(): Promise<Resultado> {
  if (!(await exigirAdmin())) return SEM_PERMISSAO

  const admin = createAdminClient()
  const { error } = await admin.rpc('pagamento_asaas_desligar')
  if (error) return { ok: false, erro: error.message }

  revalidatePath('/dashboard/admin/loja')
  revalidatePath('/dashboard/aluno/loja')
  return { ok: true }
}
