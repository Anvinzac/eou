import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../models/QuizModel.js', () => ({ QuizModel: {
  create: vi.fn(), insertQuestions: vi.fn(), findActiveById: vi.fn(), getQuestions: vi.fn(), claimDraft: vi.fn(),
} }));
vi.mock('../models/InvitationModel.js', () => ({ InvitationModel: {} }));
vi.mock('./telemetryService.js', () => ({ TelemetryService: { emitSafe: vi.fn() } }));

import { QuizModel } from '../models/QuizModel.js';
import { createQuizBodySchema, QuizService } from './quizService.js';
import { CatalogService } from './catalogService.js';

const body = () => createQuizBodySchema.parse({
  title: 'A little about us', appearance: { theme: 'peach', style: 'editorial' }, isOpen: true,
  questions: Array.from({ length: 5 }, (_, index) => ({
    questionId: index + 1, category: 'Leisure', text: `Favorite activity ${index + 1}?`,
    orderNumber: index + 1, correctAnswer: 'Reading', distractors: ['Walking', 'Gaming', 'Cooking'],
    emoji: index === 1 ? '🧸' : '',
  })),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(QuizModel.create).mockResolvedValue({ id: 'quiz-1', title: 'A little about us' });
  vi.mocked(QuizModel.insertQuestions).mockImplementation(async rows => rows);
});

describe('quiz personalization validation', () => {
  it('accepts every supported theme and style', () => {
    for (const theme of ['peach', 'lavender', 'mint', 'sunshine', 'midnight', 'rose']) {
      for (const style of ['playful', 'editorial', 'minimal']) {
        expect(createQuizBodySchema.safeParse({ ...body(), appearance: { theme, style } }).success).toBe(true);
      }
    }
  });

  it('rejects arbitrary themes, styles, oversized stickers, and blank titles', () => {
    expect(createQuizBodySchema.safeParse({ ...body(), appearance: { theme: 'url(unsafe)', style: 'playful' } }).success).toBe(false);
    expect(createQuizBodySchema.safeParse({ ...body(), appearance: { theme: 'rose', style: 'unknown' } }).success).toBe(false);
    expect(createQuizBodySchema.safeParse({ ...body(), questions: [{ ...body().questions[0], emoji: 'x'.repeat(17) }] }).success).toBe(false);
    expect(createQuizBodySchema.safeParse({ ...body(), title: '   ' }).success).toBe(false);
  });

  it('accepts legacy clients without personalization or visibility options', () => {
    const { appearance, isOpen, ...legacy } = body();
    const parsed = createQuizBodySchema.parse(legacy);
    expect(parsed.appearance).toBeUndefined();
    expect(parsed.isOpen).toBeUndefined();
  });
});

describe('personalized publishing', () => {
  it('persists appearance, visibility and the sticker on its own question', async () => {
    await QuizService.createOwned('user-1', body());
    expect(QuizModel.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1', appearance: { theme: 'peach', style: 'editorial' }, is_open: true,
    }));
    const rows = vi.mocked(QuizModel.insertQuestions).mock.calls[0][0];
    expect(rows[0].emoji).toBe('');
    expect(rows[1]).toMatchObject({ question_ref_id: 2, emoji: '🧸', correct_answers: ['Reading'] });
  });

  it('keeps personalization on anonymous drafts and does not replace it during claim', async () => {
    const result = await QuizService.createDraft({ ...body(), isOpen: false });
    expect(QuizModel.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: null, appearance: body().appearance, is_open: false, draft_token: result.draftToken,
    }));
    vi.mocked(QuizModel.claimDraft).mockResolvedValue({ id: 'quiz-1', appearance: body().appearance });
    const claimed = await QuizService.claimDraft('user-1', 'quiz-1', result.draftToken);
    expect(claimed.appearance).toEqual(body().appearance);
  });

  it('returns appearance and stickers for playback without a correct-answer field', async () => {
    vi.mocked(QuizModel.findActiveById).mockResolvedValue({ id: 'quiz-1', appearance: body().appearance });
    vi.mocked(QuizModel.getQuestions).mockResolvedValue([{
      id: 'q-2', category: 'Leisure', question_text: 'Favorite hobby?', order_number: 1,
      emoji: '🧸', correct_answers: ['Reading'], distractor_answers: ['Walking', 'Gaming', 'Cooking'],
    }]);
    const result = await QuizService.getTakePayload('quiz-1');
    expect(result.quiz.appearance).toEqual(body().appearance);
    expect(result.questions[0].emoji).toBe('🧸');
    expect(result.questions[0]).not.toHaveProperty('correct_answers');
    expect(result.questions[0].choices).toHaveLength(4);
  });

  it('handles quizzes and questions created before personalization existed', async () => {
    vi.mocked(QuizModel.findActiveById).mockResolvedValue({ id: 'old-quiz' });
    vi.mocked(QuizModel.getQuestions).mockResolvedValue([{ id: 'old-question', correct_answers: [], distractor_answers: [] }]);
    const result = await QuizService.getTakePayload('old-quiz');
    expect(result.quiz.appearance).toBeUndefined();
    expect(result.questions[0].emoji).toBe('');
  });
});

