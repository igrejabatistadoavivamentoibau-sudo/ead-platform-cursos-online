-- Criar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'student', -- 'student' | 'instructor' | 'admin'
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Cursos
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  level TEXT DEFAULT 'beginner', -- 'beginner' | 'intermediate' | 'advanced'
  duration_hours INTEGER,
  students_count INTEGER DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Aulas
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  content TEXT,
  order_index INTEGER NOT NULL,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, order_index)
);

-- Tabela de Inscrições
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  progress DECIMAL(5, 2) DEFAULT 0, -- 0 a 100
  UNIQUE(user_id, course_id)
);

-- Tabela de Progresso
CREATE TABLE IF NOT EXISTS progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  watched_percentage DECIMAL(5, 2) DEFAULT 0, -- 0 a 100
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Tabela de Certificados
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  certificate_url TEXT,
  UNIQUE(user_id, course_id)
);

-- Tabela de Avaliações e Comentários
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Criar índices para melhor performance
CREATE INDEX idx_courses_instructor_id ON courses(instructor_id);
CREATE INDEX idx_courses_is_published ON courses(is_published);
CREATE INDEX idx_lessons_course_id ON lessons(course_id);
CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_progress_user_id ON progress(user_id);
CREATE INDEX idx_progress_lesson_id ON progress(lesson_id);
CREATE INDEX idx_reviews_course_id ON reviews(course_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ============ POLÍTICAS RLS ============

-- USERS: Cada usuário vê apenas seu próprio perfil
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- COURSES: Todos podem ver cursos publicados, instrutores podem ver seus próprios
CREATE POLICY "Anyone can view published courses"
  ON courses FOR SELECT
  USING (is_published = TRUE);

CREATE POLICY "Instructors can view their own courses"
  ON courses FOR SELECT
  USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can create courses"
  ON courses FOR INSERT
  WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Instructors can update their own courses"
  ON courses FOR UPDATE
  USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can delete their own courses"
  ON courses FOR DELETE
  USING (auth.uid() = instructor_id);

-- LESSONS: Qualquer um pode ver aulas de cursos publicados, estudantes inscritos podem ver suas aulas
CREATE POLICY "Anyone can view lessons of published courses"
  ON lessons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = lessons.course_id 
      AND courses.is_published = TRUE
    )
  );

CREATE POLICY "Instructors can manage their course lessons"
  ON lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = lessons.course_id 
      AND courses.instructor_id = auth.uid()
    )
  );

-- ENROLLMENTS: Usuários veem apenas suas próprias inscrições
CREATE POLICY "Users can view their own enrollments"
  ON enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create enrollments"
  ON enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- PROGRESS: Usuários veem apenas seu próprio progresso
CREATE POLICY "Users can view their own progress"
  ON progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create progress records"
  ON progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- CERTIFICATES: Usuários veem apenas seus próprios certificados
CREATE POLICY "Users can view their own certificates"
  ON certificates FOR SELECT
  USING (auth.uid() = user_id);

-- REVIEWS: Qualquer um pode ver reviews de cursos publicados
CREATE POLICY "Anyone can view reviews of published courses"
  ON reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = reviews.course_id 
      AND courses.is_published = TRUE
    )
  );

CREATE POLICY "Users can create reviews for courses they enrolled"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM enrollments 
      WHERE enrollments.user_id = auth.uid() 
      AND enrollments.course_id = reviews.course_id
    )
  );

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);
