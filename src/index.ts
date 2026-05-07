import { run } from './app/run.js';
import { logger } from './utils/logger.js';

void run().catch((error) => {
  logger.error('app', 'Startup failed', error);
  process.exit(1);
});
