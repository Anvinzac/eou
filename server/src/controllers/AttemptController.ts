import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { AttemptService, submitAttemptSchema } from '../services/attemptService.js';
import { unauthorized } from '../lib/errors.js';

export const AttemptController = {
  async submit(req: AuthedRequest, res: Response) {
    const body = submitAttemptSchema.parse(req.body);
    const result = await AttemptService.submit(req.params.id, body);
    res.status(201).json(result);
  },

  async get(req: AuthedRequest, res: Response) {
    const result = await AttemptService.getAttempt(req.params.id);
    res.json(result);
  },

  async listForQuiz(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const attempts = await AttemptService.listForOwner(req.user.id, req.params.id);
    res.json({ attempts });
  },

  async leaderboard(req: AuthedRequest, res: Response) {
    const attempts = await AttemptService.leaderboard(req.params.id);
    res.json({ attempts });
  },
};
