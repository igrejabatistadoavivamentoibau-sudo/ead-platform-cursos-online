# Arquitetura: responsividade e desacoplamento

> **Requisito:** *"Toda a aplicação deve ser construída de forma responsiva e
> desacoplada, permitindo futuramente a criação de aplicativos nativos iOS e
> Android utilizando o mesmo backend e APIs, sem reescrever a lógica de
> negócio."*

Este documento diz onde a plataforma está em relação a isso, medido — não
estimado — e o que falta.

---

## Resumo

| | Situação |
|---|---|
| Responsividade | **Atendido.** 48 de 53 telas com pontos de quebra; nenhuma tabela sem rolagem própria; nenhuma largura fixa acima de 390px; conferido em 375, 390 e 768px sem estouro |
| Backend compartilhável | **Atendido.** 42 tabelas, 112 políticas de acesso, 24 gatilhos e 42 funções no banco — tudo isso vale igual para qualquer cliente |
| Autenticação compartilhada | **Atendido.** Supabase Auth, com bibliotecas oficiais para iOS e Android |
| Regra de negócio portável | **Parcial.** 25 módulos de regra pura em `lib/` + 104 Server Actions, das quais 2 já estão convertidas como modelo |
| API para app nativo | **Iniciada.** `/api/v1` de pé, com o padrão provado ponta a ponta |

Traduzindo: **a parte cara já está feita, e não por acaso.** A parte que falta
é mecânica e pode ser feita aos poucos, sem parar nada.

---

## Por que a maior parte já está pronta

A decisão que mais rende aqui foi tomada há muito tempo e por outro motivo:
**as regras moram no banco, não na tela.**

```
42 tabelas — todas com RLS ligada
112 políticas de acesso
24 gatilhos
42 funções
```

O que isso significa na prática: quem decide se um aluno pode entrar no
Módulo 2, se uma entrega chegou dentro do prazo, se o último administrador
pode ser apagado, se uma aula pode nascer sem módulo, se o total de um pedido
confere — **é o Postgres**, e não o React.

Um aplicativo em Swift que fale com o mesmo Supabase recebe todas essas
regras **de graça**, sem uma linha reescrita. Não é integração: é a mesma
regra, no mesmo lugar, para os dois clientes.

Se as regras estivessem no front-end — que é o padrão — o aplicativo nativo
seria uma reescrita completa, e cada correção teria de ser feita duas ou três
vezes. É essa a fatura que não vamos pagar.

---

## As três camadas, e quem já é portável

### 1. Banco de dados — **100% portável**
RLS, gatilhos e funções. Qualquer cliente que autentique no Supabase obedece
às mesmas regras. Nada a fazer.

### 2. `lib/` — **portável como HTTP; reutilizável direto em React Native**
25 módulos de regra pura, sem dependência de Next ou de banco:

`precos.ts` (dinheiro, parcelas, juros — 30 casos de teste) · `boletim.ts`
(média e frequência) · `modulosDoAluno.ts` (pré-requisito e cadeado — 17
casos) · `janelaDaAtividade.ts` · `permissoes.ts` · `assistido.ts` ·
`video.ts` · `documento.ts` · e mais 17.

Em **React Native / Expo** esses arquivos são importados como estão — zero
reescrita. Em **Swift/Kotlin nativos**, eles rodam no servidor e o aplicativo
consome o resultado pela API (é o que `/api/v1/meus-cursos` faz).

### 3. Server Actions — **é aqui que está o acoplamento**

```
53 ações  app/dashboard/admin/actions.ts
18 ações  app/dashboard/professor/actions.ts
10 ações  app/dashboard/admin/loja/actions.ts
 7 ações  app/dashboard/aluno/actions.ts
 7 ações  app/dashboard/caderno/actions.ts
 4 ações  app/dashboard/professor/materiais/actions.ts
 2 ações  app/dashboard/biblia/actions.ts
 3 ações  (lumi, loja do aluno, inscrição)
------------------------------------------------
104 ações
```

Server Action é um mecanismo do Next: o navegador chama por um protocolo
próprio, com a sessão vindo de **cookie**. Um aplicativo nativo não tem
cookie e não fala esse protocolo. Enquanto a regra estiver dentro da ação,
ela só existe para o site.

---

## A costura: uma regra, duas portas

O padrão está implementado e provado. São três arquivos.

### `lib/nucleo/identidade.ts` — a mesma pessoa, dois transportes

```
navegador   → sessão em COOKIE      → lib/auth.ts        → obterSessao()
iOS/Android → Authorization: Bearer → nucleo/identidade  → quemChamaPorToken()
```

As duas devolvem o **mesmo objeto**. Daí para dentro, nenhuma regra sabe por
onde a pessoa entrou.

O aplicativo não terá login próprio: entra no **mesmo** Supabase Auth
(`supabase-swift`, `supabase-kt`), recebe o **mesmo** JWT e o manda no
cabeçalho. Aqui o token é conferido contra o servidor de autenticação — nunca
apenas decodificado. E conta desativada é recusada na hora, sem esperar o
token vencer.

### `lib/nucleo/<assunto>.ts` — a regra, sem saber onde roda

