import type { NextFunction, Request, Response } from 'express';
import { TelemetryService } from '../services/telemetryService.js';

/** Records request latency into the health ring buffer. */
export function requestLatency(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  res.on('finish', () => {
    TelemetryService.recordLatency(Date.now() - started, res.statusCode);
  });
  next();
}
