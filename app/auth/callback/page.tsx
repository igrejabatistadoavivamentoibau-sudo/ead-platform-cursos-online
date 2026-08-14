'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const finishLogin = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !data.session) {
        setError('Não foi possível concluir o login. Tente novamente.')
        return
      }

      const userId = data.session.user.id

      const { data: userData } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', userId)
        .single()

      if (!userData) {
        // Login OAuth de usuário sem perfil cadastrado na tabela `users` ainda.
        router.push('/')
        return
      }

      const dashboardByRole: Record<string, string> = {
        aluno: '/dashboard/student',
        professor: '/dashboard/teacher',
        admin: '/dashboard/admin',
      }

      router.push(dashboardByRole[userData.role] ?? '/')
      router.refresh()
    }

    finishLogin()
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <p className="text-gray-500">Concluindo login...</p>
        )}
      </div>
    </div>
  )
}
