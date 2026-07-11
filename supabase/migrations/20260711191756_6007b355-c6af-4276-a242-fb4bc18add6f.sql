DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invitations'
      AND policyname = 'Anyone can create invitations for active quizzes'
  ) THEN
    CREATE POLICY "Anyone can create invitations for active quizzes"
      ON public.invitations
      FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND is_active = true)
      );
  END IF;
END $$;