'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={`inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50 ${className}`}
    >
      <LogOut className="h-4 w-4" strokeWidth={2} />
      {loading ? 'Saindo...' : 'Sair'}
    </button>
  )
}
