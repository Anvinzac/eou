import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { ShareService } from '../services/shareService.js';
import { unauthorized } from '../lib/errors.js';

export const ShareController = {
  async createLink(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    res.json(await ShareService.getOrCreateLink(req.user.id, req.params.id));
  },

  /** GET /s/:code — redirects people to the quiz; serves preview tags to link crawlers. */
  async visit(req: Request, res: Response) {
    const result = await ShareService.visit(req.params.code, req.get('user-agent') || '');
    res.set('X-Content-Type-Options', 'nosniff');
    if (result.status === 302) {
      res.set('Cache-Control', 'no-store').redirect(302, result.location);
      return;
    }
    res.status(result.status).set('Cache-Control', 'public, max-age=300').type('html').send(result.html);
  },
};
