const PUBLIC_QUIZ_FIELDS = [
  'id',
  'title',
  'quiz_type',
  'is_open',
  'is_active',
  'max_questions',
  'language',
  'appearance',
  'created_at',
] as const;

/**
 * Quiz fields that are safe to return to anyone holding the quiz link.
 * Anything not listed here (notably draft_token and user_id) stays on the server.
 */
export function toPublicQuiz(quiz: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const field of PUBLIC_QUIZ_FIELDS) {
    if (field in quiz) result[field] = quiz[field];
  }
  return result;
}
