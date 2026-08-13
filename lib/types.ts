// Usuário
export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
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
  instructor_name: string
  price: number
  category: string
  level: 'beginner' | 'intermediate' | 'advanced'
  duration_hours: number
  students_count: number
  rating: number
  created_at: string
  updated_at: string
}

// Aula
export interface Lesson {
  id: string
  course_id: string
  title: string
  description: string
  video_url?: string
  content: string
  order: number
  duration_minutes: number
  created_at: string
}

// Inscrição
export interface Enrollment {
  id: string
  user_id: string
  course_id: string
  enrolled_at: string
  completed_at?: string
  progress: number
}

// Progresso do Aluno
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
