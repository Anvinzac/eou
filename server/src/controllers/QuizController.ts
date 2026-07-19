import type { Response } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { createQuizBodySchema, QuizService } from '../services/quizService.js';
import { unauthorized } from '../lib/errors.js';

export const QuizController = {
  async create(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const body = createQuizBodySchema.parse(req.body);
    const result = await QuizService.createOwned(req.user.id, body);
    res.status(201).json(result);
  },

  async createDraft(req: AuthedRequest, res: Response) {
    const body = createQuizBodySchema.parse(req.body);
    const result = await QuizService.createDraft(body);
    res.status(201).json(result);
  },

  async listMine(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const quizzes = await QuizService.listMine(req.user.id);
    res.json({ quizzes });
  },

  async getTake(req: AuthedRequest, res: Response) {
    const result = await QuizService.getTakePayload(req.params.id);
    res.json(result);
  },

  async patch(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const body = z
      .object({
        title: z.string().optional(),
        is_open: z.boolean().optional(),
      })
      .parse(req.body);
    const quiz = await QuizService.patchQuiz(req.user.id, req.params.id, body);
    res.json({ quiz });
  },

  async createVersus(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const body = z
      .object({
        category: z.string().min(1),
        difficulty: z.string().min(1),
      })
      .parse(req.body);
    const result = await QuizService.createVersus(req.user.id, body.category, body.difficulty);
    res.status(201).json(result);
  },
};
