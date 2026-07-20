import { z } from 'zod';
import { QuestionPackModel } from '../models/QuestionPackModel.js';
import { badRequest } from '../lib/errors.js';
import { TelemetryService } from './telemetryService.js';

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
    const pack = await QuestionPackModel.create({
      user_id: userId,
      title: body.title.trim(),
      description: (body.description || '').trim(),
      emoji: body.emoji || '📦',
      questions: validQuestions,
      is_system: false,
    });
    TelemetryService.emitSafe({
      event_type: 'content.created',
      actor_user_id: userId,
      entity_type: 'question_pack',
      entity_id: pack.id,
      metadata: { title: pack.title },
    });
    return pack;
  },

  async update(userId: string, id: string, body: z.infer<typeof packBodySchema>) {
    const validQuestions = body.questions.filter((q) => q.text.trim());
    if (validQuestions.length < 1) throw badRequest('Add at least 1 question');
    const pack = await QuestionPackModel.update(id, userId, {
      title: body.title.trim(),
      description: (body.description || '').trim(),
      emoji: body.emoji || '📦',
      questions: validQuestions,
    });
    TelemetryService.emitSafe({
      event_type: 'content.updated',
      actor_user_id: userId,
      entity_type: 'question_pack',
      entity_id: id,
      metadata: { title: body.title.trim() },
    });
    return pack;
  },

  async remove(userId: string, id: string) {
    await QuestionPackModel.remove(id, userId);
    TelemetryService.emitSafe({
      event_type: 'content.deleted',
      actor_user_id: userId,
      entity_type: 'question_pack',
      entity_id: id,
      metadata: {},
    });
  },
};
