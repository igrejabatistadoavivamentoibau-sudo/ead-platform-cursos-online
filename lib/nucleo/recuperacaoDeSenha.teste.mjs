/* ============================================================
   RECUPERAR A SENHA — TODOS OS CASOS

   Roda com:  node lib/nucleo/recuperacaoDeSenha.teste.mjs

   ESTE TESTE COMPILA E IMPORTA O ARQUIVO DE VERDADE.

   Os testes anteriores deste projeto (`acessoAoVideo.teste.mjs`,
   `modulosDoAluno.teste.mjs`) traziam uma CÓPIA da regra colada aqui
   dentro, porque o teste roda sem TypeScript. Copiar funciona no dia em
   que se escreve e apodrece depois: alguém corrige a regra, esquece a
   cópia, e o teste passa a garantir o comportamento de um código que não
   existe mais — que é pior do que não ter teste, porque dá confiança.

   Aqui o arquivo é compilado numa pasta temporária e importado de lá. Se
   a regra mudar, este teste roda a regra nova. Foi para isso que
   `recuperacaoDeSenha.ts` não importa nada: sem dependências, ele compila
   sozinho.
   ============================================================ */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = resolve(aqui, '..', '..')
const fonte = join(aqui, 'recuperacaoDeSenha.ts')

const pasta = mkdtempSync(join(tmpdir(), 'ibau-recuperacao-'))
try {
  execFileSync(
    process.execPath,
    [
      join(raiz, 'node_modules', 'typescript', 'bin', 'tsc'),
      fonte,
      '--outDir',
      pasta,
      '--target',
      'es2020',
      '--module',
      'esnext',
      '--moduleResolution',
      'bundler',
      '--skipLibCheck',
    ],
    { stdio: 'pipe' }
  )
} catch (e) {
  console.error('Falhou ao compilar a regra:\n' + (e.stdout?.toString() || e.message))
  process.exit(1)
}
writeFileSync(join(pasta, 'package.json'), '{"type":"module"}')

const R = await import(pathToFileURL(join(pasta, 'recuperacaoDeSenha.js')).href)

const provas = []
const prova = (nome, ok, extra = '') => provas.push([nome, ok, extra])
const recusa = (r, trecho) => r.ok === false && r.erro.includes(trecho)

/* ================= 1. O E-MAIL PEDIDO ================= */

prova('e-mail normal passa e sai em minúsculas, sem espaço',
  (() => {
    const r = R.conferirEmail('  Elidiane@Exemplo.COM ')
    return r.ok === true && r.valor === 'elidiane@exemplo.com'
  })())

prova('campo vazio pede o e-mail',
  recusa(R.conferirEmail('   '), 'Digite o e-mail'))

prova('e-mail sem arroba é recusado antes de gastar o envio',
  recusa(R.conferirEmail('elidiane.exemplo.com'), 'Confira o e-mail'))

prova('e-mail sem ponto no domínio é recusado',
  recusa(R.conferirEmail('elidiane@exemplo'), 'Confira o e-mail'))

prova('e-mail com espaço no meio é recusado',
  recusa(R.conferirEmail('eli diane@exemplo.com'), 'Confira o e-mail'))

/* O ponto central do pedido dela: nunca contar se a conta existe. */
prova('o recado de envio NÃO diz se a conta existe',
  !/não encontr|nao encontr|não existe|nao existe|cadastrad[oa] com sucesso/i.test(R.RECADO_DE_ENVIO) &&
    /se este e-mail estiver cadastrado/i.test(R.RECADO_DE_ENVIO),
  R.RECADO_DE_ENVIO)

prova('"usuário não encontrado" do provedor vira o MESMO recado neutro',
  R.traduzirErroDoSupabase('User not found') === R.RECADO_DE_ENVIO)

/* ================= 2. A SENHA NOVA ================= */

prova('senha boa e repetida igual passa',
  R.conferirNovaSenha('Avivamento26', 'Avivamento26', 'ana@exemplo.com').ok === true)

