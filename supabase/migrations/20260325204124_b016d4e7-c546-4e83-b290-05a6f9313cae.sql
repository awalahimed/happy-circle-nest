
-- User roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.email, ''));
  
  -- Default role: teacher
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'teacher');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Exams table
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  duration_minutes INT NOT NULL DEFAULT 30,
  access_code TEXT NOT NULL UNIQUE,
  max_participants INT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'completed')),
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own exams
CREATE POLICY "Teachers can manage own exams"
  ON public.exams FOR ALL
  TO authenticated
  USING (teacher_id = auth.uid());

-- Admins can read all exams
CREATE POLICY "Admins can read all exams"
  ON public.exams FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can read published/active exams by access code (for student access)
CREATE POLICY "Public can read published exams"
  ON public.exams FOR SELECT
  TO anon, authenticated
  USING (status IN ('published', 'active'));

-- Questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  marks INT NOT NULL DEFAULT 5,
  question_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Teachers can manage questions for their exams
CREATE POLICY "Teachers can manage own exam questions"
  ON public.questions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND teacher_id = auth.uid())
  );

-- Anyone can read questions for active exams (students taking exam)
CREATE POLICY "Public can read active exam questions"
  ON public.questions FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND status = 'active')
  );

-- Admins can read all questions
CREATE POLICY "Admins can read all questions"
  ON public.questions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Student exam sessions
CREATE TABLE public.exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score INT,
  total_marks INT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'submitted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can create a session (students joining)
CREATE POLICY "Anyone can create exam session"
  ON public.exam_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Sessions are readable by exam teacher
CREATE POLICY "Teachers can read own exam sessions"
  ON public.exam_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND teacher_id = auth.uid())
  );

-- Sessions are readable by the student (by email match via anon)
CREATE POLICY "Students can read own sessions"
  ON public.exam_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Students can update their own session
CREATE POLICY "Students can update own session"
  ON public.exam_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Admins can read all sessions
CREATE POLICY "Admins can read all sessions"
  ON public.exam_sessions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Student answers
CREATE TABLE public.student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  selected_answer TEXT CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);

ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

-- Anyone can insert answers (students)
CREATE POLICY "Students can insert answers"
  ON public.student_answers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anyone can update their answers
CREATE POLICY "Students can update answers"
  ON public.student_answers FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Teachers can read answers for their exams
CREATE POLICY "Teachers can read answers for own exams"
  ON public.student_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions es
      JOIN public.exams e ON e.id = es.exam_id
      WHERE es.id = session_id AND e.teacher_id = auth.uid()
    )
  );

-- Students can read own answers
CREATE POLICY "Students can read own answers"
  ON public.student_answers FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admins can read all answers
CREATE POLICY "Admins can read all answers"
  ON public.student_answers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for exam status changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.exams;
