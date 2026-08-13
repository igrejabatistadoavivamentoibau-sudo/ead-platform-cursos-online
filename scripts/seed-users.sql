-- Script para criar usuários de teste no Supabase

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
