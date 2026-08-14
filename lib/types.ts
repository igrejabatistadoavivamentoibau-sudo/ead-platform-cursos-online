// Papel do usuário na plataforma
export type UserRole = 'aluno' | 'professor' | 'admin'

// Usuário
export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  role: UserRole
  bio?: string
  created_at: string
  updated_at: string
}

// Curso
export interface Course {
  id: string
  title: string
  description: string
  image_url?: string
  instructor_id: string
  instructor_name?: string
  price: number
  category: string
  level: 'beginner' | 'intermediate' | 'advanced'
  duration_hours: number
  students_count: number
  rating: number
  is_published?: boolean
  created_at: string
  updated_at: string
}

// Aula (vídeo aula de um curso)
export interface Lesson {
  id: string
  course_id: string
  title: string
  description?: string
  video_url?: string
  content?: string
  order_index: number
  duration_minutes?: number
  created_at: string
}

// Inscrição (relação usuário x curso, progresso geral do conteúdo)
export interface Enrollment {
  id: string
  user_id: string
  course_id: string
  enrolled_at: string
  completed_at?: string
  progress: number
}

// Progresso do Aluno em uma aula específica
export interface Progress {
  id: string
  user_id: string
  lesson_id: string
  completed: boolean
  watched_percentage: number
  completed_at?: string
}

// Certificado
export interface Certificate {
  id: string
  user_id: string
  course_id: string
  issue_date: string
  certificate_url: string
}

// Turma: uma turma/cohorte de alunos cursando com um professor responsável
export interface Turma {
  id: string
  nome: string
  descricao?: string
  curso_id?: string
  professor_id?: string
  status: 'planejada' | 'em_andamento' | 'encerrada'
  data_inicio?: string
  data_fim?: string
  created_at: string
  updated_at: string
}

// Matrícula de um aluno em uma turma
export interface TurmaAluno {
  id: string
  turma_id: string
  aluno_id: string
  status: 'ativo' | 'inativo' | 'concluido'
  matriculado_em: string
}

// Encontro (sessão/aula de uma turma, usado para a lista de chamada)
export interface Encontro {
  id: string
  turma_id: string
  titulo?: string
  data: string
  created_at: string
}

// Presença de um aluno em um encontro
export interface Presenca {
  id: string
  encontro_id: string
  aluno_id: string
  presente: boolean
  observacao?: string
  created_at: string
  updated_at: string
}
