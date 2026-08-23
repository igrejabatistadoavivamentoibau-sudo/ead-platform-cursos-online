'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tipoAceito, linkSeguro, TAMANHO_MAXIMO_MATERIAL, EXTENSAO_PADRAO } from '@/lib/materiais'

export type Resultado<T = unknown> =
  | ({ ok: true } & (T extends object ? T : object))
  | { ok: false; erro: string }

/* ============================================================
   MATERIAL DA AULA — ENVIAR, LISTAR E TIRAR

   O ARQUIVO NÃO PASSA POR AQUI. Ele vai do navegador direto para o
   armazenamento, e o servidor só participa das pontas: autoriza o envio e
   registra o material depois. É o mesmo caminho das entregas de atividade,
   e pelo mesmo motivo — a Vercel recusa requisição acima de ~4,5 MB e uma
   ação de servidor é limitada a 1 MB. Mandar uma apostila de 8 MB "por
   dentro" do servidor falharia calada em todo envio de verdade.
   ============================================================ */

async function exigirEquipe(): Promise<{ id: string } | null> {
  const session = await createSessionClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return null

  const { data } = await session.from('users').select('role, ativo').eq('id', user.id).single()
  if (!data || data.ativo === false) return null
  return data.role === 'professor' || data.role === 'admin' ? { id: user.id } : null
}

const SEM_PERMISSAO = {
  ok: false as const,
  erro: 'Só professores e a coordenação podem mexer no material da aula.',
}

/**
 * Autoriza o envio e devolve o caminho onde o arquivo deve ser gravado.
 *
 * O caminho é montado AQUI, e não no navegador: assim ninguém consegue
 * gravar um arquivo por cima do material de outra aula escolhendo o nome.
 */
export async function autorizarEnvioDeMaterial(
  aulaId: string,
  tipo: string,
  tamanho: number
): Promise<Resultado<{ path: string }>> {
  const quem = await exigirEquipe()
  if (!quem) return SEM_PERMISSAO

  if (!tipoAceito(tipo)) {
    return {
      ok: false,
      erro: 'Formato não aceito. Envie PDF, imagem, Word, slides ou áudio.',
    }
  }
  if (tamanho > TAMANHO_MAXIMO_MATERIAL) {
    return {
      ok: false,
      erro: `Este arquivo tem ${(tamanho / 1024 / 1024).toFixed(1)} MB e o limite é 25 MB. Para algo maior, use o campo de link.`,
    }
  }

  const admin = createAdminClient()
  const { data: aula } = await admin.from('aulas').select('id').eq('id', aulaId).maybeSingle()
  if (!aula) return { ok: false, erro: 'Esta aula não existe mais.' }

  const extensao = EXTENSAO_PADRAO[tipo] ?? 'bin'
  const nome = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extensao}`
  return { ok: true, path: `${aulaId}/${nome}` }
}

export async function registrarMaterial(dados: {
  aulaId: string
  titulo: string
  descricao?: string
  path?: string
  url?: string
  tamanho?: number
  formato?: string
}): Promise<Resultado> {
  const quem = await exigirEquipe()
  if (!quem) return SEM_PERMISSAO

  const titulo = (dados.titulo ?? '').trim()
  if (!titulo) return { ok: false, erro: 'Dê um nome ao material.' }

  const admin = createAdminClient()

  if (dados.url) {
    const url = linkSeguro(dados.url)
    if (!url) return { ok: false, erro: 'Esse link não parece válido. Ele deve começar com https://' }

    const { error } = await admin.from('materiais').insert({
      aula_id: dados.aulaId,
      titulo,
      descricao: (dados.descricao ?? '').trim() || null,
      tipo: 'link',
      url,
      enviado_por: quem.id,
      ordem: await proximaOrdem(admin, dados.aulaId),
    })
    if (error) return { ok: false, erro: error.message }
  } else {
    if (!dados.path) return { ok: false, erro: 'O arquivo não chegou ao armazenamento.' }
    // O caminho é sempre `<aula>/<arquivo>`, gerado pelo servidor. Conferimos
    // de novo para ninguém pendurar num lugar que não é desta aula.
    if (!dados.path.startsWith(`${dados.aulaId}/`)) {
      return { ok: false, erro: 'Caminho de arquivo inválido.' }
    }

    const { error } = await admin.from('materiais').insert({
      aula_id: dados.aulaId,
      titulo,
      descricao: (dados.descricao ?? '').trim() || null,
      tipo: 'arquivo',
      path: dados.path,
      tamanho: dados.tamanho ?? null,
      formato: dados.formato ?? null,
      enviado_por: quem.id,
      ordem: await proximaOrdem(admin, dados.aulaId),
    })
    if (error) return { ok: false, erro: error.message }
  }

  recarregar()
  return { ok: true }
}

export async function removerMaterial(id: string): Promise<Resultado> {
  if (!(await exigirEquipe())) return SEM_PERMISSAO
  const admin = createAdminClient()

  const { data: material } = await admin
    .from('materiais')
    .select('path')
    .eq('id', id)
    .maybeSingle()

  const { error } = await admin.from('materiais').delete().eq('id', id)
  if (error) return { ok: false, erro: error.message }

  // O banco apaga a linha; o arquivo em si não some sozinho.
  if (material?.path) await admin.storage.from('materiais').remove([material.path as string])

  recarregar()
  return { ok: true }
}

/**
 * O link para abrir o material.
 *
 * O armazenamento é fechado, então o endereço é assinado e vale por uma
 * hora. Um bucket público resolveria com menos código e deixaria a
 * apostila da escola acessível a quem descobrisse o endereço — inclusive
 * fora da igreja.
 */
export async function linkDoMaterial(id: string): Promise<Resultado<{ url: string }>> {
  const session = await createSessionClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return { ok: false, erro: 'Entre de novo para abrir o material.' }

  const admin = createAdminClient()
  const { data: material } = await admin
    .from('materiais')
    .select('tipo, path, url, publicado')
    .eq('id', id)
    .maybeSingle()

  if (!material || material.publicado === false) {
    return { ok: false, erro: 'Este material não está disponível.' }
  }
  if (material.tipo === 'link') return { ok: true, url: material.url as string }

  const { data, error } = await admin.storage
    .from('materiais')
    .createSignedUrl(material.path as string, 60 * 60)

  if (error || !data) return { ok: false, erro: 'Não consegui abrir o arquivo agora.' }
  return { ok: true, url: data.signedUrl }
}

async function proximaOrdem(admin: ReturnType<typeof createAdminClient>, aulaId: string) {
  const { data } = await admin
    .from('materiais')
    .select('ordem')
    .eq('aula_id', aulaId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (Number(data?.ordem) || 0) + 1
}

function recarregar() {
  revalidatePath('/dashboard/aluno/cursos', 'layout')
  revalidatePath('/dashboard/admin/cursos', 'layout')
  revalidatePath('/dashboard/professor/cursos', 'layout')
}
