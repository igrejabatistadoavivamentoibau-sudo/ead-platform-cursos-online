import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CourseCard from '@/components/CourseCard'
import Link from 'next/link'

export default function Home() {
  // Dados de exemplo - depois virão do Supabase
  const featuredCourses = [
    {
      id: '1',
      title: 'React Avançado',
      description: 'Aprenda React do zero até conceitos avançados',
      image: '/images/course-placeholder.jpg',
      instructor: 'João Silva',
      students: 1250,
      price: 99.90,
    },
    {
      id: '2',
      title: 'Node.js Completo',
      description: 'Desenvolvendo aplicações backend com Node.js',
      image: '/images/course-placeholder.jpg',
      instructor: 'Maria Santos',
      students: 980,
      price: 89.90,
    },
    {
      id: '3',
      title: 'TypeScript Essencial',
      description: 'Tipagem estática em JavaScript com TypeScript',
      image: '/images/course-placeholder.jpg',
      instructor: 'Pedro Costa',
      students: 650,
      price: 79.90,
    },
  ]

  return (
    <>
      <Header />
      
      <main className="min-h-screen">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl font-bold mb-6">Bem-vindo ao EAD Cursos</h1>
            <p className="text-xl mb-8 text-blue-100">
              Aprenda novas habilidades com os melhores instrutores do mercado
            </p>
            <Link
              href="/courses"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition inline-block"
            >
              Explorar Cursos
            </Link>
          </div>
        </section>

        {/* Cursos em Destaque */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-gray-800 mb-12">Cursos em Destaque</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredCourses.map((course) => (
              <CourseCard key={course.id} {...course} />
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link
              href="/courses"
              className="text-blue-600 font-bold hover:text-blue-700 text-lg"
            >
              Ver todos os cursos →
            </Link>
          </div>
        </section>

        {/* Estatísticas */}
        <section className="bg-gray-100 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">500+</div>
                <p className="text-gray-600">Cursos Disponíveis</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">50k+</div>
                <p className="text-gray-600">Alunos Ativos</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">100+</div>
                <p className="text-gray-600">Instrutores Qualificados</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
