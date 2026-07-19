import { z } from 'zod';
import { InvitationModel } from '../models/InvitationModel.js';
import { QuizModel } from '../models/QuizModel.js';
import { badRequest, notFound } from '../lib/errors.js';
import { generateCloudName, generateInviteCode } from './nameGenerator.js';

export const createInvitesSchema = z.object({
  labels: z.array(z.string()).min(1).max(20),
});

export const InvitationService = {
  async create(userId: string, quizId: string, labels: string[]) {
    await QuizModel.requireOwned(quizId, userId);
    const rows = labels.map((label) => ({
      quiz_id: quizId,
      code: generateInviteCode(),
      label: label.trim() || generateCloudName(),
    }));
    return InvitationModel.createMany(rows);
  },

  async list(userId: string, quizId: string) {
    await QuizModel.requireOwned(quizId, userId);
    return InvitationModel.listByQuiz(quizId);
  },

  async verify(quizId: string, code: string) {
    const quiz = await QuizModel.findActiveById(quizId);
    if (!quiz) throw notFound('Quiz not found');
    if (quiz.is_open) {
      return { verified: true, invitation: null, quiz };
    }
    if (!code) throw badRequest('Invitation code required');
    const invitation = await InvitationModel.findByQuizAndCode(quizId, code);
    if (!invitation) throw badRequest('Invalid invitation code');
    if (invitation.is_used) throw badRequest('Invitation already used');
    return { verified: true, invitation, quiz };
  },
};
