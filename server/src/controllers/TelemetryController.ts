import type { Response } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { TelemetryService, telemetryBus } from '../services/telemetryService.js';
import { TelemetryBackfillService } from '../services/telemetryBackfillService.js';
import { UsageService } from '../services/usageService.js';
import { unauthorized } from '../lib/errors.js';

const clientErrorSchema = z.object({
  message: z.string().min(1).max(500),
  severity: z.enum(['info', 'warn', 'error', 'critical']).optional().default('error'),
  metadata: z.record(z.unknown()).optional().default({}),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
});

// Simple in-memory rate limit for client-error: 30/min per IP
const clientErrorHits = new Map<string, { count: number; resetAt: number }>();

function allowClientError(ip: string): boolean {
  const now = Date.now();
  const entry = clientErrorHits.get(ip);
  if (!entry || entry.resetAt < now) {
    clientErrorHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count += 1;
  return true;
}

export const TelemetryController = {
  async events(req: AuthedRequest, res: Response) {
    if (req.user) void TelemetryService.logAdminAccess(req.user.id, req.path);
    const result = await TelemetryService.listEvents({
      event_type: typeof req.query.event_type === 'string' ? req.query.event_type : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      actor_user_id: typeof req.query.actor_user_id === 'string' ? req.query.actor_user_id : undefined,
      entity_type: typeof req.query.entity_type === 'string' ? req.query.entity_type : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    res.json(result);
  },

  async rollupsDaily(req: AuthedRequest, res: Response) {
    const to = typeof req.query.to === 'string' ? req.query.to : new Date().toISOString().slice(0, 10);
    const from =
      typeof req.query.from === 'string'
        ? req.query.from
        : new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const rollups = await TelemetryService.listRollups(from, to);
    res.json({ rollups, from, to });
  },

  async health(_req: AuthedRequest, res: Response) {
    const health = await TelemetryService.liveHealth();
    res.json(health);
  },

  async healthHistory(req: AuthedRequest, res: Response) {
    const to = typeof req.query.to === 'string' ? req.query.to : new Date().toISOString();
    const from =
      typeof req.query.from === 'string'
        ? req.query.from
        : new Date(Date.now() - 90 * 86400000).toISOString();
    const history = await TelemetryService.healthHistory(from, to);
    res.json({ history, from, to });
  },

  async stream(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const onEvent = (event: unknown) => {
      res.write(`event: telemetry\ndata: ${JSON.stringify(event)}\n\n`);
    };
    telemetryBus.on('event', onEvent);

    const heartbeat = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      telemetryBus.off('event', onEvent);
    });
  },

  async clientError(req: AuthedRequest, res: Response) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!allowClientError(ip)) {
      res.status(429).json({ error: 'Too many error reports' });
      return;
    }
    const body = clientErrorSchema.parse(req.body);
    await TelemetryService.emit({
      event_type: 'error.reported',
      actor_user_id: req.user?.id,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      severity: body.severity,
      metadata: { ...body.metadata, message: body.message, source: 'client' },
    });
    res.status(201).json({ ok: true });
  },

  async backfill(req: AuthedRequest, res: Response) {
    if (!req.user) throw unauthorized();
    const result = await TelemetryBackfillService.run();
    res.json(result);
  },

  async summary(_req: AuthedRequest, res: Response) {
    res.json(await UsageService.summary());
  },

  async funnel(_req: AuthedRequest, res: Response) {
    res.json(await UsageService.funnel());
  },

  async versus(_req: AuthedRequest, res: Response) {
    res.json(await UsageService.versus());
  },

  async couple(_req: AuthedRequest, res: Response) {
    res.json(await UsageService.couple());
  },

  async invitations(req: AuthedRequest, res: Response) {
    const result = await UsageService.listInvitations(
      req.query.limit ? Number(req.query.limit) : 50,
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    );
    res.json(result);
  },

  async profilesPaged(req: AuthedRequest, res: Response) {
    const result = await UsageService.listProfiles(
      req.query.limit ? Number(req.query.limit) : 50,
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    );
    res.json(result);
  },
};
