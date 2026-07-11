-- Allow creating invitations for active quizzes (used by the demo seeder and
-- consistent with the app's already-public attempt/response inserts).
CREATE POLICY "Anyone can create invitations for active quizzes"
  ON public.invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE id = quiz_id AND is_active = true
    )
  );
