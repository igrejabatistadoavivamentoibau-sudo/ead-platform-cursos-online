import { createClient } from '@/lib/supabase/server'
import CarrosselManager from '@/components/Dashboard/CarrosselManager'
import type { SlideDB } from '@/lib/slides'

export default async function CarrosselPage() {
  const supabase = await createClient()

  const { data: slides } = await supabase
    .from('slides')
    .select('id, titulo, image_path, ordem, ativo')
    .order('ordem', { ascending: true })

  return (
    <div className="p-5 sm:p-8">
      <div className="mb-7 animate-float-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Fotos da capa</h1>
        <p className="text-gray-500 mt-1.5">
          Gerencie as fotos que passam no banner da página inicial — da igreja, das aulas, dos
          encontros.
        </p>
      </div>

      <CarrosselManager slides={(slides ?? []) as SlideDB[]} />
    </div>
  )
}
