-- Short codes for share links (/s/:code), created on demand by the quiz owner.
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS share_code TEXT UNIQUE;
