# EAD Plataforma de Cursos Online

Plataforma de educação a distância moderna construída com Next.js, TypeScript, Tailwind CSS e Supabase.

## 🚀 Tecnologias

- **Frontend**: Next.js 15+, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Backend/Database**: Supabase
- **Autenticação**: Supabase Auth
- **Deploy**: Vercel

## 📋 Funcionalidades

- ✅ Catálogo de cursos
- ✅ Autenticação de usuários
- ✅ Perfil de alunos
- ✅ Progresso dos cursos
- ✅ Sistema de avaliações
- ✅ Certificados
- ✅ Dashboard de instrutores

## 🛠️ Instalação

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Setup

1. Clone o repositório
```bash
git clone https://github.com/igrejabatistadoavivamentoibau-sudo/ead-platform-cursos-online.git
cd ead-platform-cursos-online
```

2. Instale as dependências
```bash
npm install
```

3. Configure as variáveis de ambiente
```bash
cp .env.local.example .env.local
```

Preencha com seus dados:
- `NEXT_PUBLIC_SUPABASE_URL`: URL do seu projeto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço do Supabase

4. Execute o servidor de desenvolvimento
```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 📦 Estrutura do Projeto

```
ead-platform-cursos-online/
├── app/
│   ├── api/               # API Routes
│   │   ├── auth/
│   │   ├── courses/
│   │   └── users/
│   ├── page.tsx           # Página inicial
│   └── layout.tsx         # Layout global
├── components/
│   ├── Header/
│   ├── Footer/
│   ├── CourseCard/
│   └── Auth/
├── lib/
│   └── supabase/          # Clientes Supabase
├── public/
└── styles/
```

## 🔌 API Endpoints

### Cursos
- `GET /api/courses` - Listar todos os cursos
- `GET /api/courses/:id` - Detalhes de um curso
- `POST /api/courses` - Criar novo curso (admin)
- `PUT /api/courses/:id` - Atualizar curso (admin)

### Usuários
- `GET /api/users/profile` - Perfil do usuário autenticado
- `PUT /api/users/profile` - Atualizar perfil
- `GET /api/users/:id/courses` - Cursos do usuário

## 🗄️ Schema Supabase

### Tabelas Principais
- `users` - Usuários da plataforma
- `courses` - Catálogo de cursos
- `enrollments` - Inscrições de alunos
- `lessons` - Aulas dos cursos
- `progress` - Progresso dos alunos
- `certificates` - Certificados emitidos

## 🤝 Contribuição

1. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
2. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
3. Push para a branch (`git push origin feature/AmazingFeature`)
4. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT.

## 📧 Contato

Para dúvidas ou sugestões, entre em contato via email.
