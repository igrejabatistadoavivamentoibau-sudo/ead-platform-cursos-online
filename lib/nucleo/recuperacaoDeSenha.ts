/* ============================================================
   RECUPERAR A SENHA — A REGRA, E SÓ A REGRA

   Sem Supabase, sem Next, sem navegador. Entram textos, saem decisões
   com o motivo escrito em português. É isso que permite conferir, caso a
   caso, coisas que dariam trabalho para reproduzir de verdade: link
   vencido, link adulterado, as duas senhas diferentes, a senha igual ao
   e-mail.

   POR QUE A REGRA NÃO MORA DENTRO DA TELA
   Mesmo motivo de `lib/nucleo/acessoAoVideo.ts`: regra enterrada num
   componente é conferida "de olho", e no dia em que o aplicativo do
   celular tiver a sua própria tela de nova senha, a segunda cópia vai
   divergir da primeira. Aqui ela é uma coisa só, testada.

   ESTE ARQUIVO NÃO IMPORTA NADA DE PROPÓSITO. É o que deixa o teste
   compilá-lo sozinho e rodar a regra DE VERDADE, em vez de rodar uma
   cópia colada dentro do teste que envelhece em silêncio.
   ============================================================ */

/* ------------------------------------------------------------------
   1. O E-MAIL PEDIDO NA PRIMEIRA TELA
   ------------------------------------------------------------------ */

export type Conferencia = { ok: true; valor: string } | { ok: false; erro: string }

/**
 * Confere o e-mail digitado.
 *
 * Repare no que ela **não** faz: não diz se a conta existe. Essa resposta
 * nunca aparece em lugar nenhum deste fluxo — ver `RECADO_DE_ENVIO`.
 */
export function conferirEmail(texto: string): Conferencia {
  const valor = (texto ?? '').trim().toLowerCase()

  if (!valor) return { ok: false, erro: 'Digite o e-mail da sua conta.' }

  /* Proposital: uma conferência de FORMA, não de existência. Um e-mail
     com espaço no meio ou sem o "@" é erro de digitação, e avisar disso
     poupa a pessoa de esperar um e-mail que nunca ia chegar. */
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) {
    return { ok: false, erro: 'Confira o e-mail: parece que falta alguma coisa nele.' }
  }

  return { ok: true, valor }
}

/**
 * O recado depois de pedir a recuperação. É SEMPRE o mesmo texto,
 * exista a conta ou não.
 *
 * Se a plataforma dissesse "não encontramos este e-mail", qualquer pessoa
 * de fora poderia descobrir, um endereço por vez, quem estuda aqui — é o
 * que se chama de contagem de contas, e numa escola de igreja isso é
 * informação sobre a vida das pessoas. O preço de não contar é pequeno:
 * quem digitou errado não recebe nada e tenta de novo.
 */
export const RECADO_DE_ENVIO =
  'Se este e-mail estiver cadastrado, o link para criar uma senha nova já está a caminho. Confira também a caixa de spam.'

/* ------------------------------------------------------------------
   2. A SENHA NOVA
   ------------------------------------------------------------------ */

/**
 * O mínimo é 8, e não os 6 que o Supabase aceita por padrão.
 *
 * Seis caracteres é o piso do provedor, não uma recomendação. A própria
 * plataforma já cria senha provisória com 9 (ver `gerarSenhaProvisoria`),
 * então baixar para 6 aqui seria a recuperação enfraquecendo o que o
 * cadastro faz certo.
 */
export const TAMANHO_MINIMO_DA_SENHA = 8

/* As que aparecem em toda lista de senha vazada, mais as óbvias desta
   casa. Não é uma peneira de segurança séria — é evitar o caso em que a
   pessoa troca a senha por outra que qualquer um adivinha na primeira
   tentativa. */
const SENHAS_OBVIAS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'senha123',
  'senha1234',
  'password',
  'password1',
  'qwertyui',
  'abcd1234',
  'ibau1234',
  'ibau2024',
  'ibau2025',
  'ibau2026',
  'mudar123',
  'trocar123',
])

