import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './lib/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLatency } from './middleware/requestLatency.js';
import { asyncHandler } from './lib/asyncHandler.js';
import { ShareController } from './controllers/ShareController.js';

// Same folder from src/ (tsx) and dist/ (compiled): server/public.
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLatency);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Short links and their link-preview images live outside /api so the URLs stay short.
  app.get('/s/:code', asyncHandler(ShareController.visit));
  app.use('/og', express.static(path.join(publicDir, 'og'), { maxAge: '7d' }));

  app.use('/api', apiRouter);
  app.use(errorHandler);

  return app;
}
