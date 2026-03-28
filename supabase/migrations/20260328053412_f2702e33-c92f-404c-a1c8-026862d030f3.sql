CREATE TABLE public.couple_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  session_code text NOT NULL UNIQUE,
  first_name text,
  second_name text,
  first_attempt_id uuid REFERENCES public.quiz_attempts(id),
  second_attempt_id uuid REFERENCES public.quiz_attempts(id),
  status text NOT NULL DEFAULT 'waiting',
  match_percentage numeric DEFAULT 0,
  match_count integer DEFAULT 0,
  total_compared integer DEFAULT 0,
  match_details jsonb DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.couple_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view couple sessions by code"
  ON public.couple_sessions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create couple sessions"
  ON public.couple_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update couple sessions"
  ON public.couple_sessions FOR UPDATE
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.couple_sessions;