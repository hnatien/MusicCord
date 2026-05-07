import type { AppConfig } from '../config/env.js';
import { findArtworkUrl } from '../integrations/itunes/artworkResolver.js';
import { getCurrentTrack } from '../integrations/apple-music/appleMusicClient.js';
import { DiscordPresenceClient } from '../integrations/discord/discordPresenceClient.js';

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
      console.error(
        'Discord IPC connect failed. Ensure Discord desktop is running and logged in. Retrying in 3s...',
        error
      );
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
          console.log('Presence cleared');
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
        if (trackChanged) {
          console.log(`[sync][track] Changed to ${track.title} - ${track.artist} (${track.status})`);
        }
        if (shouldRetryArtwork) {
          lastArtworkRetryAt = now;
          console.log(`[artwork] Retrying dynamic artwork: ${track.title} - ${track.artist}`);
        }

        if (!config.ENABLE_DYNAMIC_ARTWORK) {
          console.log('[artwork][skip] ENABLE_DYNAMIC_ARTWORK=false, using fallback only');
        }
        const artworkUrl = config.ENABLE_DYNAMIC_ARTWORK ? await findArtworkUrl(track) : null;
        const appliedDynamicArtwork = await presence.setTrack(track, artworkUrl);

        usingDynamicArtwork = appliedDynamicArtwork;
        lastKey = currentKey;

        if (appliedDynamicArtwork) {
          console.log(`Presence updated with dynamic artwork: ${track.title} - ${track.artist}`);
        } else {
          console.log(`Presence updated with fallback artwork: ${track.title} - ${track.artist}`);
        }
      }
    } catch (error) {
      console.error('Tick failed', error);
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
