# Setup Supabase - EAD Platform

## 🔧 Executar Script SQL

Agora que o projeto Supabase está criado, você precisa executar o script SQL para criar as tabelas.

### Método 1: SQL Editor (Recomendado)

1. Vá para seu projeto Supabase: https://qsrmmuasvrxwosxnfpq.supabase.co
2. No menu à esquerda, clique em **"SQL Editor"** (ou **"Editor SQL"**)
3. Clique em **"New Query"** (ou **"Nova Consulta"**)
4. Copie todo o conteúdo do arquivo `supabase/migrations/001_create_tables.sql`
5. Cole no editor SQL
6. Clique em **"Run"** (ou **"Executar"**)

Pronto! ✅ As tabelas foram criadas com RLS ativado!

### Método 2: Vercel/CLI (Alternativo)

Se preferir usar CLI:

```bash
# Instalar Supabase CLI
npm install -g supabase

# Fazer login
supabase login

# Executar migrações
supabase db push
```

---

## 📊 Tabelas Criadas

### users
- `id` (UUID) - ID único
- `email` - Email do usuário
- `name` - Nome completo
- `avatar_url` - URL da foto de perfil
- `role` - Tipo de usuário: 'student', 'instructor', 'admin'
- `bio` - Biografia
- `created_at`, `updated_at`

### courses
- `id` (UUID)
- `title` - Título do curso
- `description` - Descrição
- `image_url` - Imagem do curso
- `instructor_id` - Referência ao instrutor
- `price` - Preço (decimal)
- `category` - Categoria do curso
- `level` - Nível: 'beginner', 'intermediate', 'advanced'
- `duration_hours` - Duração em horas
- `students_count` - Número de alunos
- `rating` - Avaliação média
- `is_published` - Se o curso está publicado

### lessons
- `id` (UUID)
- `course_id` - Referência ao curso
- `title` - Título da aula
- `description` - Descrição
- `video_url` - URL do vídeo
- `content` - Conteúdo em texto/HTML
- `order_index` - Ordem da aula
- `duration_minutes` - Duração em minutos

### enrollments
- `id` (UUID)
- `user_id` - Referência ao aluno
- `course_id` - Referência ao curso
- `enrolled_at` - Data de inscrição
- `completed_at` - Data de conclusão
- `progress` - Progresso (0-100)

### progress
- `id` (UUID)
- `user_id` - Aluno
- `lesson_id` - Aula
- `completed` - Se completou
- `watched_percentage` - Porcentagem assistida
- `completed_at` - Data de conclusão

### certificates
- `id` (UUID)
- `user_id` - Aluno
- `course_id` - Curso
- `issue_date` - Data de emissão
- `certificate_url` - URL do certificado

### reviews
- `id` (UUID)
- `user_id` - Avaliador
- `course_id` - Curso avaliado
- `rating` - Nota (1-5)
- `comment` - Comentário
- `created_at`, `updated_at`

---

## 🔒 Políticas RLS Implementadas

✅ **users**: Cada usuário vê apenas seu próprio perfil

✅ **courses**: 
- Todos veem cursos publicados
- Instrutores veem seus próprios cursos
- Apenas instrutores podem criar/editar/deletar

✅ **lessons**: 
- Qualquer um vê aulas de cursos publicados
- Instrutores podem gerenciar suas aulas

✅ **enrollments**: Usuários veem apenas suas inscrições

✅ **progress**: Usuários veem apenas seu progresso

✅ **certificates**: Usuários veem apenas seus certificados

✅ **reviews**: 
- Todos veem reviews de cursos publicados
- Apenas alunos inscritos podem fazer review

---

## ✅ Checklist

- [ ] Projeto Supabase criado
- [ ] Script SQL executado
- [ ] Tabelas criadas com sucesso
- [ ] RLS ativado
- [ ] `.env.local` atualizado com credenciais

Se tudo estiver ok, pode fazer commit e preparar o Vercel! 🚀

---

## 🔗 Links Úteis

- [Documentação Supabase](https://supabase.com/docs)
- [RLS (Row Level Security)](https://supabase.com/docs/guides/auth/row-level-security)
- [SQL Editor](https://app.supabase.com/)
