import type { Response } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { AdminModel } from '../models/AdminModel.js';

export const AdminController = {
  async featureFlags(_req: AuthedRequest, res: Response) {
    const flags = await AdminModel.listFeatureFlags();
    res.json({ flags });
  },

  async toggleFlag(req: AuthedRequest, res: Response) {
    const body = z.object({ is_enabled: z.boolean() }).parse(req.body);
    const flag = await AdminModel.toggleFlag(req.params.id, body.is_enabled);
    res.json({ flag });
  },

  async profiles(_req: AuthedRequest, res: Response) {
    const profiles = await AdminModel.listProfiles();
    res.json({ profiles });
  },
};
