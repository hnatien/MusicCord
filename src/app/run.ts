import { loadConfig } from '../config/env.js';
import { startPresenceSync } from '../services/presenceSyncService.js';

export const run = async (): Promise<void> => {
  const config = loadConfig();
  const stop = await startPresenceSync(config);
  let isShuttingDown = false;

  const shutdown = async (): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    try {
      await stop();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
};
