import type { AppConfig } from '../config/env.js';
import { createPlatformPlaybackClient } from '../integrations/apple-music/platformPlaybackClient.js';
import { DiscordPresenceClient } from '../integrations/discord/discordPresenceClient.js';
import { findTrackMetadata } from '../integrations/itunes/artworkResolver.js';
import { logger } from '../utils/logger.js';
import { DiscordUpdateThrottle } from './discordUpdateThrottle.js';
import type { TrackInfo } from '../domain/music/types.js';

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const ARTWORK_RETRY_INTERVAL_MS = 60 * 1000;

type PresenceUpdate =
  | Readonly<{ kind: 'clear' }>
  | Readonly<{
      kind: 'track';
      track: TrackInfo;
      artworkUrl: string | null;
      appleMusicUrl: string | null;
    }>;

export const startPresenceSync = async (config: AppConfig): Promise<() => Promise<void>> => {
  const playback = createPlatformPlaybackClient();
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

  const updateThrottle = new DiscordUpdateThrottle<PresenceUpdate>({
    send: async (update) => {
      if (update.kind === 'clear') {
        await presence.clear();
        logger.info('sync', 'Presence cleared');
        return;
      }

      const appliedDynamicArtwork = await presence.setTrack(
        update.track,
        update.artworkUrl,
        update.appleMusicUrl
      );
      usingDynamicArtwork = appliedDynamicArtwork;

      if (appliedDynamicArtwork) {
        logger.info(
          'sync',
          `Presence updated (dynamic): ${update.track.title} - ${update.track.artist}`
        );
      } else {
        logger.info(
          'sync',
          `Presence updated (fallback): ${update.track.title} - ${update.track.artist}`
        );
      }
    },
    onError: (error) => {
      logger.error('sync', 'Discord presence update failed', error);
    }
  });

  const tick = async (): Promise<void> => {
    try {
      const track = await playback.getCurrentTrack();
      if (!track) {
        if (lastKey !== 'none') {
          updateThrottle.schedule({ kind: 'clear' });
          lastKey = 'none';
          usingDynamicArtwork = false;
          lastArtworkRetryAt = 0;
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
        const metadata = config.ENABLE_DYNAMIC_ARTWORK
          ? await findTrackMetadata(track)
          : Object.freeze({ artworkUrl: null, appleMusicUrl: null });
        const artworkUrl = metadata.artworkUrl;
        updateThrottle.schedule({
          kind: 'track',
          track,
          artworkUrl,
          appleMusicUrl: metadata.appleMusicUrl
        });
        usingDynamicArtwork = Boolean(artworkUrl);
        lastKey = currentKey;
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
    updateThrottle.stop();
    await presence.clear();
    presence.destroy();
  };
};
