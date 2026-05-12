import type { AppConfig } from '../config/env.js';
import { createPlatformPlaybackClient } from '../integrations/apple-music/platformPlaybackClient.js';
import { DiscordPresenceClient } from '../integrations/discord/discordPresenceClient.js';
import { findTrackMetadata } from '../integrations/itunes/artworkResolver.js';
import { logger } from '../utils/logger.js';
import { DiscordUpdateThrottle } from './discordUpdateThrottle.js';
import type { TrackInfo } from '../domain/music/types.js';

const sleep = async (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const ARTWORK_RETRY_INTERVAL_MS = 60 * 1000;
const POSITION_DRIFT_THRESHOLD_SECONDS = 3;
const CONNECT_BACKOFF_MS = [3000, 6000, 12000, 30000] as const;

type PresenceUpdate =
  | Readonly<{ kind: 'clear' }>
  | Readonly<{
      kind: 'track';
      track: TrackInfo;
      artworkUrl: string | null;
      appleMusicUrl: string | null;
    }>;

const connectWithBackoff = async (
  presence: DiscordPresenceClient,
  signal: AbortSignal
): Promise<void> => {
  let attempt = 0;
  for (;;) {
    if (signal.aborted) {
      throw new Error('aborted');
    }
    try {
      await presence.connect();
      return;
    } catch (error) {
      const delay = CONNECT_BACKOFF_MS[Math.min(attempt, CONNECT_BACKOFF_MS.length - 1)];
      logger.error('sync', `Discord IPC connect failed, retry in ${delay}ms`, error);
      attempt += 1;
      await sleep(delay, signal);
    }
  }
};

export const startPresenceSync = async (config: AppConfig): Promise<() => Promise<void>> => {
  const playback = createPlatformPlaybackClient();
  const presence = new DiscordPresenceClient(
    config.DISCORD_CLIENT_ID,
    config.DISCORD_APPLE_MUSIC_ASSET_KEY
  );

  const abortController = new AbortController();
  try {
    await connectWithBackoff(presence, abortController.signal);
  } catch (error) {
    presence.destroy();
    throw error;
  }

  if (!config.ENABLE_DYNAMIC_ARTWORK) {
    logger.info('artwork', 'Dynamic artwork disabled, using fallback Apple Music icon');
  }

  let lastKey = '';
  let lastPosition = 0;
  let lastPositionAt = 0;
  let usingDynamicArtwork = false;
  let lastArtworkRetryAt = 0;

  const updateThrottle = new DiscordUpdateThrottle<PresenceUpdate>({
    send: async (update) => {
      if (update.kind === 'clear') {
        await presence.clear();
        usingDynamicArtwork = false;
        logger.info('sync', 'Presence cleared');
        return;
      }

      const appliedDynamicArtwork = await presence.setTrack(
        update.track,
        update.artworkUrl,
        update.appleMusicUrl
      );
      usingDynamicArtwork = appliedDynamicArtwork;

      logger.info(
        'sync',
        `Presence updated (${appliedDynamicArtwork ? 'dynamic' : 'fallback'}): ${update.track.title} - ${update.track.artist}`
      );
    },
    onError: (error) => {
      logger.error('sync', 'Discord presence update failed', error);
    }
  });

  let tickInFlight = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const tick = async (): Promise<void> => {
    try {
      const track = await playback.getCurrentTrack();
      if (!track) {
        if (lastKey !== 'none') {
          updateThrottle.schedule({ kind: 'clear' });
          lastKey = 'none';
          lastPosition = 0;
          lastPositionAt = 0;
          lastArtworkRetryAt = 0;
        }
        return;
      }

      const now = Date.now();
      const currentKey = `${track.title}|${track.artist}|${track.album}|${track.status}|${track.durationSeconds}`;
      const trackChanged = currentKey !== lastKey;
      const elapsedSinceLastSample = lastPositionAt > 0 ? (now - lastPositionAt) / 1000 : 0;
      const expectedPosition = lastPosition + elapsedSinceLastSample;
      const positionDrifted =
        !trackChanged &&
        track.status === 'playing' &&
        lastPositionAt > 0 &&
        Math.abs(track.positionSeconds - expectedPosition) > POSITION_DRIFT_THRESHOLD_SECONDS;
      const shouldRetryArtwork =
        config.ENABLE_DYNAMIC_ARTWORK &&
        !trackChanged &&
        !usingDynamicArtwork &&
        now - lastArtworkRetryAt >= ARTWORK_RETRY_INTERVAL_MS;

      if (trackChanged || shouldRetryArtwork || positionDrifted) {
        if (shouldRetryArtwork) {
          lastArtworkRetryAt = now;
          logger.info('artwork', `Retry lookup: ${track.title} - ${track.artist}`);
        }

        const metadata = config.ENABLE_DYNAMIC_ARTWORK
          ? await findTrackMetadata(track, { bypassCache: shouldRetryArtwork })
          : Object.freeze({ artworkUrl: null, appleMusicUrl: null });
        updateThrottle.schedule({
          kind: 'track',
          track,
          artworkUrl: metadata.artworkUrl,
          appleMusicUrl: metadata.appleMusicUrl
        });
        lastKey = currentKey;
        lastPosition = track.positionSeconds;
        lastPositionAt = now;
      }
    } catch (error) {
      logger.error('sync', 'Tick failed', error);
    }
  };

  const scheduleNextTick = (): void => {
    if (stopped) {
      return;
    }
    pollTimer = setTimeout(() => {
      pollTimer = null;
      void runTick();
    }, config.POLL_INTERVAL_MS);
  };

  const runTick = async (): Promise<void> => {
    if (tickInFlight) {
      scheduleNextTick();
      return;
    }
    tickInFlight = true;
    try {
      await tick();
    } finally {
      tickInFlight = false;
      scheduleNextTick();
    }
  };

  await runTick();

  return async () => {
    stopped = true;
    abortController.abort();
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    updateThrottle.stop();
    try {
      await presence.clear();
    } catch (error) {
      logger.warn('sync', 'Failed to clear presence on shutdown', error);
    }
    presence.destroy();
  };
};
