import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'

export default function Home() {
  return (
    <>
      <Header />
      
      <main className="min-h-screen">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl font-bold mb-6">Bem-vindo à Escola de Líderes IBAU</h1>
            <p className="text-xl mb-8 text-blue-100">
              Desenvolvendo líderes cristãos comprometidos com a visão de Deus
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/auth/login"
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition inline-block"
              >
                Acessar Plataforma
              </Link>
              <a
                href="#sobre"
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-bold hover:bg-white hover:text-blue-600 transition inline-block"
              >
                Saiba Mais
              </a>
            </div>
          </div>
        </section>

        {/* Sobre */}
        <section id="sobre" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-gray-800 mb-12 text-center">Sobre a Plataforma</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-blue-50 p-8 rounded-lg">
              <div className="text-4xl text-blue-600 mb-4">📚</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Conteúdo Estruturado</h3>
              <p className="text-gray-600">
                Aulas bem organizadas com vídeos, textos e materiais complementares para seu aprendizado.
              </p>
            </div>

            <div className="bg-blue-50 p-8 rounded-lg">
              <div className="text-4xl text-blue-600 mb-4">👥</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Comunidade de Líderes</h3>
              <p className="text-gray-600">
                Conecte-se com outros líderes em formação e compartilhe experiências e conhecimentos.
              </p>
            </div>

            <div className="bg-blue-50 p-8 rounded-lg">
              <div className="text-4xl text-blue-600 mb-4">🏆</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Certificação</h3>
              <p className="text-gray-600">
                Receba certificados ao completar o curso e comprove sua formação em liderança cristã.
              </p>
            </div>
          </div>
        </section>

        {/* Estatísticas */}
        <section className="bg-gray-100 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">20+</div>
                <p className="text-gray-600">Aulas Completas</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">150+</div>
                <p className="text-gray-600">Alunos Ativos</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">10+</div>
                <p className="text-gray-600">Instrutores Dedicados</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-blue-600 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-6">Pronto para começar sua jornada?</h2>
            <p className="text-xl mb-8 text-blue-100">
              Acesse a plataforma e comece a aprender hoje mesmo
            </p>
            <Link
              href="/auth/login"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition inline-block"
            >
              Acessar Plataforma
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
