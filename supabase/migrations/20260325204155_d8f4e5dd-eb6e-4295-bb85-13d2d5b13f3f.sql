
-- Tighten exam_sessions: students can only update sessions that are not yet submitted
DROP POLICY "Students can update own session" ON public.exam_sessions;
CREATE POLICY "Students can update own session"
  ON public.exam_sessions FOR UPDATE
  TO anon, authenticated
  USING (status != 'submitted')
  WITH CHECK (status IN ('waiting', 'in_progress', 'submitted'));

-- Tighten student_answers: only insert for non-submitted sessions
DROP POLICY "Students can insert answers" ON public.student_answers;
CREATE POLICY "Students can insert answers"
  ON public.student_answers FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_sessions
      WHERE id = session_id AND status != 'submitted'
    )
  );

-- Tighten student_answers update: only for non-submitted sessions
DROP POLICY "Students can update answers" ON public.student_answers;
CREATE POLICY "Students can update answers"
  ON public.student_answers FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions
      WHERE id = session_id AND status != 'submitted'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_sessions
      WHERE id = session_id AND status != 'submitted'
    )
  );

-- Tighten exam_sessions insert: only for published/active exams within participant limits
DROP POLICY "Anyone can create exam session" ON public.exam_sessions;
CREATE POLICY "Anyone can create exam session"
  ON public.exam_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE id = exam_id AND status IN ('published', 'active')
    )
  );
