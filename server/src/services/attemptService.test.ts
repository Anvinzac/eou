import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/QuizModel.js', () => ({ QuizModel: {
  findActiveById: vi.fn(), findById: vi.fn(), getQuestions: vi.fn(),
} }));
vi.mock('../models/InvitationModel.js', () => ({ InvitationModel: {
  findById: vi.fn(), findByQuizAndCode: vi.fn(), claim: vi.fn(), release: vi.fn(),
} }));
vi.mock('../models/AttemptModel.js', () => ({ AttemptModel: {
  create: vi.fn(), insertResponses: vi.fn(), findById: vi.fn(),
} }));
vi.mock('../models/CoupleSessionModel.js', () => ({ CoupleSessionModel: {} }));
vi.mock('./telemetryService.js', () => ({ TelemetryService: { emitSafe: vi.fn() } }));

import { QuizModel } from '../models/QuizModel.js';
import { InvitationModel } from '../models/InvitationModel.js';
import { AttemptModel } from '../models/AttemptModel.js';
import { AttemptService, submitAttemptSchema } from './attemptService.js';

const QUIZ_ID = 'quiz-1';
const INVITE_ID = '2f1b0c1e-8d3a-4c57-9a55-0d5a3c1b7e10';

const questions = [
  { id: 'q1', question_text: 'Favorite dinner?', category: 'Food', order_number: 1, correct_answers: ['Pizza'], distractor_answers: ['Pho', 'Sushi', 'Tacos'] },
  { id: 'q2', question_text: 'Dream trip?', category: 'Travel', order_number: 2, correct_answers: ['Beach'], distractor_answers: ['City', 'Mountains', 'Desert'] },
];

const submission = (overrides: Record<string, unknown> = {}) =>
  submitAttemptSchema.parse({ answers: { q1: 'Pizza', q2: 'City' }, ...overrides });

const invitation = (overrides: Record<string, unknown> = {}) => ({
  id: INVITE_ID, quiz_id: QUIZ_ID, code: 'ABC234', label: 'Sam', is_used: false, ...overrides,
});

const quiz = (overrides: Record<string, unknown> = {}) => ({
  id: QUIZ_ID, title: 'A little about us', is_open: false, ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(QuizModel.findActiveById).mockResolvedValue(quiz());
  vi.mocked(QuizModel.getQuestions).mockResolvedValue(questions);
  vi.mocked(InvitationModel.claim).mockResolvedValue(true);
  vi.mocked(AttemptModel.create).mockImplementation(async row => ({ id: 'attempt-1', ...row }));
  vi.mocked(AttemptModel.insertResponses).mockImplementation(async rows => rows);
});

describe('attempt scoring', () => {
  it('scores on the server and records correctness per question', async () => {
    vi.mocked(QuizModel.findActiveById).mockResolvedValue(quiz({ is_open: true }));
    const result = await AttemptService.submit(QUIZ_ID, submission());
    expect(result.attempt).toMatchObject({ quiz_id: QUIZ_ID, invitation_id: null, score: 1, total_questions: 2 });
    expect(AttemptModel.insertResponses).toHaveBeenCalledWith([
      { attempt_id: 'attempt-1', question_id: 'q1', selected_answer: 'Pizza', is_correct: true },
      { attempt_id: 'attempt-1', question_id: 'q2', selected_answer: 'City', is_correct: false },
    ]);
    expect(result.redirectTo).toBe('/result/attempt-1');
    expect(InvitationModel.claim).not.toHaveBeenCalled();
  });

  it('requires every question to be answered on a regular quiz', async () => {
    vi.mocked(QuizModel.findActiveById).mockResolvedValue(quiz({ is_open: true }));
    await expect(AttemptService.submit(QUIZ_ID, submission({ answers: { q1: 'Pizza' } })))
      .rejects.toThrow('Please answer all questions');
    expect(AttemptModel.create).not.toHaveBeenCalled();
  });

  it('never counts timeout or cheat markers as correct on a versus quiz', async () => {
    vi.mocked(QuizModel.findActiveById).mockResolvedValue(quiz({ is_open: true, title: '[Versus] Science Challenge' }));
    const result = await AttemptService.submit(QUIZ_ID, submission({
      answers: { q1: 'Pizza', q2: '___TIMED_OUT___' }, versusFlags: { timedOut: true },
    }));
    expect(result.attempt.score).toBe(1);
    expect(vi.mocked(AttemptModel.insertResponses).mock.calls[0][0][1])
      .toMatchObject({ question_id: 'q2', selected_answer: '___TIMED_OUT___', is_correct: false });
  });
});

