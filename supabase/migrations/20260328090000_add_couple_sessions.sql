CREATE TABLE public.couple_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
  session_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'waiting',
  first_name TEXT,
  second_name TEXT,
  first_attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE SET NULL,
  second_attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE SET NULL,
  match_percentage INTEGER,
  match_count INTEGER,
  total_compared INTEGER,
  match_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.couple_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create couple sessions"
ON public.couple_sessions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view couple sessions"
ON public.couple_sessions
FOR SELECT
USING (true);

CREATE POLICY "Anyone can update couple sessions"
ON public.couple_sessions
FOR UPDATE
USING (true);

CREATE TRIGGER update_couple_sessions_updated_at
  BEFORE UPDATE ON public.couple_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
