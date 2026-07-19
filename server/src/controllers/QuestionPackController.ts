import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { PackService, packBodySchema } from '../services/packService.js';
import { unauthorized } from '../lib/errors.js';

export const QuestionPackController = {
  async list(req: AuthedRequest, res: Response) {
    const packs = await PackService.listVisible(req.user?.id);
    res.json({ packs });
  },

  async listMine(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const packs = await PackService.listMine(req.user.id);
    res.json({ packs });
  },

  async create(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const body = packBodySchema.parse(req.body);
    const pack = await PackService.create(req.user.id, body);
    res.status(201).json({ pack });
  },

  async update(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const body = packBodySchema.parse(req.body);
    const pack = await PackService.update(req.user.id, req.params.id, body);
    res.json({ pack });
  },

  async remove(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    await PackService.remove(req.user.id, req.params.id);
    res.status(204).send();
  },
};
