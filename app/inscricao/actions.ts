'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Envio de inscrição pública.
 *
 * Esta é a ÚNICA ação da plataforma que roda sem ninguém autenticado, então
 * ela é deliberadamente estreita: valida tudo, não confia em nada que veio
 * da tela, e não concede acesso a coisa alguma.
 *
 * A conta de acesso é criada aqui, com a senha que a própria pessoa
 * escolheu — a senha vai direto para o sistema de autenticação e nunca
 * passa pelo nosso banco. Mas a pessoa ainda NÃO entra: quem libera o
 * acesso é o perfil em public.users, criado apenas quando o administrador
 * aprova. Até lá o login responde "sua conta ainda não foi liberada".
 *
 * Esse desenho evita o erro clássico de guardar senha em tabela de
 * pré-cadastro, que seria um vazamento esperando para acontecer.
 */
export async function enviarInscricao(input: {
  nome: string
  email: string
  telefone?: string
  senha: string
  papel: 'aluno' | 'professor'
  turmaId?: string
  mensagem?: string
  respostas?: Record<string, string>
}) {
  const admin = createAdminClient()

  const nome = input.nome?.trim()
  const email = input.email?.trim().toLowerCase()
  const senha = input.senha ?? ''

  if (!nome || nome.length < 3) throw new Error('Escreva seu nome completo.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('E-mail inválido.')
  if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
  if (input.papel !== 'aluno' && input.papel !== 'professor') {
    throw new Error('Tipo de inscrição inválido.')
  }

  // Já existe inscrição esperando decisão para este e-mail?
  const { data: pendente } = await admin
    .from('inscricoes')
    .select('id')
    .eq('email', email)
    .eq('status', 'pendente')
    .maybeSingle()
  if (pendente) {
    throw new Error('Já existe uma inscrição em análise para este e-mail. Aguarde o retorno.')
  }

  // Já é uma pessoa liberada na plataforma?
  const { data: jaTemPerfil } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (jaTemPerfil) {
    throw new Error('Este e-mail já tem acesso à plataforma. Use a tela de entrar.')
  }

  // A turma escolhida precisa estar realmente aberta — não basta ter vindo
  // no formulário. Quem manda é o banco, não a tela.
  let turmaId: string | null = null
  if (input.turmaId) {
    const { data: turma } = await admin
      .from('turmas')
      .select('id')
      .eq('id', input.turmaId)
      .eq('inscricoes_abertas', true)
      .maybeSingle()
    if (!turma) throw new Error('Essa turma não está mais aberta para inscrição.')
    turmaId = turma.id
  }

  // Guardamos apenas respostas de perguntas que existem e estão ativas —
  // assim ninguém consegue injetar dados forjando o formulário.
  const { data: campos } = await admin
    .from('campos_inscricao')
    .select('id, rotulo, obrigatorio, papel')
    .eq('ativo', true)

  const validos = (campos ?? []).filter(
    (c) => c.papel === 'ambos' || c.papel === input.papel
  )
  const respostas: Record<string, { pergunta: string; resposta: string }> = {}
  for (const c of validos) {
    const valor = input.respostas?.[c.id]?.trim()
    if (!valor) {
      if (c.obrigatorio) throw new Error(`Preencha: ${c.rotulo}`)
      continue
    }
    respostas[c.id] = { pergunta: c.rotulo, resposta: valor.slice(0, 500) }
  }

  const { data: criado, error: erroConta } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { name: nome },
  })

  if (erroConta) {
    if (/already been registered|already exists/i.test(erroConta.message)) {
      throw new Error('Este e-mail já foi usado. Se você já se inscreveu, aguarde a liberação.')
    }
    throw new Error(erroConta.message)
  }

  const { error: erroInscricao } = await admin.from('inscricoes').insert({
    user_id: criado.user.id,
    nome,
    email,
    telefone: input.telefone?.trim() || null,
    papel: input.papel,
    turma_id: turmaId,
    mensagem: input.mensagem?.trim() || null,
    respostas,
  })

  if (erroInscricao) {
    // Sem a inscrição registrada, a conta ficaria órfã e invisível para o
    // administrador. Melhor desfazer do que deixar lixo no sistema.
    await admin.auth.admin.deleteUser(criado.user.id)
    throw new Error(erroInscricao.message)
  }

  revalidatePath('/dashboard/admin/inscricoes')
  return { ok: true }
}
