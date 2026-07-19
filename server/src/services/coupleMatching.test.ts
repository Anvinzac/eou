import { describe, expect, it } from 'vitest';
import { buildCoupleMatchSummary } from './coupleMatching.js';

describe('buildCoupleMatchSummary', () => {
  it('calculates exact answer matches and preserves question metadata', () => {
    const summary = buildCoupleMatchSummary(
      [
        {
          id: 'q1',
          category: 'Food',
          order_number: 1,
          question_text: 'Favorite dinner?',
        },
        {
          id: 'q2',
          category: 'Travel',
          order_number: 2,
          question_text: 'Dream trip?',
        },
      ],
      [
        { question_id: 'q1', selected_answer: 'Pizza' },
        { question_id: 'q2', selected_answer: 'Beach' },
      ],
      [
        { question_id: 'q1', selected_answer: 'Pizza' },
        { question_id: 'q2', selected_answer: 'City' },
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
