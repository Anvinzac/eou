INSERT INTO public.question_packs (
  id,
  user_id,
  title,
  description,
  emoji,
  questions,
  is_system
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  NULL,
  'Couple Warmup',
  'A ready-to-use starter pack for local couple-mode testing.',
  '💞',
  '[
    {"questionId": 1, "category": "Leisure", "text": "What hobby does your partner enjoy most in free time?", "options": ["Reading", "Gaming", "Sports", "Music", "Art", "Cooking", "DIY", "Collecting"], "orderNumber": 1, "correctAnswer": "", "distractors": [], "isCustom": false},
    {"questionId": 8, "category": "Leisure", "text": "What kind of weekend sounds best for your partner?", "options": ["Relaxing at home", "Going on a trip", "Meeting friends", "Trying new food", "Watching movies", "Outdoor adventure", "Shopping", "Learning something new"], "orderNumber": 2, "correctAnswer": "", "distractors": [], "isCustom": false},
    {"questionId": 15, "category": "Food", "text": "What flavor does your partner usually prefer?", "options": ["Sweet", "Savory", "Spicy", "Sour", "Bitter", "Umami", "Salty", "Mixed flavors"], "orderNumber": 3, "correctAnswer": "", "distractors": [], "isCustom": false}
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  emoji = EXCLUDED.emoji,
  questions = EXCLUDED.questions,
  is_system = EXCLUDED.is_system;

INSERT INTO public.quizzes (
  id,
  user_id,
  title,
  quiz_type,
  is_open,
  is_active,
  max_questions,
  language
) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    NULL,
    'Local Couple Demo',
    'preference',
    true,
    true,
    5,
    'en'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    NULL,
    'Invite Code Demo',
    'preference',
    false,
    true,
    5,
    'en'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  quiz_type = EXCLUDED.quiz_type,
  is_open = EXCLUDED.is_open,
  is_active = EXCLUDED.is_active,
  max_questions = EXCLUDED.max_questions,
  language = EXCLUDED.language;

INSERT INTO public.quiz_questions (
  id,
  quiz_id,
  question_ref_id,
  category,
  question_text,
  order_number,
  correct_answers,
  distractor_answers,
  is_custom
) VALUES
  (
    '11000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    1,
    'Leisure',
    'What hobby does your partner enjoy most in free time?',
    1,
    ARRAY['Reading'],
    ARRAY['Gaming', 'Sports', 'Music'],
    false
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    8,
    'Leisure',
    'What kind of weekend sounds best for your partner?',
    2,
    ARRAY['Going on a trip'],
    ARRAY['Relaxing at home', 'Meeting friends', 'Trying new food'],
    false
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    15,
    'Food',
    'What flavor does your partner usually prefer?',
    3,
    ARRAY['Spicy'],
    ARRAY['Sweet', 'Savory', 'Sour'],
    false
  ),
  (
    '11000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    22,
    'Travel',
    'Which trip would your partner choose first?',
    4,
    ARRAY['Beach escape'],
    ARRAY['Mountain trek', 'City break', 'Countryside stay'],
    false
  ),
  (
    '11000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    29,
    'Lifestyle',
    'What kind of evening feels most like your partner?',
    5,
    ARRAY['Quiet night in'],
    ARRAY['Party night', 'Late-night work session', 'Spontaneous road trip'],
    false
  ),
  (
    '11000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000002',
    1,
    'Leisure',
    'What hobby does your partner enjoy most in free time?',
    1,
    ARRAY['Reading'],
    ARRAY['Gaming', 'Sports', 'Music'],
    false
  ),
  (
    '11000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000002',
    8,
    'Leisure',
    'What kind of weekend sounds best for your partner?',
    2,
    ARRAY['Going on a trip'],
    ARRAY['Relaxing at home', 'Meeting friends', 'Trying new food'],
    false
  ),
  (
    '11000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000002',
    15,
    'Food',
    'What flavor does your partner usually prefer?',
    3,
    ARRAY['Spicy'],
    ARRAY['Sweet', 'Savory', 'Sour'],
    false
  ),
  (
    '11000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000002',
    22,
    'Travel',
    'Which trip would your partner choose first?',
    4,
    ARRAY['Beach escape'],
    ARRAY['Mountain trek', 'City break', 'Countryside stay'],
    false
  ),
  (
    '11000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000002',
    29,
    'Lifestyle',
    'What kind of evening feels most like your partner?',
    5,
    ARRAY['Quiet night in'],
    ARRAY['Party night', 'Late-night work session', 'Spontaneous road trip'],
    false
  )
ON CONFLICT (id) DO UPDATE SET
  quiz_id = EXCLUDED.quiz_id,
  question_ref_id = EXCLUDED.question_ref_id,
  category = EXCLUDED.category,
  question_text = EXCLUDED.question_text,
  order_number = EXCLUDED.order_number,
  correct_answers = EXCLUDED.correct_answers,
  distractor_answers = EXCLUDED.distractor_answers,
  is_custom = EXCLUDED.is_custom;

INSERT INTO public.invitations (
  id,
  quiz_id,
  code,
  label,
  is_used
) VALUES
  (
    '12000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'LOCAL1',
    'Alex',
    false
  ),
  (
    '12000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'LOCAL2',
    'Sam',
    false
  )
ON CONFLICT (id) DO UPDATE SET
  quiz_id = EXCLUDED.quiz_id,
  code = EXCLUDED.code,
  label = EXCLUDED.label,
  is_used = EXCLUDED.is_used;

INSERT INTO public.quiz_attempts (
  id,
  quiz_id,
  invitation_id,
  respondent_name,
  score,
  total_questions,
  completed_at
) VALUES
  (
    '13000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    NULL,
    'Taylor',
    0,
    5,
    now()
  ),
  (
    '13000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    NULL,
    'Jordan',
    0,
    5,
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  quiz_id = EXCLUDED.quiz_id,
  invitation_id = EXCLUDED.invitation_id,
  respondent_name = EXCLUDED.respondent_name,
  score = EXCLUDED.score,
  total_questions = EXCLUDED.total_questions,
  completed_at = EXCLUDED.completed_at;

INSERT INTO public.quiz_responses (
  id,
  attempt_id,
  question_id,
  selected_answer,
  is_correct
) VALUES
  (
    '14000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'Reading',
    true
  ),
  (
    '14000000-0000-0000-0000-000000000002',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000002',
    'Going on a trip',
    true
  ),
  (
    '14000000-0000-0000-0000-000000000003',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000003',
    'Spicy',
    true
  ),
  (
    '14000000-0000-0000-0000-000000000004',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000004',
    'Beach escape',
    true
  ),
  (
    '14000000-0000-0000-0000-000000000005',
    '13000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000005',
    'Quiet night in',
    true
  ),
  (
    '14000000-0000-0000-0000-000000000006',
    '13000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000001',
    'Reading',
    true
  ),
  (
    '14000000-0000-0000-0000-000000000007',
    '13000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    'Meeting friends',
    false
  ),
  (
    '14000000-0000-0000-0000-000000000008',
    '13000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000003',
    'Spicy',
    true
  ),
  (
    '14000000-0000-0000-0000-000000000009',
    '13000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000004',
    'City break',
    false
  ),
  (
    '14000000-0000-0000-0000-000000000010',
    '13000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000005',
    'Quiet night in',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  attempt_id = EXCLUDED.attempt_id,
  question_id = EXCLUDED.question_id,
  selected_answer = EXCLUDED.selected_answer,
  is_correct = EXCLUDED.is_correct;

INSERT INTO public.couple_sessions (
  id,
  quiz_id,
  session_code,
  status,
  first_name,
  second_name,
  first_attempt_id,
  second_attempt_id,
  match_percentage,
  match_count,
  total_compared,
  match_details,
  completed_at
) VALUES
  (
    '15000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'MATCH1',
    'completed',
    'Taylor',
    'Jordan',
    '13000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000002',
    60,
    3,
    5,
    '[
      {"questionId":"11000000-0000-0000-0000-000000000001","questionText":"What hobby does your partner enjoy most in free time?","category":"Leisure","orderNumber":1,"firstAnswer":"Reading","secondAnswer":"Reading","isMatch":true},
      {"questionId":"11000000-0000-0000-0000-000000000002","questionText":"What kind of weekend sounds best for your partner?","category":"Leisure","orderNumber":2,"firstAnswer":"Going on a trip","secondAnswer":"Meeting friends","isMatch":false},
      {"questionId":"11000000-0000-0000-0000-000000000003","questionText":"What flavor does your partner usually prefer?","category":"Food","orderNumber":3,"firstAnswer":"Spicy","secondAnswer":"Spicy","isMatch":true},
      {"questionId":"11000000-0000-0000-0000-000000000004","questionText":"Which trip would your partner choose first?","category":"Travel","orderNumber":4,"firstAnswer":"Beach escape","secondAnswer":"City break","isMatch":false},
      {"questionId":"11000000-0000-0000-0000-000000000005","questionText":"What kind of evening feels most like your partner?","category":"Lifestyle","orderNumber":5,"firstAnswer":"Quiet night in","secondAnswer":"Quiet night in","isMatch":true}
    ]'::jsonb,
    now()
  ),
  (
    '15000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'WAIT22',
    'waiting',
    'Casey',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '[]'::jsonb,
    NULL
  )
ON CONFLICT (id) DO UPDATE SET
  quiz_id = EXCLUDED.quiz_id,
  session_code = EXCLUDED.session_code,
  status = EXCLUDED.status,
  first_name = EXCLUDED.first_name,
  second_name = EXCLUDED.second_name,
  first_attempt_id = EXCLUDED.first_attempt_id,
  second_attempt_id = EXCLUDED.second_attempt_id,
  match_percentage = EXCLUDED.match_percentage,
  match_count = EXCLUDED.match_count,
  total_compared = EXCLUDED.total_compared,
  match_details = EXCLUDED.match_details,
  completed_at = EXCLUDED.completed_at;