prova('senha curta é recusada com o número na frase',
  recusa(R.conferirNovaSenha('Abc123', 'Abc123'), 'pelo menos 8'))

prova('as duas senhas diferentes são recusadas',
  recusa(R.conferirNovaSenha('Avivamento26', 'Avivamento25'), 'estão diferentes'))

prova('senha com espaço no fim é recusada, e não aparada em silêncio',
  recusa(R.conferirNovaSenha('Avivamento26 ', 'Avivamento26 '), 'espaço'))

prova('senha igual ao e-mail é recusada',
  recusa(R.conferirNovaSenha('ana@exemplo.com', 'ana@exemplo.com', 'ana@exemplo.com'), 'seu próprio e-mail'))

prova('senha igual ao começo do e-mail também é recusada',
  recusa(R.conferirNovaSenha('anamariaa', 'anamariaa', 'anamariaa@exemplo.com'), 'seu próprio e-mail'))

prova('senha óbvia da lista é recusada',
  recusa(R.conferirNovaSenha('senha1234', 'senha1234'), 'fácil demais'))

prova('senha de uma letra repetida é recusada mesmo sendo longa',
  recusa(R.conferirNovaSenha('aaaaaaaaaaaa', 'aaaaaaaaaaaa'), 'se repete demais'))

prova('campo vazio pede a senha',
  recusa(R.conferirNovaSenha('', ''), 'Digite a nova senha'))

/* Ordem das conferências: o recado tem de ser o ÚTIL. */
prova('senha curta E diferente reclama do tamanho, não da diferença',
  recusa(R.conferirNovaSenha('Abc1', 'Xyz9'), 'pelo menos 8'),
  'ela vai digitar tudo de novo de qualquer jeito')

/* ================= 3. O LINK QUE VOLTA DO E-MAIL ================= */

const hashBom =
  '#access_token=eyJabc.def.ghi&expires_at=1780000000&expires_in=3600' +
  '&refresh_token=r3fr3sh&token_type=bearer&type=recovery'

prova('link bom devolve as duas chaves',
  (() => {
    const r = R.lerLinkDeRecuperacao(hashBom)
    return r.tipo === 'entrada' && r.accessToken === 'eyJabc.def.ghi' && r.refreshToken === 'r3fr3sh'
  })())

prova('link bom é lido igual sem o "#" na frente',
  R.lerLinkDeRecuperacao(hashBom.slice(1)).tipo === 'entrada')

prova('link VENCIDO é reconhecido como vencido, não como inválido',
  (() => {
    const r = R.lerLinkDeRecuperacao(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    )
    return r.tipo === 'recusado' && r.vencido === true && r.motivo === R.MOTIVO_VENCIDO
  })(),
  'a frase precisa dizer "venceu", porque a saída é pedir outro')

prova('link ADULTERADO cai em inválido, sem prometer que era só o prazo',
  (() => {
    const r = R.lerLinkDeRecuperacao('#error=access_denied&error_code=bad_oauth_state')
    return r.tipo === 'recusado' && r.vencido === false && r.motivo === R.MOTIVO_INVALIDO
  })())

prova('erro que chega pela busca (?) também é reconhecido',
  R.lerLinkDeRecuperacao('', '?error=access_denied&error_code=otp_expired').tipo === 'recusado')

prova('metade do link (só access_token) NÃO é aceito como entrada',
  R.lerLinkDeRecuperacao('#access_token=eyJabc&type=recovery').tipo === 'nada',
  'sem a chave de renovação a sessão morreria no meio da troca')

prova('endereço limpo devolve "nada"',
  R.lerLinkDeRecuperacao('', '').tipo === 'nada')

prova('código do fluxo PKCE é reconhecido à parte',
  (() => {
    const r = R.lerLinkDeRecuperacao('', '?code=abc-123')
    return r.tipo === 'codigo' && r.code === 'abc-123'
  })())

