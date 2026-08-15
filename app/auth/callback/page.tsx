'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const DASHBOARD_POR_PAPEL: Record<string, string> = {
  aluno: '/dashboard/aluno',
  professor: '/dashboard/professor',
  admin: '/dashboard/admin',
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const concluirLogin = async () => {
      const {
        data: { user },
        error: sessionError,
      } = await supabase.auth.getUser()

      if (sessionError || !user) {
        setError('Não foi possível concluir o login. Tente novamente.')
        return
      }

      // Papel vem do token — sem consulta extra ao banco.
      const role = user.app_metadata?.role as string | undefined
      const destino = role ? DASHBOARD_POR_PAPEL[role] : undefined

      if (!destino) {
        await supabase.auth.signOut()
        setError('Esta conta ainda não foi liberada. Fale com a administração.')
        return
      }

      router.push(destino)
      router.refresh()
    }

    concluirLogin()
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50/50 via-white to-brand-50/30 px-4">
      <div className="text-center">
        {error ? (
          <div className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm max-w-sm">
            <AlertCircle className="h-[18px] w-[18px] shrink-0 mt-px" strokeWidth={2.25} />
            <span className="text-left">{error}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <Loader2 className="h-7 w-7 animate-spin text-brand-600" strokeWidth={2} />
            <p>Concluindo login...</p>
          </div>
        )}
      </div>
    </div>
  )
}
