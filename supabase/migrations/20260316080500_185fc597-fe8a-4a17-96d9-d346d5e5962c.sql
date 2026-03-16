
CREATE TABLE public.question_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  emoji text DEFAULT '📦',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.question_packs ENABLE ROW LEVEL SECURITY;

-- Anyone can view system packs
CREATE POLICY "Anyone can view system packs" ON public.question_packs
  FOR SELECT USING (is_system = true);

-- Users can view their own packs
CREATE POLICY "Users can view own packs" ON public.question_packs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can create their own packs
CREATE POLICY "Users can create own packs" ON public.question_packs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND is_system = false);

-- Users can update their own packs
CREATE POLICY "Users can update own packs" ON public.question_packs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id AND is_system = false);

-- Users can delete their own packs
CREATE POLICY "Users can delete own packs" ON public.question_packs
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND is_system = false);

-- Trigger for updated_at
CREATE TRIGGER update_question_packs_updated_at
  BEFORE UPDATE ON public.question_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
