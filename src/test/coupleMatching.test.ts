import { describe, expect, it } from 'vitest';
import { buildCoupleMatchSummary } from '@/lib/coupleMatching';

describe('buildCoupleMatchSummary', () => {
  it('calculates exact answer matches and preserves question metadata', () => {
    const summary = buildCoupleMatchSummary(
      [
        {
          id: 'q1',
          quiz_id: 'quiz-1',
          category: 'Food',
          correct_answers: ['Pizza'],
          correct_answers_vi: null,
          created_at: '',
          distractor_answers: ['Burger'],
          distractor_answers_vi: null,
          is_custom: false,
          order_number: 1,
          question_ref_id: 1,
          question_text: 'Favorite dinner?',
          question_text_vi: null,
        },
        {
          id: 'q2',
          quiz_id: 'quiz-1',
          category: 'Travel',
          correct_answers: ['Beach'],
          correct_answers_vi: null,
          created_at: '',
          distractor_answers: ['Mountains'],
          distractor_answers_vi: null,
          is_custom: false,
          order_number: 2,
          question_ref_id: 2,
          question_text: 'Dream trip?',
          question_text_vi: null,
        },
      ],
      [
        {
          id: 'r1',
          attempt_id: 'a1',
          created_at: '',
          is_correct: false,
          question_id: 'q1',
          selected_answer: 'Pizza',
        },
        {
          id: 'r2',
          attempt_id: 'a1',
          created_at: '',
          is_correct: false,
          question_id: 'q2',
          selected_answer: 'Beach',
        },
      ],
      [
        {
          id: 'r3',
          attempt_id: 'a2',
          created_at: '',
          is_correct: false,
          question_id: 'q1',
          selected_answer: 'Pizza',
        },
        {
          id: 'r4',
          attempt_id: 'a2',
          created_at: '',
          is_correct: false,
          question_id: 'q2',
          selected_answer: 'City',
        },
      ],
    );

    expect(summary.matchCount).toBe(1);
    expect(summary.totalCompared).toBe(2);
    expect(summary.matchPercentage).toBe(50);
    expect(summary.details).toEqual([
      expect.objectContaining({
        questionId: 'q1',
        questionText: 'Favorite dinner?',
        firstAnswer: 'Pizza',
        secondAnswer: 'Pizza',
        isMatch: true,
      }),
      expect.objectContaining({
        questionId: 'q2',
        questionText: 'Dream trip?',
        firstAnswer: 'Beach',
        secondAnswer: 'City',
        isMatch: false,
      }),
    ]);
  });
});