export function conferirNovaSenha(senha: string, repetida: string, email?: string): Conferencia {
  const valor = senha ?? ''

  if (!valor) return { ok: false, erro: 'Digite a nova senha.' }

  /* Espaço na ponta é a armadilha silenciosa: a senha é gravada COM o
     espaço, e na próxima vez a pessoa digita sem ele e não entra — jurando
     que a plataforma quebrou. Recusar é melhor do que aparar por baixo do
     pano, porque aparar grava uma senha diferente da que ela está vendo. */
  if (valor !== valor.trim()) {
    return { ok: false, erro: 'A senha não pode começar nem terminar com espaço.' }
  }

  if (valor.length < TAMANHO_MINIMO_DA_SENHA) {
    return {
      ok: false,
      erro: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`,
    }
  }

  if (SENHAS_OBVIAS.has(valor.toLowerCase())) {
    return { ok: false, erro: 'Esta senha é fácil demais de adivinhar. Escolha outra.' }
  }

  /* Uma letra só repetida passa em qualquer conta de tamanho. */
  if (new Set(valor).size < 4) {
    return { ok: false, erro: 'Misture mais letras e números — esta senha se repete demais.' }
  }

  if (email) {
    const limpo = email.trim().toLowerCase()
    const antesDoArroba = limpo.split('@')[0]
    if (valor.toLowerCase() === limpo || (antesDoArroba && valor.toLowerCase() === antesDoArroba)) {
      return { ok: false, erro: 'A senha não pode ser o seu próprio e-mail.' }
    }
  }

  /* Conferida por último de propósito: se as duas estão diferentes mas a
     primeira também é curta, o recado útil é o do tamanho — ela vai ter de
     digitar tudo de novo de qualquer jeito. */
  if (valor !== repetida) {
    return { ok: false, erro: 'As duas senhas estão diferentes. Digite a mesma nos dois campos.' }
  }

  return { ok: true, valor }
}

/** Só para a barrinha da tela. Não decide nada — quem decide é a função acima. */
export function forcaDaSenha(senha: string): { nivel: 0 | 1 | 2 | 3; rotulo: string } {
  const v = senha ?? ''
  if (v.length < TAMANHO_MINIMO_DA_SENHA) return { nivel: 0, rotulo: 'Curta demais' }
  let pontos = 0
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) pontos++
  if (/\d/.test(v)) pontos++
  if (/[^A-Za-z0-9]/.test(v)) pontos++
  if (v.length >= 12) pontos++
  if (pontos <= 1) return { nivel: 1, rotulo: 'Fraca' }
  if (pontos === 2) return { nivel: 2, rotulo: 'Boa' }
  return { nivel: 3, rotulo: 'Forte' }
}

/* ------------------------------------------------------------------
   3. O QUE VOLTOU NO LINK DO E-MAIL
   ------------------------------------------------------------------ */

export type LinkDeRecuperacao =
  /** Veio a chave de entrada: dá para abrir a tela de nova senha. */
  | { tipo: 'entrada'; accessToken: string; refreshToken: string }
  /** Veio um código do fluxo PKCE (só funciona no mesmo navegador). */
  | { tipo: 'codigo'; code: string }
  /** O provedor recusou o link. */
  | { tipo: 'recusado'; vencido: boolean; motivo: string }
  /** Não é um retorno de recuperação nenhum. */
  | { tipo: 'nada' }

export const MOTIVO_VENCIDO =
  'Este link já venceu. Por segurança ele vale por pouco tempo e só pode ser usado uma vez — peça um novo abaixo.'

export const MOTIVO_INVALIDO =
  'Este link não vale mais. Ele expira, só funciona uma vez, e às vezes o programa de e-mail corta o endereço no meio. Peça um novo abaixo.'

export const MOTIVO_SEM_LINK =
  'Não encontramos um link de recuperação válido nesta página. Peça um novo abaixo.'

/**
 * Lê o que o provedor devolveu no endereço.
 *
 * @param hash   o pedaço depois do "#", com ou sem o "#"
 * @param busca  o pedaço depois do "?", com ou sem o "?"
 *
 * O `hash` é o caminho normal deste fluxo, e isso é uma escolha: o que
 * vem depois do "#" **nunca é enviado ao servidor** pelo navegador. A
 * chave de entrada da pessoa não aparece em registro de acesso nenhum,
 * nem no nosso nem no da hospedagem.
 */
export function lerLinkDeRecuperacao(hash: string, busca = ''): LinkDeRecuperacao {
  const h = new URLSearchParams((hash ?? '').replace(/^#/, ''))
  const q = new URLSearchParams((busca ?? '').replace(/^\?/, ''))

  /* O erro pode chegar pelos dois lados dependendo da versão do provedor,
     então os dois são olhados. */
  const erro = h.get('error') || q.get('error')
  const codigoDoErro = h.get('error_code') || q.get('error_code')

  if (erro || codigoDoErro) {
    const vencido = /otp_expired|expired/i.test(codigoDoErro || '') || /expired/i.test(erro || '')
    return {
      tipo: 'recusado',
      vencido,
      motivo: vencido ? MOTIVO_VENCIDO : MOTIVO_INVALIDO,
    }
  }

  const accessToken = h.get('access_token')
  const refreshToken = h.get('refresh_token')

  if (accessToken && refreshToken) {
    /* `type` costuma vir como 'recovery'. Não exigimos: um link de convite
       ou de confirmação que caia aqui também termina em "defina sua
       senha", que é exatamente o que esta tela faz. Exigir o rótulo
       recusaria um caso que funciona. */
    return { tipo: 'entrada', accessToken, refreshToken }
  }

  const code = q.get('code') || h.get('code')
  if (code) return { tipo: 'codigo', code }

  return { tipo: 'nada' }
}

/* ------------------------------------------------------------------
   4. AS MENSAGENS DO PROVEDOR, EM PORTUGUÊS
   ------------------------------------------------------------------ */

/**
 * O Supabase responde em inglês e em jargão. "Auth session missing!" na
 * tela de uma pessoa que só quer trocar a senha não informa nada — e o
 * que ela precisa saber é que o link venceu e que basta pedir outro.
 */
export function traduzirErroDoSupabase(mensagem: string, codigo?: string, padrao?: string): string {
  const m = (mensagem ?? '').toLowerCase()
  const c = (codigo ?? '').toLowerCase()

  if (c === 'same_password' || m.includes('should be different from the old password')) {
    return 'A nova senha precisa ser diferente da que você já usava.'
  }
  if (c === 'weak_password' || m.includes('password should be at least') || m.includes('weak')) {
    return `Escolha uma senha mais forte, com pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`
  }
  if (
    c === 'over_email_send_rate_limit' ||
    m.includes('rate limit') ||
    m.includes('you can only request this after')
  ) {
    return 'Já enviamos um e-mail há pouco. Espere um minuto e tente de novo.'
  }
  if (
    m.includes('auth session missing') ||
    m.includes('session_not_found') ||
    m.includes('session from session_id claim in jwt does not exist') ||
    m.includes('invalid claim')
  ) {
    return MOTIVO_VENCIDO
  }
  if (m.includes('token has expired') || m.includes('otp_expired') || c === 'otp_expired') {
    return MOTIVO_VENCIDO
  }
  if (m.includes('invalid') && (m.includes('token') || m.includes('grant') || m.includes('code'))) {
    return MOTIVO_INVALIDO
  }
  if (m.includes('user not found')) {
    /* Não confirmamos nem desmentimos a existência da conta. */
    return RECADO_DE_ENVIO
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Não conseguimos falar com o servidor. Confira sua internet e tente de novo.'
  }

  /* O `padrao` existe porque a MESMA falha desconhecida quer dizer coisas
     diferentes dependendo de onde acontece. Ao abrir o link, qualquer
     coisa que dê errado é, para quem está lendo, "este link não serve" — e
     a saída é pedir outro. Ao salvar a senha, não: ali o link estava bom, e
     mandar pedir outro seria jogar fora um caminho que funcionava. */
  return padrao ?? 'Não foi possível concluir agora. Tente de novo em instantes.'
}

/* ------------------------------------------------------------------
   5. PARA ONDE A PESSOA VOLTA
   ------------------------------------------------------------------ */

/**
 * Onde o e-mail já digitado no login espera, para a tela de recuperação
 * não pedir de novo.
 *
 * Fica na memória da aba, e NÃO no endereço. Passar `?email=...` seria
 * mais simples e deixaria o endereço da pessoa no histórico do navegador,
 * em qualquer print e nos registros de acesso de quem hospeda o site.
 * Endereço de e-mail é dado de pessoa; não tem por que passear por aí para
 * economizar um campo de formulário.
 */
export const CHAVE_DO_EMAIL_DIGITADO = 'ibau:email-do-login'

/** A marca que a tela de login lê para dar o parabéns e nada mais. */
export const AVISO_DE_SENHA_TROCADA = 'senha=alterada'

export const DESTINO_DEPOIS_DE_TROCAR = `/auth/login?${AVISO_DE_SENHA_TROCADA}`
