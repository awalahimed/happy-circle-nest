-- Allow teachers to delete exam sessions for their own exams
CREATE POLICY "Teachers can delete own exam sessions"
ON public.exam_sessions
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM exams WHERE exams.id = exam_sessions.exam_id AND exams.teacher_id = auth.uid()
));

-- Allow teachers to delete student answers for their own exams
CREATE POLICY "Teachers can delete answers for own exams"
ON public.student_answers
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM exam_sessions es
  JOIN exams e ON e.id = es.exam_id
  WHERE es.id = student_answers.session_id AND e.teacher_id = auth.uid()
));

-- Allow teachers to delete questions for own exams
CREATE POLICY "Teachers can delete own exam questions"
ON public.questions
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM exams WHERE exams.id = questions.exam_id AND exams.teacher_id = auth.uid()
));