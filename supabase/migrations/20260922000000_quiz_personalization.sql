-- Null appearance preserves the original player for existing quizzes.
ALTER TABLE public.quizzes
  ADD COLUMN appearance JSONB;

ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_appearance_valid CHECK (
    appearance IS NULL OR (
      jsonb_typeof(appearance) = 'object'
      AND appearance ? 'theme'
      AND appearance ? 'style'
      AND appearance->>'theme' IS NOT NULL
      AND appearance->>'style' IS NOT NULL
      AND appearance->>'theme' IN ('peach', 'lavender', 'mint', 'sunshine', 'midnight', 'rose')
      AND appearance->>'style' IN ('playful', 'editorial', 'minimal')
    )
  );

ALTER TABLE public.quiz_questions
  ADD COLUMN emoji TEXT NOT NULL DEFAULT ''
  CHECK (char_length(emoji) <= 16);
