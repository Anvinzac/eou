import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from './auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export async function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthorized();
    const { data, error } = await supabaseAdmin.rpc('has_role', {
      _user_id: req.user.id,
      _role: 'admin',
    });
    if (error) throw error;
    if (!data) throw forbidden('Admin access required');
    next();
  } catch (err) {
    next(err);
  }
}
