import { run } from './app/run.js';

void run().catch((error) => {
  console.error('Startup failed', error);
  process.exit(1);
});
