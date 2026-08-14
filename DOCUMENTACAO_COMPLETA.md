# 📚 DOCUMENTAÇÃO COMPLETA - Escola de Líderes IBAU

## 🔑 ACESSOS E CREDENCIAIS

### GitHub
- **Organização**: `igrejabatistadoavivamentoibau-sudo`
- **Repositório**: `ead-platform-cursos-online`
- **URL**: https://github.com/igrejabatistadoavivamentoibau-sudo/ead-platform-cursos-online

### Vercel (PRODUÇÃO)
- **URL da Plataforma**: https://ead-platform-cursos-online-insr.vercel.app
- **Dashboard**: https://vercel.com/dashboard
- **Projeto**: `ead-platform-cursos-online-insr`

### Supabase (BANCO DE DADOS)
- **Projeto**: `plataforma-ibauead`
- **URL**: https://qsrmmuasvrxwosxnfpq.supabase.co
- **Dashboard**: https://app.supabase.com

---

## 👥 USUÁRIOS DE TESTE (CRIAR NO SUPABASE)

### Passos para criar usuários:
1. Vá em: https://app.supabase.com
2. Clique no projeto `plataforma-ibauead`
3. Vá em **Authentication** → **Users** → **Add user**
4. Crie os 3 usuários abaixo:

| Email | Senha | Tipo |
|-------|-------|------|
| aluno@ibau.com | teste123 | Aluno |
| professor@ibau.com | teste123 | Professor |
| diretor@ibau.com | teste123 | Diretor |

---

## 🛠 STACK TECNOLÓGICO

- **Frontend**: Next.js 14.2.3
- **Styling**: Tailwind CSS 3.4.1
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Language**: TypeScript

---

## 📁 ESTRUTURA DO PROJETO

```
ead-platform-cursos-online/
├── app/
│   ├── page.tsx                    # Página inicial
│   ├── auth/login/page.tsx         # Página de login
│   ├── dashboard/student/page.tsx  # Dashboard aluno
│   ├── dashboard/teacher/page.tsx  # Dashboard professor
│   ├── layout.tsx                  # Layout global
│   └── globals.css                 # Estilos globais
├── components/
│   ├── Auth/LoginForm.tsx          # Formulário de login
│   ├── Header/index.tsx            # Cabeçalho
│   └── Footer/index.tsx            # Rodapé
├── lib/
│   ├── supabase/client.ts          # Cliente Supabase (browser)
│   └── supabase/server.ts          # Cliente Supabase (server)
├── public/
│   └── ibau-logo.png               # Logo IBAU
├── vercel.json                     # Configuração Vercel
├── next.config.js                  # Configuração Next.js
├── tailwind.config.ts              # Configuração Tailwind
└── package.json                    # Dependências
```

---

## 🌐 VARIÁVEIS DE AMBIENTE (.env.local)

Peça os valores em: https://app.supabase.com (seu projeto)

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
NEXT_PUBLIC_APP_NAME=EAD Cursos Online
NEXT_PUBLIC_APP_URL=https://ead-platform-cursos-online-insr.vercel.app
```

---

## 📊 BANCO DE DADOS (Supabase)

### Tabelas criadas:
- `users` - Usuários do sistema
- `courses` - Cursos disponíveis
- `lessons` - Aulas dos cursos
- `enrollments` - Inscrições de alunos
- `progress` - Progresso do aluno
- `certificates` - Certificados
- `reviews` - Avaliações

---

## 🚀 COMO FAZER DEPLOY

### No Vercel:
1. Faça push no branch `main` do GitHub
2. O Vercel faz deploy automático
3. A URL é: https://ead-platform-cursos-online-insr.vercel.app

### Comando local para testar:
```bash
npm run build
npm run start
```

---

## 🔗 FLUXO DE ACESSO

1. **Página Inicial**: https://ead-platform-cursos-online-insr.vercel.app
2. **Login**: https://ead-platform-cursos-online-insr.vercel.app/auth/login
3. **Dashboard Aluno**: https://ead-platform-cursos-online-insr.vercel.app/dashboard/student
4. **Dashboard Professor**: https://ead-platform-cursos-online-insr.vercel.app/dashboard/teacher

---

## 📝 COMMITS IMPORTANTES

- **fad5bf0**: Clean slate - código original que funciona com logo IBAU
- **2cd6c40**: Logo IBAU real adicionada
- **24089f1**: Página inicial com cores verde

---

## ⚠️ NOTAS IMPORTANTES

1. **Vercel tem auto-deploy**: Qualquer push no GitHub dispara deploy automático
2. **Supabase RLS**: Certifique-se de que as políticas estão corretas
3. **Environment Variables**: As 3 variáveis Supabase precisam estar no Vercel
4. **Logo IBAU**: Arquivo `public/ibau-logo.png` é essencial

---

Gerado em: 13 de Agosto de 2026
