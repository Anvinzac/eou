import { z } from 'zod';
import { AttemptModel } from '../models/AttemptModel.js';
import { InvitationModel } from '../models/InvitationModel.js';
import { QuizModel } from '../models/QuizModel.js';
import { CoupleSessionModel } from '../models/CoupleSessionModel.js';
import { buildCoupleMatchSummary } from './coupleMatching.js';
import { badRequest, notFound } from '../lib/errors.js';

export const submitAttemptSchema = z.object({
  answers: z.record(z.string(), z.string().nullable()),
  respondentName: z.string().optional().nullable(),
  invitationId: z.string().uuid().optional().nullable(),
  invitationCode: z.string().optional().nullable(),
  coupleSessionCode: z.string().optional().nullable(),
  coupleSlot: z.enum(['first', 'second']).optional().nullable(),
  versusFlags: z
    .object({
      timedOut: z.boolean().optional(),
      cheated: z.boolean().optional(),
    })
    .optional(),
});

export type SubmitAttemptBody = z.infer<typeof submitAttemptSchema>;

function isVersusTitle(title: string) {
  return title.startsWith('[Versus]');
}

export const AttemptService = {
  async submit(quizId: string, body: SubmitAttemptBody) {
    const quiz = await QuizModel.findActiveById(quizId);
    if (!quiz) throw notFound('Quiz not found');

    const questions = await QuizModel.getQuestions(quizId);
    if (questions.length === 0) throw badRequest('Quiz has no questions');

    const versus = isVersusTitle(quiz.title);
    const answeredCount = Object.values(body.answers).filter((a) => a && a !== '___TIMED_OUT___' && a !== '___CHEATED___').length;

    if (!versus && answeredCount < questions.length) {
      throw badRequest('Please answer all questions');
    }

    let invitationId = body.invitationId || null;
    if (!invitationId && body.invitationCode) {
      const invite = await InvitationModel.findByQuizAndCode(quizId, body.invitationCode);
      if (!invite) throw badRequest('Invalid invitation code');
      if (invite.is_used) throw badRequest('Invitation already used');
      invitationId = invite.id;
    }

    if (!quiz.is_open && !invitationId) {
      throw badRequest('Invitation required for this quiz');
    }

    let score = 0;
    const responseRows = questions.map((question) => {
      let selected = body.answers[question.id] ?? null;
      if (body.versusFlags?.cheated) selected = '___CHEATED___';
      else if (body.versusFlags?.timedOut && !selected) selected = '___TIMED_OUT___';

      const isCorrect =
        !!selected &&
        selected !== '___TIMED_OUT___' &&
        selected !== '___CHEATED___' &&
        (question.correct_answers || []).includes(selected);

      if (isCorrect) score += 1;
      return {
        question_id: question.id,
        selected_answer: selected,
        is_correct: isCorrect,
      };
    });

    const attempt = await AttemptModel.create({
      quiz_id: quizId,
      invitation_id: invitationId,
      respondent_name: body.respondentName?.trim() || null,
      score,
      total_questions: questions.length,
      completed_at: new Date().toISOString(),
    });

    const responses = await AttemptModel.insertResponses(
      responseRows.map((r) => ({ ...r, attempt_id: attempt.id })),
    );

    if (invitationId) {
      await InvitationModel.markUsed(invitationId);
    }

    let coupleSession = null;
    if (body.coupleSessionCode && body.coupleSlot) {
      coupleSession = await this.syncCouple(
        quizId,
        body.coupleSessionCode,
        body.coupleSlot,
        attempt.id,
        body.respondentName?.trim() || '',
        questions,
      );
    }

    return {
      attempt,
      responses,
      coupleSession,
      redirectTo: coupleSession?.status === 'completed'
        ? `/couple/${coupleSession.session_code}`
        : `/result/${attempt.id}`,
    };
  },

  async syncCouple(
    quizId: string,
    sessionCode: string,
    slot: 'first' | 'second',
    attemptId: string,
    name: string,
    questions: Array<{ id: string; question_text: string; category: string; order_number: number }>,
  ) {
    const latest = await CoupleSessionModel.findByQuizAndCode(quizId, sessionCode);
    if (!latest) throw notFound('Couple session no longer exists');

    const baseUpdate =
      slot === 'first'
        ? { first_attempt_id: attemptId, first_name: name || latest.first_name, status: 'waiting', completed_at: null }
        : { second_attempt_id: attemptId, second_name: name || latest.second_name, status: 'waiting', completed_at: null };

    const updated = await CoupleSessionModel.update(latest.id, baseUpdate);
    const firstAttemptId = slot === 'first' ? attemptId : updated.first_attempt_id;
    const secondAttemptId = slot === 'second' ? attemptId : updated.second_attempt_id;

    if (!firstAttemptId || !secondAttemptId) return updated;

    const storedResponses = await AttemptModel.getResponsesByAttemptIds([firstAttemptId, secondAttemptId]);
    const firstResponses = storedResponses.filter((r) => r.attempt_id === firstAttemptId);
    const secondResponses = storedResponses.filter((r) => r.attempt_id === secondAttemptId);
    const summary = buildCoupleMatchSummary(questions, firstResponses, secondResponses);

    return CoupleSessionModel.update(updated.id, {
      first_attempt_id: firstAttemptId,
      second_attempt_id: secondAttemptId,
      status: 'completed',
      match_percentage: summary.matchPercentage,
      match_count: summary.matchCount,
      total_compared: summary.totalCompared,
      match_details: summary.details,
      completed_at: new Date().toISOString(),
    });
  },

  async getAttempt(attemptId: string) {
    const attempt = await AttemptModel.findById(attemptId);
    if (!attempt) throw notFound('Attempt not found');
    const quiz = await QuizModel.findById(attempt.quiz_id);
    return { attempt, quiz };
  },

  async listForOwner(userId: string, quizId: string) {
    await QuizModel.requireOwned(quizId, userId);
    return AttemptModel.listByQuiz(quizId);
  },

  async leaderboard(quizId: string) {
    const quiz = await QuizModel.findActiveById(quizId);
    if (!quiz) throw notFound('Quiz not found');
    return AttemptModel.leaderboard(quizId, 10);
  },
};
