import type { NextFunction, Request, Response } from 'express';
import type { User } from '@supabase/supabase-js';
import { getUserFromToken } from '../lib/supabase.js';
import { unauthorized } from '../lib/errors.js';

export type AuthedRequest = Request & {
  user?: User;
  accessToken?: string;
};

export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (token) {
      const user = await getUserFromToken(token);
      if (user) {
        req.user = user;
        req.accessToken = token;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw unauthorized();
    const user = await getUserFromToken(token);
    if (!user) throw unauthorized('Invalid or expired token');
    req.user = user;
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}
