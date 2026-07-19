import { randomUUID } from 'crypto';
import { z } from 'zod';
import { QuizModel } from '../models/QuizModel.js';
import { InvitationModel } from '../models/InvitationModel.js';
import { badRequest, notFound } from '../lib/errors.js';
import { containsProfanity } from './profanity.js';
import { generateInviteCode } from './nameGenerator.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const academicData = require('../data/academic.json') as {
  questions: Array<{
    id: number;
    category: string;
    difficulty: string;
    text: string;
    options: string[];
    correctAnswer: string;
  }>;
};

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 10;

const questionSchema = z.object({
  questionId: z.number(),
  category: z.string().min(1),
  text: z.string().min(1),
  orderNumber: z.number().int().positive(),
  correctAnswer: z.string().optional().default(''),
  distractors: z.array(z.string()).optional().default([]),
  isCustom: z.boolean().optional(),
});

export const createQuizBodySchema = z.object({
  title: z.string().min(1).max(80),
  questions: z.array(questionSchema).min(1).max(MAX_QUESTIONS),
});

export type CreateQuizBody = z.infer<typeof createQuizBodySchema>;

function assertCleanText(...texts: string[]) {
  for (const text of texts) {
    if (text && containsProfanity(text)) {
      throw badRequest('Please remove inappropriate language');
    }
  }
}

function toQuestionRows(quizId: string, questions: CreateQuizBody['questions']) {
  return questions.map((q) => ({
    quiz_id: quizId,
    question_ref_id: q.questionId,
    category: q.category,
    question_text: q.text,
    order_number: q.orderNumber,
    correct_answers: [q.correctAnswer || ''],
    distractor_answers: (q.distractors || []).slice(0, 3),
    is_custom: !!q.isCustom,
  }));
}

export const QuizService = {
  async createOwned(userId: string, body: CreateQuizBody) {
    if (body.questions.length < MIN_QUESTIONS) {
      throw badRequest(`At least ${MIN_QUESTIONS} questions required`);
    }
    const incomplete = body.questions.find(
      (q) => !q.correctAnswer || (q.distractors || []).filter(Boolean).length < 3,
    );
    if (incomplete) throw badRequest('Please set answers for all questions');

    assertCleanText(body.title, ...body.questions.flatMap((q) => [q.text, q.correctAnswer, ...(q.distractors || [])]));

    const quiz = await QuizModel.create({
      user_id: userId,
      title: body.title.trim(),
      max_questions: MAX_QUESTIONS,
    });
    const questions = await QuizModel.insertQuestions(toQuestionRows(quiz.id, body.questions));
    return { quiz, questions };
  },

  async createDraft(body: CreateQuizBody) {
    assertCleanText(body.title, ...body.questions.flatMap((q) => [q.text, q.correctAnswer || '', ...(q.distractors || [])]));
    const draftToken = randomUUID();
    const quiz = await QuizModel.create({
      user_id: null,
      title: body.title.trim(),
      max_questions: MAX_QUESTIONS,
      draft_token: draftToken,
    });
    const questions = await QuizModel.insertQuestions(toQuestionRows(quiz.id, body.questions));
    return { quiz, questions, draftToken };
  },

  async claimDraft(userId: string, quizId: string, draftToken: string) {
    const quiz = await QuizModel.claimDraft(quizId, draftToken, userId);
    if (!quiz) throw notFound('Draft not found or already claimed');
    return quiz;
  },

  async getTakePayload(quizId: string) {
    const quiz = await QuizModel.findActiveById(quizId);
    if (!quiz) throw notFound('Quiz not found');
    const questions = await QuizModel.getQuestions(quizId);
    // Strip correct answers from take payload — scoring happens server-side.
    const publicQuestions = questions.map((q) => ({
      id: q.id,
      quiz_id: q.quiz_id,
      category: q.category,
      question_text: q.question_text,
      order_number: q.order_number,
      distractor_answers: q.distractor_answers,
      // Include all choices without revealing which are correct:
      choices: [...(q.correct_answers || []), ...(q.distractor_answers || [])],
      is_custom: q.is_custom,
      question_ref_id: q.question_ref_id,
    }));
    return { quiz, questions: publicQuestions };
  },

  async patchQuiz(userId: string, quizId: string, patch: { title?: string; is_open?: boolean }) {
    await QuizModel.requireOwned(quizId, userId);
    const updates: Record<string, unknown> = {};
    if (typeof patch.title === 'string') {
      const title = patch.title.trim();
      if (!title || title.length > 50) throw badRequest('Title must be 1–50 characters');
      assertCleanText(title);
      updates.title = title;
    }
    if (typeof patch.is_open === 'boolean') updates.is_open = patch.is_open;
    if (Object.keys(updates).length === 0) throw badRequest('No changes provided');
    return QuizModel.update(quizId, updates);
  },

  async createVersus(userId: string, category: string, difficulty: string) {
    const pool = academicData.questions.filter(
      (q) => q.category === category && q.difficulty === difficulty,
    );
    if (pool.length === 0) throw badRequest('No questions available for this difficulty');

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selectedQs = shuffled.slice(0, 5);
    const title = `[Versus] ${category} Challenge`;

    const quiz = await QuizModel.create({
      user_id: userId,
      title,
      max_questions: selectedQs.length,
      is_open: true,
    });

    const questions = await QuizModel.insertQuestions(
      selectedQs.map((q, i) => ({
        quiz_id: quiz.id,
        question_ref_id: q.id,
        category: q.category,
        question_text: q.text,
        order_number: i + 1,
        correct_answers: [q.correctAnswer],
        distractor_answers: q.options.filter((o) => o !== q.correctAnswer),
        is_custom: true,
      })),
    );

    const [invitation] = await InvitationModel.createMany([
      {
        quiz_id: quiz.id,
        code: generateInviteCode(),
        label: 'Open Challenge',
      },
    ]);

    return { quiz, questions, invitation };
  },

  async listMine(userId: string) {
    return QuizModel.listByUser(userId);
  },
};
