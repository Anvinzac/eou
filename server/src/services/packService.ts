import { z } from 'zod';
import { QuestionPackModel } from '../models/QuestionPackModel.js';
import { badRequest } from '../lib/errors.js';

export const packBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  emoji: z.string().optional().default('📦'),
  questions: z
    .array(
      z.object({
        text: z.string().min(1),
        category: z.string().optional().default('Custom'),
        options: z.array(z.string()).optional().default([]),
      }),
    )
    .min(1)
    .max(10),
});

export const PackService = {
  listVisible(userId?: string) {
    return QuestionPackModel.listVisible(userId);
  },

  listMine(userId: string) {
    return QuestionPackModel.listMine(userId);
  },

  async create(userId: string, body: z.infer<typeof packBodySchema>) {
    const validQuestions = body.questions.filter((q) => q.text.trim());
    if (validQuestions.length < 1) throw badRequest('Add at least 1 question');
    return QuestionPackModel.create({
      user_id: userId,
      title: body.title.trim(),
      description: (body.description || '').trim(),
      emoji: body.emoji || '📦',
      questions: validQuestions,
      is_system: false,
    });
  },

  async update(userId: string, id: string, body: z.infer<typeof packBodySchema>) {
    const validQuestions = body.questions.filter((q) => q.text.trim());
    if (validQuestions.length < 1) throw badRequest('Add at least 1 question');
    return QuestionPackModel.update(id, userId, {
      title: body.title.trim(),
      description: (body.description || '').trim(),
      emoji: body.emoji || '📦',
      questions: validQuestions,
    });
  },

  remove(userId: string, id: string) {
    return QuestionPackModel.remove(id, userId);
  },
};