describe('localized preference catalogs', () => {
  it('keeps question identities and categories stable in Vietnamese', () => {
    const english = CatalogService.getPreferenceQuestions('en').questions;
    const vietnamese = CatalogService.getPreferenceQuestions('vi-VN').questions;
    expect(vietnamese.length).toBe(english.length);
    expect(vietnamese).toHaveLength(130);
    expect(vietnamese.map(question => question.id)).toEqual(english.map(question => question.id));
    const originals = new Map(english.map(question => [question.id, question]));
    for (const question of vietnamese) {
      const original = originals.get(question.id)!;
      expect(question.category).toBe(original.category);
      expect(question.text).not.toBe(original.text);
      expect(question.options).toHaveLength(original.options.length);
      expect(new Set(question.options.map(option => option.trim().toLocaleLowerCase('vi'))).size).toBe(question.options.length);
      expect(question.text).toMatch(/[^\x00-\x7f]/);
      expect(question.text).not.toMatch(/Câu hỏi về /);
      for (const [index, option] of question.options.entries()) {
        expect(option.trim()).not.toBe('');
        expect(option).not.toBe(original.options[index]);
      }
      expect([question.text, ...question.options].join(' ')).not.toMatch(/\(vi\)/i);
    }
    expect(new Set(vietnamese.map(question => question.category)).size).toBe(11);
    expect(CatalogService.getPreferenceQuestions().questions).toEqual(english);
  });

  it('keeps the client copy identical to the authored server catalog', () => {
    const client = JSON.parse(readFileSync(new URL('../../../client/src/data/qna.vi.json', import.meta.url), 'utf8'));
    expect(client).toEqual(CatalogService.getPreferenceQuestions('vi'));
  });

  it('contains complete translations beyond the initial sample questions', () => {
    const questions = new Map(CatalogService.getPreferenceQuestions('vi').questions.map(question => [question.id, question]));
    expect(questions.get(31)?.text).toBe('Nếu có thêm một khoản tiền, người ấy sẽ chi vào việc gì?');
    expect(questions.get(41)?.options).toContain('Hội họa');
    expect(questions.get(110)?.options).toContain('Yên lặng hoàn toàn');
    expect(questions.get(130)?.options).toContain('Chim tự do');
  });

  it('preserves Vietnamese text and answers when publishing', async () => {
    const questions = CatalogService.getPreferenceQuestions('vi').questions.slice(0, 5);
    const payload = createQuizBodySchema.parse({ ...body(), title: 'Bạn hiểu mình đến đâu?', questions: questions.map((question, index) => ({
      questionId: question.id, category: question.category, text: question.text, orderNumber: index + 1,
      correctAnswer: question.options[0], distractors: question.options.slice(1, 4), emoji: '💖',
    })) });
    await QuizService.createOwned('user-1', payload);
    expect(vi.mocked(QuizModel.insertQuestions).mock.calls[0][0][0]).toMatchObject({ question_text: questions[0].text, correct_answers: [questions[0].options[0]], emoji: '💖' });
  });
});
