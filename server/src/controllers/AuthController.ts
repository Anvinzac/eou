import type { Response } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { signInWithPassword, signUpWithPassword } from '../lib/supabase.js';
import { AdminModel } from '../models/AdminModel.js';
import { QuizService } from '../services/quizService.js';
import { TelemetryService } from '../services/telemetryService.js';
import { badRequest, unauthorized } from '../lib/errors.js';

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional(),
});

export const AuthController = {
  async signup(req: AuthedRequest, res: Response) {
    const body = credsSchema.parse(req.body);
    const { data, error } = await signUpWithPassword(body.email, body.password, body.displayName);
    if (error) throw badRequest(error.message);
    if (data.user) {
      TelemetryService.emitSafe({
        event_type: 'user.registered',
        actor_user_id: data.user.id,
        entity_type: 'profile',
        entity_id: data.user.id,
        metadata: { email: body.email, display_name: body.displayName },
      });
    }
    res.status(201).json({
      user: data.user,
      session: data.session,
    });
  },

  async signin(req: AuthedRequest, res: Response) {
    const body = credsSchema.pick({ email: true, password: true }).parse(req.body);
    const { data, error } = await signInWithPassword(body.email, body.password);
    if (error) throw unauthorized(error.message);
    res.json({
      user: data.user,
      session: data.session,
    });
  },

  async me(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const isAdmin = await AdminModel.hasRole(req.user.id, 'admin');
    res.json({
      user: req.user,
      roles: { admin: isAdmin },
    });
  },

  async claimDraft(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const body = z
      .object({
        quizId: z.string().uuid(),
        draftToken: z.string().min(1),
      })
      .parse(req.body);
    const quiz = await QuizService.claimDraft(req.user.id, body.quizId, body.draftToken);
    res.json({ quiz });
  },
};
