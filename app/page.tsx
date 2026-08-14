import Link from 'next/link'
import { BookOpenText, Users2, Award, GraduationCap, Presentation, ArrowRight, Sparkles } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Reveal from '@/components/Reveal'
import HeroCarousel, { type CarouselSlide } from '@/components/Home/HeroCarousel'
import { createClient } from '@/lib/supabase/server'
import { urlDaFoto } from '@/lib/slides'

// Revalida a cada 5 min: a home fica rápida (servida do cache) mas as
// fotos novas cadastradas pelo admin aparecem sozinhas. As Server Actions
// de slide também chamam revalidatePath('/'), então na prática a troca
// é imediata — isso aqui é só uma rede de segurança.
export const revalidate = 300

const features = [
  {
    icon: BookOpenText,
    title: 'Conteúdo Estruturado',
    description:
      'Aulas bem organizadas com vídeos, textos e materiais complementares para o seu aprendizado.',
  },
  {
    icon: Users2,
    title: 'Comunidade de Líderes',
    description:
      'Conecte-se com outros líderes em formação e compartilhe experiências e conhecimento.',
  },
  {
    icon: Award,
    title: 'Certificação',
    description:
      'Receba certificados ao completar o curso e comprove sua formação em liderança cristã.',
  },
]

const stats = [
  { icon: BookOpenText, value: '20+', label: 'Aulas completas' },
  { icon: GraduationCap, value: '150+', label: 'Alunos ativos' },
  { icon: Presentation, value: '10+', label: 'Instrutores dedicados' },
]

export default async function Home() {
  const supabase = await createClient()

  const { data: slidesDB } = await supabase
    .from('slides')
    .select('id, titulo, image_path')
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  const slides: CarouselSlide[] = (slidesDB ?? []).map((s) => ({
    id: s.id,
    titulo: s.titulo,
    url: urlDaFoto(s.image_path),
  }))

  return (
    <>
      <Header />

      <main className="min-h-screen">
        {/* ===== Hero com carrossel ===== */}
        <section className="relative h-[580px] sm:h-[640px] md:h-[700px] overflow-hidden">
          <HeroCarousel slides={slides} />

          <div className="relative z-10 h-full flex items-center pointer-events-none">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="max-w-2xl pointer-events-auto animate-float-in">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-3.5 py-1.5 text-[13px] font-medium text-brand-50 ring-1 ring-white/20 mb-6">
                  <Sparkles className="h-3.5 w-3.5 text-accent-400" strokeWidth={2.25} />
                  Igreja Batista do Avivamento
                </span>

                <h1 className="text-4xl sm:text-5xl md:text-[3.4rem] font-extrabold text-white leading-[1.08] mb-5">
                  Bem-vindo à Escola de{' '}
                  <span className="bg-gradient-to-r from-white via-brand-100 to-accent-300 bg-clip-text text-transparent">
                    Líderes IBAU
                  </span>
                </h1>

                <p className="text-lg sm:text-xl text-brand-50/90 mb-9 leading-relaxed max-w-xl">
                  Desenvolvendo líderes cristãos comprometidos com a visão de Deus.
                </p>

                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/auth/login"
                    className="group inline-flex items-center gap-2 bg-white text-brand-800 px-7 py-3.5 rounded-2xl font-semibold hover:bg-brand-50 active:scale-[0.98] transition-all duration-300 shadow-deep hover:shadow-glow"
                  >
                    Acessar Plataforma
                    <ArrowRight
                      className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1"
                      strokeWidth={2.25}
                    />
                  </Link>
                  <a
                    href="#sobre"
                    className="inline-flex items-center gap-2 border border-white/40 text-white px-7 py-3.5 rounded-2xl font-semibold hover:bg-white/10 hover:border-white/60 active:scale-[0.98] transition-all duration-300 backdrop-blur-md"
                  >
                    Saiba mais
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Sobre ===== */}
        <section
          id="sobre"
          className="relative scroll-mt-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28"
        >
          {/* Brilho decorativo de fundo */}
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-64 w-[36rem] rounded-full bg-brand-100/40 blur-3xl" />

          <Reveal className="relative text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block text-sm font-bold text-brand-600 tracking-widest uppercase mb-3">
              Sobre a plataforma
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Tudo que você precisa para crescer como líder
            </h2>
          </Reveal>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 120}>
                <div className="card-alive card-sheen group h-full p-8 overflow-hidden">
                  {/* Faixa colorida que aparece no topo ao passar o mouse */}
                  <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />

                  <div className="icon-pop flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 mb-5 group-hover:from-brand-600 group-hover:to-brand-500 group-hover:text-white group-hover:shadow-glow">
                    <feature.icon className="h-7 w-7" strokeWidth={1.85} />
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-2.5 transition-colors duration-300 group-hover:text-brand-800">
                    {feature.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed text-[15px]">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ===== Números ===== */}
        <section
          id="numeros"
          className="relative scroll-mt-16 overflow-hidden bg-gradient-to-b from-brand-50/70 via-white to-brand-50/40 py-20 sm:py-28"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {stats.map((stat, i) => (
                <Reveal key={stat.label} delay={i * 120}>
                  <div className="card-alive group h-full text-center p-8">
                    <div className="icon-pop mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-brand-600 ring-1 ring-brand-100 shadow-card group-hover:bg-gradient-to-br group-hover:from-brand-600 group-hover:to-brand-500 group-hover:text-white group-hover:ring-brand-500">
                      <stat.icon className="h-8 w-8" strokeWidth={1.75} />
                    </div>
                    <div className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-br from-brand-700 to-brand-500 bg-clip-text text-transparent mb-2">
                      {stat.value}
                    </div>
                    <p className="text-gray-500 font-medium">{stat.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA final ===== */}
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 py-20 sm:py-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(0,0,0,0.2),transparent_50%)]" />
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent-400/10 blur-3xl" />

          <Reveal className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5">
              Pronto para começar sua jornada?
            </h2>
            <p className="text-lg text-brand-50/90 mb-9 max-w-xl mx-auto">
              Acesse a plataforma e comece a aprender hoje mesmo.
            </p>
            <Link
              href="/auth/login"
              className="group inline-flex items-center gap-2 bg-white text-brand-800 px-8 py-4 rounded-2xl font-semibold hover:bg-brand-50 active:scale-[0.98] transition-all duration-300 shadow-deep"
            >
              Acessar Plataforma
              <ArrowRight
                className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2.25}
              />
            </Link>
          </Reveal>
        </section>
      </main>

      <Footer />
    </>
  )
}
