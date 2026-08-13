# Criar Usuários de Teste

Para testar a plataforma, você precisa criar usuários no Supabase.

## Opção 1: SQL Editor do Supabase (Recomendado)

1. Vá para seu projeto Supabase
2. Clique em **"SQL Editor"** 
3. Clique em **"New Query"**
4. Execute este comando para criar os usuários:

```sql
-- Usuário 1: Aluno de teste
INSERT INTO users (email, name, role, created_at, updated_at)
VALUES (
  'aluno@ibau.com',
  'João Silva (Aluno)',
  'student',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Usuário 2: Professor de teste
INSERT INTO users (email, name, role, created_at, updated_at)
VALUES (
  'professor@ibau.com',
  'Maria Santos (Professora)',
  'teacher',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Usuário 3: Diretor de teste
INSERT INTO users (email, name, role, created_at, updated_at)
VALUES (
  'diretor@ibau.com',
  'Pedro Costa (Diretor)',
  'director',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;
```

## Opção 2: Criar via Auth do Supabase

1. Vá para **"Authentication"** → **"Users"**
2. Clique em **"Add user"**
3. Preencha:
   - Email: `aluno@ibau.com`
   - Password: `teste123`
4. Depois atualize a tabela `users` com o role e nome

## Usuários de Teste

### Aluno
- **Email**: `aluno@ibau.com`
- **Senha**: `teste123`
- **Role**: `student`
- **Nome**: João Silva (Aluno)

### Professor
- **Email**: `professor@ibau.com`
- **Senha**: `teste123`
- **Role**: `teacher`
- **Nome**: Maria Santos (Professora)

### Diretor
- **Email**: `diretor@ibau.com`
- **Senha**: `teste123`
- **Role**: `director`
- **Nome**: Pedro Costa (Diretor)

---

## ⚠️ IMPORTANTE

Esses usuários são **APENAS PARA TESTE**. 

Quando estiver pronto para produção:
1. Remova esses usuários de teste
2. Crie um usuário admin real
3. Configure senhas fortes
4. Considere usar autenticação por convite/código

---

## Testando o Login

Depois de criar os usuários:

1. Vá para `https://plataforma-read-cursos-online.vercel.app/auth/login`
2. Teste com `aluno@ibau.com` / `teste123`
3. Você deve ser redirecionado para `/dashboard/student`
4. Teste com `professor@ibau.com` / `teste123`
5. Você deve ser redirecionado para `/dashboard/teacher`
