-- ============================================================
--  DEMO SEED — immersive kinetic guest quiz
--  Run this in the Supabase SQL Editor (or `supabase db execute`).
--  It inserts a closed (invitation-only) demo quiz, 6 questions,
--  and one invitation with a known code, so you can test the
--  kinetic-canvas guest experience via an invitation link.
--
--  After running, open:
--    /quiz/11111111-1111-4111-8111-111111111111?code=DEMO123
-- ============================================================

-- Idempotent: ensure anon guests can create invitations for active
-- quizzes (needed by scripts/seed-demo.mjs). Skipped if present.
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

-- Idempotent: clear prior demo rows first.
DELETE FROM public.invitations WHERE code = 'DEMO123';
DELETE FROM public.quiz_questions WHERE quiz_id = '11111111-1111-4111-8111-111111111111';
DELETE FROM public.quizzes WHERE id = '11111111-1111-4111-8111-111111111111';

-- Demo quiz (closed: requires the invitation code).
INSERT INTO public.quizzes (id, user_id, title, is_open, is_active, max_questions, language)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  NULL,
  'Getting to Know Us',
  false,           -- closed: guest must use the invitation code
  true,
  10,
  'en'
);

-- Questions.
INSERT INTO public.quiz_questions
  (id, quiz_id, question_ref_id, category, question_text, order_number, correct_answers, distractor_answers, is_custom)
VALUES
  ('33333333-3333-4333-8333-333333333331', '11111111-1111-4111-8111-111111111111', 1, 'food',
   'What is my go-to comfort food after a long day?', 1,
   ARRAY['A bowl of noodles'], ARRAY['Sushi','A rich chocolate cake','Something spicy'], false),

  ('33333333-3333-4333-8333-333333333332', '11111111-1111-4111-8111-111111111111', 2, 'travel',
   'Which trip would I book again in a heartbeat?', 2,
   ARRAY['A quiet cabin in the woods'], ARRAY['A packed city tour','A resort with a crowd','A road trip with no plan'], false),

  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 3, 'entertainment',
   'Pick the movie night I would never say no to.', 3,
   ARRAY['A cozy rom-com'], ARRAY['A scary thriller','A loud action film','A slow documentary'], false),

  ('33333333-3333-4333-8333-333333333334', '11111111-1111-4111-8111-111111111111', 4, 'leisure',
   'My idea of the perfect Sunday involves...', 4,
   ARRAY['Sleeping in and a slow breakfast'], ARRAY['A big hike','Running errands','A full social calendar'], false),

  ('33333333-3333-4333-8333-333333333335', '11111111-1111-4111-8111-111111111111', 5, 'emotion',
   'When I am stressed, I recharge by...', 5,
   ARRAY['A long walk with music'], ARRAY['Venting to a friend','Scrolling for hours','Cleaning the whole place'], false),

  ('33333333-3333-4333-8333-333333333336', '11111111-1111-4111-8111-111111111111', 6, 'growth',
   'Our shared goal I care most about is...', 6,
   ARRAY['Learning something new together'], ARRAY['Saving for a big trip','Getting fit','Less screen time'], false);

-- Invitation (6-char code, matches the input maxLength).
INSERT INTO public.invitations (id, quiz_id, code, label, is_used)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'DEMO123',
  'Demo Guest',
  false
);

-- Echo the guest link.
SELECT 'Open: /quiz/11111111-1111-4111-8111-111111111111?code=DEMO123' AS guest_link;
