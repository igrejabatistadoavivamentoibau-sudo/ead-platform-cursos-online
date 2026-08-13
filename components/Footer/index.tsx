'use client'

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-8 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-4">EAD Cursos</h3>
            <p className="text-gray-400">
              Plataforma de educação a distância com os melhores cursos online.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4">Links Rápidos</h3>
            <ul className="text-gray-400 space-y-2">
              <li><a href="/" className="hover:text-white">Início</a></li>
              <li><a href="/courses" className="hover:text-white">Cursos</a></li>
              <li><a href="/about" className="hover:text-white">Sobre</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4">Contato</h3>
            <p className="text-gray-400">
              Email: contato@eadcursos.com<br />
              Telefone: (11) 9999-9999
            </p>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; 2026 EAD Cursos. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
