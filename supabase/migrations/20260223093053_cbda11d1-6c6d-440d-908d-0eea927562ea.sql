
-- Allow quizzes to be created without a user (draft mode)
ALTER TABLE public.quizzes ALTER COLUMN user_id DROP NOT NULL;

-- Add a draft token column so anonymous users can reclaim their quiz
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS draft_token TEXT;

-- Allow anyone to insert quizzes (for drafts)
CREATE POLICY "Anyone can create draft quizzes"
ON public.quizzes
FOR INSERT
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Allow anyone to update their draft quiz (by draft_token)
CREATE POLICY "Anyone can update draft quizzes by token"
ON public.quizzes
FOR UPDATE
USING (user_id IS NULL AND draft_token IS NOT NULL);

-- Allow anyone to view draft quizzes by token
CREATE POLICY "Anyone can view draft quizzes by token"
ON public.quizzes
FOR SELECT
USING (user_id IS NULL AND draft_token IS NOT NULL);

-- Allow inserting quiz_questions for drafts (quiz owner is null)
CREATE POLICY "Anyone can insert questions for draft quizzes"
ON public.quiz_questions
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM quizzes 
  WHERE quizzes.id = quiz_questions.quiz_id 
  AND (quizzes.user_id IS NULL OR quizzes.user_id = auth.uid())
));
