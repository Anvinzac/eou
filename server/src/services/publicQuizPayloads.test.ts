import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/QuizModel.js', () => ({ QuizModel: {
  findActiveById: vi.fn(), findById: vi.fn(), getQuestions: vi.fn(),
} }));
vi.mock('../models/InvitationModel.js', () => ({ InvitationModel: { findByQuizAndCode: vi.fn() } }));
vi.mock('../models/CoupleSessionModel.js', () => ({ CoupleSessionModel: { findByCode: vi.fn() } }));
vi.mock('./telemetryService.js', () => ({ TelemetryService: { emitSafe: vi.fn() } }));

import { QuizModel } from '../models/QuizModel.js';
import { InvitationModel } from '../models/InvitationModel.js';
import { CoupleSessionModel } from '../models/CoupleSessionModel.js';
import { QuizService } from './quizService.js';
import { InvitationService } from './invitationService.js';
import { CoupleService } from './coupleService.js';

const OPTIONS = ['Reading', 'Walking', 'Gaming', 'Cooking'];

const draftQuiz = (overrides: Record<string, unknown> = {}) => ({
  id: 'quiz-1', title: 'A little about us', is_open: true, is_active: true,
  appearance: { theme: 'peach', style: 'editorial' },
  user_id: null, draft_token: 'secret-draft-token', ...overrides,
});

const expectNoOwnershipSecrets = (quiz: unknown) => {
  expect(quiz).toMatchObject({ id: 'quiz-1', title: 'A little about us' });
  expect(quiz).not.toHaveProperty('draft_token');
  expect(quiz).not.toHaveProperty('user_id');
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(QuizModel.findActiveById).mockResolvedValue(draftQuiz());
  vi.mocked(QuizModel.findById).mockResolvedValue(draftQuiz());
  vi.mocked(QuizModel.getQuestions).mockResolvedValue([{
    id: 'q-1', quiz_id: 'quiz-1', category: 'Leisure', question_text: 'Favorite hobby?', order_number: 1,
    emoji: '', correct_answers: ['Reading'], distractor_answers: ['Walking', 'Gaming', 'Cooking'],
  }]);
});

describe('take payload', () => {
  it('offers every option without saying which ones are wrong', async () => {
    const { questions } = await QuizService.getTakePayload('quiz-1');
    expect(questions[0]).not.toHaveProperty('correct_answers');
    expect(questions[0]).not.toHaveProperty('distractor_answers');
    expect([...questions[0].choices].sort()).toEqual([...OPTIONS].sort());
  });

  it('shuffles options so position does not reveal the correct answer', async () => {
    const positions = new Set<number>();
    for (let run = 0; run < 200; run += 1) {
      const { questions } = await QuizService.getTakePayload('quiz-1');
      positions.add(questions[0].choices.indexOf('Reading'));
    }
    expect([...positions].sort()).toEqual([0, 1, 2, 3]);
  });

  it('keeps what the player needs and drops the draft token and owner', async () => {
    const { quiz } = await QuizService.getTakePayload('quiz-1');
    expect(quiz).toMatchObject({ is_open: true, appearance: { theme: 'peach', style: 'editorial' } });
    expectNoOwnershipSecrets(quiz);
  });
});

describe('other public quiz lookups', () => {
  it('hides the draft token when verifying an open quiz', async () => {
    const result = await InvitationService.verify('quiz-1', '');
    expectNoOwnershipSecrets(result.quiz);
  });

  it('hides the draft token when verifying an invitation code', async () => {
    vi.mocked(QuizModel.findActiveById).mockResolvedValue(draftQuiz({ is_open: false }));
    vi.mocked(InvitationModel.findByQuizAndCode).mockResolvedValue({ id: 'inv-1', quiz_id: 'quiz-1', code: 'ABC234', is_used: false });
    const result = await InvitationService.verify('quiz-1', 'ABC234');
    expect(result.invitation).toMatchObject({ code: 'ABC234' });
    expectNoOwnershipSecrets(result.quiz);
  });

  it('hides the draft token when loading a couple session', async () => {
    vi.mocked(CoupleSessionModel.findByCode).mockResolvedValue({ id: 'session-1', quiz_id: 'quiz-1', session_code: 'MATCH1' });
    const result = await CoupleService.getByCode('MATCH1');
    expectNoOwnershipSecrets(result.quiz);
  });
});
