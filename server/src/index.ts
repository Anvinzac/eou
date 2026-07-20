import { createApp } from './app.js';
import { env } from './lib/env.js';
import { TelemetryService } from './services/telemetryService.js';

const app = createApp();

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});

// Persist health snapshots every 5 minutes; prune old events daily.
const FIVE_MIN = 5 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

setInterval(() => {
  void TelemetryService.persistHealthSnapshot().catch((err) => {
    console.error('[telemetry] health snapshot failed', err);
  });
}, FIVE_MIN);

setInterval(() => {
  void TelemetryService.pruneOldEvents(90).catch((err) => {
    console.error('[telemetry] prune failed', err);
  });
}, ONE_DAY);

// Capture an initial snapshot shortly after boot
setTimeout(() => {
  void TelemetryService.persistHealthSnapshot().catch(() => undefined);
}, 3000);