Nada de `next/*`. Recebe `quem` já conferido e devolve
`{ ok: true, ... } | { ok: false, erro }`.

### As duas portas

```ts
// app/dashboard/aluno/loja/actions.ts   (site)
const sessao = await obterSessao()
const r = await fecharPedidoDe(sessao, itens, meio, parcelas)
if (r.ok) revalidatePath(...)

// app/api/v1/pedidos/route.ts           (aplicativo)
const quem = await quemChamaPorToken(tokenDoCabecalho(req))
const r = await fecharPedidoDe(quem, itens, meio, parcelas)
return daRegra(r, 201)
```

**A mesma função.** É a única forma de as duas nunca discordarem sobre quanto
custa um livro.

---

## O que já está de pé

| Rota | O que é |
|---|---|
| `GET /api/v1/eu` | Quem sou e o que posso — a primeira chamada de qualquer app |
| `GET /api/v1/meus-cursos` | A tela inicial do aluno, com o **cadeado já resolvido** |
| `POST /api/v1/pedidos` | Checkout da loja — a mesma função do botão do site |

### Contrato de erro

Um aplicativo precisa do código de status para saber o que fazer. Se tudo
voltasse 200, ele teria de adivinhar pelo texto — e adivinharia errado na
primeira vez que alguém mudasse uma frase.

| | |
|---|---|
| `401` | token vencido ou conta desativada → mandar entrar de novo |
| `403` | vale, mas não pode isso → esconder o botão e explicar |
| `422` | a regra recusou (esgotado, prazo vencido) → mostrar o motivo |
| `400` | corpo malformado → erro de programação do cliente |
| `500` | quebrou → oferecer tentar de novo |

### O que a API NÃO aceita

`POST /api/v1/pedidos` **não tem campo de valor**. O cliente diz *o que* quer
e *como* quer pagar; quanto custa é conta do servidor, a partir do banco. Um
`curl` mal-intencionado não tem onde escrever `"total": 1`.

O mesmo vale para estoque, produto ativo e forma de pagamento: tudo conferido
dentro da regra, não na porta. **Regra que mora na porta é regra que vale só
naquela porta.**

---

## O que falta, e quanto custa

102 ações a converter. Cada uma é mecânica:

1. mover o corpo para `lib/nucleo/<assunto>.ts`, trocando `obterSessao()` por
   um parâmetro `quem`;
2. a ação vira casca: sessão + chamada + `revalidatePath`;
3. criar a rota em `app/api/v1/` quando o aplicativo precisar daquilo.

**O passo 3 é sob demanda.** Não faz sentido publicar 104 endpoints antes de
existir um aplicativo. Os passos 1 e 2 valem a pena de qualquer jeito — a
regra fora da ação é mais fácil de testar, e é o que permite o passo 3
depois sem parar nada.

Ordem sugerida, pelo que um aplicativo de aluno precisa primeiro:

1. **Aluno** (7 ações) — marcar aula assistida, entregar atividade, justificar falta
2. **Loja do aluno** — feito
3. **Professor** (18) — lançar nota, fazer chamada, criar atividade
4. **Caderno** (7) — anotações offline são o caso mais forte de app nativo
5. **Admin** (53) — o portal de coordenação é o que menos precisa de app

---

## Duas escolhas para o aplicativo

### React Native / Expo — mais rápido
Os 25 módulos de `lib/` são importados **como estão**. Uma base de código,
uma regra. O caminho mais curto para iOS e Android ao mesmo tempo.

### Swift + Kotlin nativos — melhor acabamento
Cada plataforma com a interface dela. A regra continua uma só, no servidor,
consumida por `/api/v1`. Mais trabalho de interface, zero duplicação de
regra — desde que **nenhuma regra seja reescrita no aplicativo**.

Em qualquer um dos dois: login no Supabase Auth, RLS valendo, e a API para o
que a regra precisa decidir.

---

## Antes disso: a plataforma já instala no celular

Foi acrescentado nesta entrega:

- `viewport` com `viewport-fit=cover` — em telefone com entalhe, a barra do
  sistema deixa de comer o rodapé (e é sempre o botão de enviar que fica lá);
- campos com 16px no celular — abaixo disso o iOS dá zoom sozinho ao focar um
  campo. A saída comum é **proibir o zoom**, e é a saída errada: quem enxerga
  mal fica sem poder ampliar nada;
- `manifest.webmanifest` — "adicionar à tela de início" abre em tela cheia,
  com ícone e a cor da marca, sem barra de navegador.

Não é aplicativo nativo. Mas é o que a maior parte de uma escola precisa, e
custou três arquivos.

---

## O que NÃO fazer

- **Reimplementar regra no aplicativo.** Se o app decidir sozinho se um
  módulo está aberto, um dia ele vai liberar conteúdo para quem não passou.
- **Criar uma API "de leitura" com a chave administrativa.** É assim que uma
  API que só devolveria os próprios dados começa a devolver os dos outros.
- **Devolver dado cru e deixar o cliente concluir.** O cadeado, o total e a
  média saem prontos do servidor. Três clientes concluindo por conta própria
  são três regras que divergem na primeira correção feita em uma só.