prova('link sem o rótulo type=recovery ainda é aceito',
  R.lerLinkDeRecuperacao('#access_token=a.b.c&refresh_token=rrr').tipo === 'entrada',
  'convite e confirmação terminam na mesma tela')

/* ================= 4. AS MENSAGENS DO PROVEDOR ================= */

prova('"Auth session missing!" vira a frase do link vencido',
  R.traduzirErroDoSupabase('Auth session missing!') === R.MOTIVO_VENCIDO)

prova('senha igual à anterior é explicada',
  R.traduzirErroDoSupabase('New password should be different from the old password.')
    .includes('diferente da que você já usava'))

prova('senha fraca do provedor vira a frase com o nosso mínimo',
  R.traduzirErroDoSupabase('', 'weak_password').includes('8 caracteres'))

prova('limite de envio vira "espere um minuto"',
  R.traduzirErroDoSupabase('For security purposes, you can only request this after 51 seconds.')
    .includes('Espere um minuto'))

prova('erro desconhecido não vaza jargão em inglês',
  (() => {
    const t = R.traduzirErroDoSupabase('unexpected_failure: pgbouncer said no')
    return !/pgbouncer|unexpected_failure/.test(t) && /Tente de novo/.test(t)
  })())

prova('nenhuma mensagem traduzida sobrou em inglês',
  [
    R.traduzirErroDoSupabase('Auth session missing!'),
    R.traduzirErroDoSupabase('', 'same_password'),
    R.traduzirErroDoSupabase('', 'weak_password'),
    R.traduzirErroDoSupabase('Failed to fetch'),
    R.MOTIVO_VENCIDO,
    R.MOTIVO_INVALIDO,
    R.MOTIVO_SEM_LINK,
    R.RECADO_DE_ENVIO,
  ].every((t) => !/\b(password|session|token|invalid|expired|error|user)\b/i.test(t)))

/* ================= 5. A BARRINHA DE FORÇA ================= */

prova('senha curta não recebe nível nenhum',
  R.forcaDaSenha('Abc1').nivel === 0)

prova('senha longa e variada chega em forte',
  R.forcaDaSenha('Avivamento-2026!').nivel === 3)

prova('a barrinha NÃO decide nada: a recusa vem da outra função',
  R.forcaDaSenha('senha1234').nivel > 0 &&
    R.conferirNovaSenha('senha1234', 'senha1234').ok === false,
  'força alta e senha recusada podem conviver — quem manda é conferirNovaSenha')

/* ================= 6. A RODADA DE CONTROLE ================= */

/* Sem ela, um teste que passa por acaso diz "está tudo certo" sem provar
   nada. Se a regra fosse "aceita qualquer senha", este caso acusaria. */
const aceitaTudo = () => ({ ok: true, valor: 'x' })
prova('CONTROLE: uma regra que aceitasse qualquer senha seria acusada aqui',
  aceitaTudo('a', 'b').ok === true && R.conferirNovaSenha('a', 'b').ok === false)

/* E o mesmo para o link: se `lerLinkDeRecuperacao` devolvesse 'entrada'
   para tudo, o link vencido abriria a tela de nova senha. */
const abreSempre = () => ({ tipo: 'entrada' })
prova('CONTROLE: uma leitura que abrisse qualquer link seria acusada aqui',
  abreSempre('#error=access_denied').tipo === 'entrada' &&
    R.lerLinkDeRecuperacao('#error=access_denied&error_code=otp_expired').tipo === 'recusado')

let falhas = 0
for (const [nome, ok, extra] of provas) {
  if (!ok) falhas++
  console.log(`  ${ok ? 'OK   ' : 'FALHA'} | ${nome}`)
  if (extra) console.log(`         ${extra}`)
}
rmSync(pasta, { recursive: true, force: true })
console.log(
  falhas === 0
    ? `\n${provas.length} casos: a recuperação de senha não conta quem tem conta, e o link só abre quando vale.`
    : `\n${falhas} FALHA(S)`
)
process.exit(falhas === 0 ? 0 : 1)
