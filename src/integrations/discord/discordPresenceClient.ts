import RPC from 'discord-rpc';
import type { TrackInfo } from '../../domain/music/types.js';
import { logger } from '../../utils/logger.js';

type RawActivity = Readonly<{
  type: 0 | 2 | 3 | 5;
  name: string;
  status_display_type?: 0 | 1 | 2;
  details: string;
  state: string;
  timestamps?: Readonly<{
    start?: number;
    end?: number;
  }>;
  assets?: Readonly<{
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  }>;
  buttons?: ReadonlyArray<Readonly<{ label: string; url: string }>>;
  instance: boolean;
}>;

const normalizeDiscordText = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  const safeValue = trimmed || fallback;
  return safeValue.length >= 2 ? safeValue : `${safeValue}​`;
};

const buildAppleMusicSearchUrl = (track: TrackInfo): string => {
  const parts = [track.title, track.artist, track.album].filter((part) => part.trim().length > 0);
  const term = encodeURIComponent(parts.join(' '));
  return `https://music.apple.com/search?term=${term}`;
};

const resolveAppleMusicUrl = (track: TrackInfo, appleMusicUrl?: string | null): string => {
  if (!appleMusicUrl) {
    return buildAppleMusicSearchUrl(track);
  }

  try {
    const parsedUrl = new URL(appleMusicUrl);
    if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
      return parsedUrl.toString();
    }
  } catch {
    return buildAppleMusicSearchUrl(track);
  }

  return buildAppleMusicSearchUrl(track);
};

const buildTrackDetails = (track: TrackInfo): string => {
  const titleLine = normalizeDiscordText(track.title, 'Unknown Track');
  return track.status === 'paused' ? `⏸ ${titleLine}` : titleLine;
};

export const buildTrackActivity = (track: TrackInfo, appleMusicUrl?: string | null): RawActivity => {
  const shouldSetTimestamps =
    track.status === 'playing' && track.durationSeconds > 0 && track.positionSeconds >= 0;
  const timestamps: { start?: number; end?: number } = shouldSetTimestamps
    ? (() => {
        const now = Date.now();
        const start = Math.round(now - track.positionSeconds * 1000);
        const end = Math.round(start + track.durationSeconds * 1000);
        return { start, end };
      })()
    : {};

  return {
    type: 2,
    name: 'Apple Music',
    status_display_type: 2,
    details: buildTrackDetails(track),
    state: normalizeDiscordText(`by ${track.artist}`, 'by Unknown Artist'),
    buttons: [{ label: 'Play on Apple Music', url: resolveAppleMusicUrl(track, appleMusicUrl) }],
    ...(timestamps.start || timestamps.end ? { timestamps } : {}),
    instance: false
  };
};

export const buildTrackAssets = (
  track: TrackInfo,
  largeImage: string,
  appleMusicAssetKey: string
): NonNullable<RawActivity['assets']> => {
  const smallImageKey = appleMusicAssetKey.trim();

  return {
    large_image: largeImage,
    large_text: track.album || 'Apple Music',
    ...(smallImageKey && smallImageKey !== largeImage
      ? {
          small_image: smallImageKey,
          small_text: 'Apple Music'
        }
      : {})
  };
};

export class DiscordPresenceClient {
  private readonly client: RPC.Client;

  public constructor(
    private readonly clientId: string,
    private readonly appleMusicAssetKey: string
  ) {
    RPC.register(clientId);
    this.client = new RPC.Client({ transport: 'ipc' });
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onReady = (): void => {
        resolve();
      };
      this.client.once('ready', onReady);
      this.client.login({ clientId: this.clientId }).catch((error: unknown) => {
        this.client.removeListener('ready', onReady);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  public async setTrack(
    track: TrackInfo,
    artworkUrl?: string | null,
    appleMusicUrl?: string | null
  ): Promise<boolean> {
    const trackLabel = `${track.title} - ${track.artist}`;
    const baseActivity = buildTrackActivity(track, appleMusicUrl);

    if (artworkUrl) {
      try {
        await this.setRawActivity({
          ...baseActivity,
          assets: buildTrackAssets(track, artworkUrl, this.appleMusicAssetKey)
        });
        return true;
      } catch (error) {
        logger.warn('presence', `Dynamic artwork rejected, retry mp: ${trackLabel}`, error);
      }

      try {
        const mediaProxyArtworkUrl = `mp:${artworkUrl}`;
        await this.setRawActivity({
          ...baseActivity,
          assets: buildTrackAssets(track, mediaProxyArtworkUrl, this.appleMusicAssetKey)
        });
        return true;
      } catch (error) {
        logger.warn('presence', `MP artwork rejected: ${trackLabel}`, error);
      }
    }

    const fallbackImageKey = this.appleMusicAssetKey.trim();
    await this.setRawActivity(
      fallbackImageKey
        ? {
            ...baseActivity,
            assets: buildTrackAssets(track, fallbackImageKey, this.appleMusicAssetKey)
          }
        : baseActivity
    );

    return false;
  }

  private async setRawActivity(activity: RawActivity): Promise<void> {
    const rpcClient = this.client as unknown as {
      request: (command: string, args: unknown) => Promise<unknown>;
    };
    await rpcClient.request('SET_ACTIVITY', {
      pid: process.pid,
      activity
    });
  }

  public async clear(): Promise<void> {
    await this.client.clearActivity();
  }

  public destroy(): void {
    void this.client.destroy();
  }
}