describe('invitation enforcement', () => {
  it('requires an invitation for an invite-only quiz', async () => {
    await expect(AttemptService.submit(QUIZ_ID, submission())).rejects.toThrow('Invitation required for this quiz');
    expect(AttemptModel.create).not.toHaveBeenCalled();
  });

  it('accepts a valid invitation id and claims it before saving the attempt', async () => {
    vi.mocked(InvitationModel.findById).mockResolvedValue(invitation());
    const result = await AttemptService.submit(QUIZ_ID, submission({ invitationId: INVITE_ID }));
    expect(result.attempt.invitation_id).toBe(INVITE_ID);
    expect(InvitationModel.claim).toHaveBeenCalledWith(INVITE_ID);
    expect(vi.mocked(InvitationModel.claim).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(AttemptModel.create).mock.invocationCallOrder[0]);
    expect(InvitationModel.release).not.toHaveBeenCalled();
  });

  it('accepts a valid invitation code and claims it', async () => {
    vi.mocked(InvitationModel.findByQuizAndCode).mockResolvedValue(invitation());
    const result = await AttemptService.submit(QUIZ_ID, submission({ invitationCode: 'ABC234' }));
    expect(InvitationModel.findByQuizAndCode).toHaveBeenCalledWith(QUIZ_ID, 'ABC234');
    expect(result.attempt.invitation_id).toBe(INVITE_ID);
    expect(InvitationModel.claim).toHaveBeenCalledWith(INVITE_ID);
  });

  it('rejects an invitation id that belongs to another quiz', async () => {
    vi.mocked(InvitationModel.findById).mockResolvedValue(invitation({ quiz_id: 'someone-elses-quiz' }));
    await expect(AttemptService.submit(QUIZ_ID, submission({ invitationId: INVITE_ID })))
      .rejects.toThrow('Invalid invitation');
    expect(InvitationModel.claim).not.toHaveBeenCalled();
    expect(AttemptModel.create).not.toHaveBeenCalled();
  });

  it('rejects an invitation id that does not exist', async () => {
    vi.mocked(InvitationModel.findById).mockResolvedValue(null);
    await expect(AttemptService.submit(QUIZ_ID, submission({ invitationId: INVITE_ID })))
      .rejects.toThrow('Invalid invitation');
    expect(AttemptModel.create).not.toHaveBeenCalled();
  });

  it('rejects an invitation id that was already used, even with its code attached', async () => {
    vi.mocked(InvitationModel.findById).mockResolvedValue(invitation({ is_used: true }));
    vi.mocked(InvitationModel.findByQuizAndCode).mockResolvedValue(invitation({ is_used: true }));
    await expect(AttemptService.submit(QUIZ_ID, submission({ invitationId: INVITE_ID, invitationCode: 'ABC234' })))
      .rejects.toThrow('Invitation already used');
    expect(InvitationModel.claim).not.toHaveBeenCalled();
    expect(AttemptModel.create).not.toHaveBeenCalled();
  });

  it('rejects the loser when two submissions race for the same invitation', async () => {
    vi.mocked(InvitationModel.findById).mockResolvedValue(invitation());
    vi.mocked(InvitationModel.claim).mockResolvedValue(false);
    await expect(AttemptService.submit(QUIZ_ID, submission({ invitationId: INVITE_ID })))
      .rejects.toThrow('Invitation already used');
    expect(AttemptModel.create).not.toHaveBeenCalled();
  });

  it('releases the invitation when the attempt cannot be saved', async () => {
    vi.mocked(InvitationModel.findById).mockResolvedValue(invitation());
    vi.mocked(AttemptModel.create).mockRejectedValue(new Error('database unavailable'));
    await expect(AttemptService.submit(QUIZ_ID, submission({ invitationId: INVITE_ID })))
      .rejects.toThrow('database unavailable');
    expect(InvitationModel.release).toHaveBeenCalledWith(INVITE_ID);
  });
});

describe('attempt lookup', () => {
  it('does not expose the draft token or owner of the quiz', async () => {
    vi.mocked(AttemptModel.findById).mockResolvedValue({ id: 'attempt-1', quiz_id: QUIZ_ID, score: 1 });
    vi.mocked(QuizModel.findById).mockResolvedValue(quiz({ user_id: null, draft_token: 'secret-draft-token' }));
    const result = await AttemptService.getAttempt('attempt-1');
    expect(result.quiz).toMatchObject({ id: QUIZ_ID, title: 'A little about us' });
    expect(result.quiz).not.toHaveProperty('draft_token');
    expect(result.quiz).not.toHaveProperty('user_id');
  });
});
