import type { Response } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { CoupleService } from '../services/coupleService.js';
import { unauthorized } from '../lib/errors.js';

export const CoupleController = {
  async create(req: AuthedRequest, res: Response) {
    const body = z.object({ name: z.string().min(1) }).parse(req.body);
    const session = await CoupleService.create(req.params.id, body.name);
    res.status(201).json({ session, slot: 'first' as const });
  },

  async join(req: AuthedRequest, res: Response) {
    const body = z
      .object({
        quizId: z.string().uuid(),
        code: z.string().min(1),
        name: z.string().min(1),
      })
      .parse(req.body);
    const session = await CoupleService.join(body.quizId, body.code, body.name);
    res.json({ session, slot: 'second' as const });
  },

  async getByCode(req: AuthedRequest, res: Response) {
    const result = await CoupleService.getByCode(req.params.code);
    res.json(result);
  },

  async listForQuiz(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const sessions = await CoupleService.listForOwner(req.user.id, req.params.id);
    res.json({ sessions });
  },
};
