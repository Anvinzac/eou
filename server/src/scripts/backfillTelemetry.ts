import { TelemetryBackfillService } from '../services/telemetryBackfillService.js';

const result = await TelemetryBackfillService.run();
console.log(JSON.stringify(result, null, 2));
process.exit(0);
