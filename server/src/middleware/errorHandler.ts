import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors.js';
import { ZodError } from 'zod';
import { TelemetryService } from '../services/telemetryService.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    return;
  }

  if (err instanceof HttpError) {
    if (err.status >= 500) {
      TelemetryService.emitSafe({
        event_type: 'error.reported',
        severity: err.status >= 500 ? 'error' : 'warn',
        metadata: {
          message: err.message,
          status: err.status,
          path: req.path,
          method: req.method,
          source: 'server',
        },
      });
    }
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  console.error(err);
  TelemetryService.emitSafe({
    event_type: 'error.reported',
    severity: 'critical',
    metadata: {
      message: err instanceof Error ? err.message : 'Internal server error',
      path: req.path,
      method: req.method,
      source: 'server',
    },
  });
  res.status(500).json({ error: 'Internal server error' });
}
