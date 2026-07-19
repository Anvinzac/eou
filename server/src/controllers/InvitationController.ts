import type { Response } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { createInvitesSchema, InvitationService } from '../services/invitationService.js';
import { unauthorized } from '../lib/errors.js';

export const InvitationController = {
  async create(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const body = createInvitesSchema.parse(req.body);
    const invitations = await InvitationService.create(req.user.id, req.params.id, body.labels);
    res.status(201).json({ invitations });
  },

  async list(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const invitations = await InvitationService.list(req.user.id, req.params.id);
    res.json({ invitations });
  },

  async verify(req: AuthedRequest, res: Response) {
    const body = z
      .object({
        quizId: z.string().uuid(),
        code: z.string().optional().default(''),
      })
      .parse(req.body);
    const result = await InvitationService.verify(body.quizId, body.code);
    res.json(result);
  },
};
