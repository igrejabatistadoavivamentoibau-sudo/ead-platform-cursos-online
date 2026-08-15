import { createClient } from '@/lib/supabase/server'
import { exigirPermissao } from '@/lib/auth'
import PermissoesManager, { type UsuarioPermissao } from '@/components/Dashboard/PermissoesManager'

export default async function PermissoesPage() {
  await exigirPermissao('gerenciar_usuarios')
  const supabase = await createClient()

  const { data: usuarios } = await supabase
    .from('users')
    .select('id, name, email, role, permissoes')
    .order('name')

  return (
    <div className="p-5 sm:p-8">
      <div className="mb-7 animate-float-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Permissões</h1>
        <p className="text-gray-500 mt-1.5">
          Defina exatamente o que cada professor pode ver e editar dentro da plataforma.
        </p>
      </div>

      <PermissoesManager usuarios={(usuarios ?? []) as UsuarioPermissao[]} />
    </div>
  )
}
