import { CoupleSessionModel } from '../models/CoupleSessionModel.js';
import { QuizModel } from '../models/QuizModel.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { generateInviteCode } from './nameGenerator.js';

export const CoupleService = {
  async create(quizId: string, firstName: string) {
    const quiz = await QuizModel.findActiveById(quizId);
    if (!quiz) throw notFound('Quiz not found');
    const name = firstName.trim();
    if (!name) throw badRequest('Add your name before starting couple mode');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await CoupleSessionModel.create({
          quiz_id: quizId,
          session_code: generateInviteCode(),
          first_name: name,
        });
      } catch {
        /* retry on unique code collision */
      }
    }
    throw badRequest('Unable to create a couple session right now');
  },

  async join(quizId: string, code: string, name: string) {
    const normalized = code.trim().toUpperCase();
    const trimmed = name.trim();
    if (!trimmed) throw badRequest('Add your name before joining couple mode');
    if (!normalized) throw badRequest('Enter a couple code to join');

    const session = await CoupleSessionModel.findByQuizAndCode(quizId, normalized);
    if (!session) throw notFound('Couple code not found');
    if (session.status === 'completed' || session.second_attempt_id) {
      throw conflict('This couple session is already completed');
    }
    if (session.second_name) {
      throw conflict('This couple session already has two participants');
    }

    return CoupleSessionModel.update(session.id, { second_name: trimmed });
  },

  async getByCode(code: string) {
    const session = await CoupleSessionModel.findByCode(code);
    if (!session) throw notFound('Couple session not found');
    const quiz = await QuizModel.findById(session.quiz_id);
    return { session, quiz };
  },

  async listForOwner(userId: string, quizId: string) {
    await QuizModel.requireOwned(quizId, userId);
    return CoupleSessionModel.listByQuiz(quizId);
  },
};
