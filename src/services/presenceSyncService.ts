import type { AppConfig } from '../config/env.js';
import { findArtworkUrl } from '../integrations/itunes/artworkResolver.js';
import { getCurrentTrack } from '../integrations/apple-music/appleMusicClient.js';
import { DiscordPresenceClient } from '../integrations/discord/discordPresenceClient.js';
import { logger } from '../utils/logger.js';

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const ARTWORK_RETRY_INTERVAL_MS = 60 * 1000;

export const startPresenceSync = async (config: AppConfig): Promise<() => Promise<void>> => {
  const presence = new DiscordPresenceClient(
    config.DISCORD_CLIENT_ID,
    config.DISCORD_APPLE_MUSIC_ASSET_KEY
  );

  for (;;) {
    try {
      await presence.connect();
      break;
    } catch (error) {
      logger.error('sync', 'Discord IPC connect failed, retry in 3s', error);
      await sleep(3000);
    }
  }

  let lastKey = '';
  let usingDynamicArtwork = false;
  let lastArtworkRetryAt = 0;

  const tick = async (): Promise<void> => {
    try {
      const track = await getCurrentTrack();
      if (!track) {
        if (lastKey !== 'none') {
          await presence.clear();
          lastKey = 'none';
          usingDynamicArtwork = false;
          lastArtworkRetryAt = 0;
          logger.info('sync', 'Presence cleared');
        }
        return;
      }

      const now = Date.now();
      const currentKey = `${track.title}|${track.artist}|${track.album}|${track.status}|${track.durationSeconds}`;
      const trackChanged = currentKey !== lastKey;
      const shouldRetryArtwork =
        config.ENABLE_DYNAMIC_ARTWORK &&
        !trackChanged &&
        !usingDynamicArtwork &&
        now - lastArtworkRetryAt >= ARTWORK_RETRY_INTERVAL_MS;

      if (trackChanged || shouldRetryArtwork) {
        if (shouldRetryArtwork) {
          lastArtworkRetryAt = now;
          logger.info('artwork', `Retry lookup: ${track.title} - ${track.artist}`);
        }

        if (!config.ENABLE_DYNAMIC_ARTWORK) {
          logger.info('artwork', 'Dynamic artwork disabled, use fallback');
        }
        const artworkUrl = config.ENABLE_DYNAMIC_ARTWORK ? await findArtworkUrl(track) : null;
        const appliedDynamicArtwork = await presence.setTrack(track, artworkUrl);

        usingDynamicArtwork = appliedDynamicArtwork;
        lastKey = currentKey;

        if (appliedDynamicArtwork) {
          logger.info('sync', `Presence updated (dynamic): ${track.title} - ${track.artist}`);
        } else {
          logger.info('sync', `Presence updated (fallback): ${track.title} - ${track.artist}`);
        }
      }
    } catch (error) {
      logger.error('sync', 'Tick failed', error);
    }
  };

  await tick();
  const timer = setInterval(() => {
    void tick();
  }, config.POLL_INTERVAL_MS);

  return async () => {
    clearInterval(timer);
    await presence.clear();
    presence.destroy();
  };
};
