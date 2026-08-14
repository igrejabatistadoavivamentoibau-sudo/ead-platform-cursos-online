import Link from 'next/link'
import { BookOpenText, Users2, Award, GraduationCap, Presentation, ArrowRight } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Reveal from '@/components/Reveal'
import HeroCarousel from '@/components/Home/HeroCarousel'

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

export default function Home() {
  return (
    <>
      <Header />

      <main className="min-h-screen">
        {/* Hero com carrossel */}
        <section className="relative h-[560px] sm:h-[620px] md:h-[680px] overflow-hidden">
          <HeroCarousel />

          <div className="relative z-10 h-full flex items-center pointer-events-none">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="max-w-2xl pointer-events-auto">
                <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-5">
                  Bem-vindo à Escola de Líderes IBAU
                </h1>
                <p className="text-lg sm:text-xl text-green-50/90 mb-9 leading-relaxed">
                  Desenvolvendo líderes cristãos comprometidos com a visão de Deus.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center gap-2 bg-white text-green-800 px-7 py-3.5 rounded-xl font-semibold hover:bg-green-50 active:bg-green-100 transition-colors shadow-lg shadow-black/10"
                  >
                    Acessar Plataforma
                    <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  </Link>
                  <a
                    href="#sobre"
                    className="inline-flex items-center gap-2 border border-white/50 text-white px-7 py-3.5 rounded-xl font-semibold hover:bg-white/10 transition-colors backdrop-blur-sm"
                  >
                    Saiba mais
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sobre */}
        <section id="sobre" className="scroll-mt-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block text-sm font-semibold text-green-700 tracking-wide uppercase mb-3">
              Sobre a plataforma
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              Tudo que você precisa para crescer como líder
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 120}>
                <div className="group h-full bg-white p-8 rounded-2xl ring-1 ring-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700 mb-5 group-hover:bg-green-700 group-hover:text-white transition-colors duration-300">
                    <feature.icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2.5">{feature.title}</h3>
                  <p className="text-gray-500 leading-relaxed text-[15px]">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Números */}
        <section id="numeros" className="scroll-mt-16 bg-green-50/60 py-20 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
              {stats.map((stat, i) => (
                <Reveal key={stat.label} delay={i * 120} className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-green-700 ring-1 ring-green-100 shadow-sm">
                    <stat.icon className="h-7 w-7" strokeWidth={2} />
                  </div>
                  <div className="text-4xl font-bold text-green-800 mb-1.5 tracking-tight">
                    {stat.value}
                  </div>
                  <p className="text-gray-500 font-medium">{stat.label}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 py-20 sm:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.1),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(0,0,0,0.15),transparent_50%)]" />
          <Reveal className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-5">
              Pronto para começar sua jornada?
            </h2>
            <p className="text-lg text-green-50/90 mb-9 max-w-xl mx-auto">
              Acesse a plataforma e comece a aprender hoje mesmo.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 bg-white text-green-800 px-8 py-3.5 rounded-xl font-semibold hover:bg-green-50 transition-colors shadow-lg shadow-black/10"
            >
              Acessar Plataforma
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </Link>
          </Reveal>
        </section>
      </main>

      <Footer />
    </>
  )
}
