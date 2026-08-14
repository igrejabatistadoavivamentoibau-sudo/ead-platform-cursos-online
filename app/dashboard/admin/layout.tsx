import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/Dashboard/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  // Segunda camada de proteção — o middleware já cuida disso, mas nunca é
  // demais confirmar de novo no próprio layout.
  if (profile?.role !== 'admin') redirect('/auth/login')

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <AdminNav name={profile.name} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
