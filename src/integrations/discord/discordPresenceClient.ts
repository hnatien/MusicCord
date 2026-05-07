import RPC from 'discord-rpc';
import type { TrackInfo } from '../../domain/music/types.js';

type RawActivity = Readonly<{
  type: 0 | 2 | 3 | 5;
  details: string;
  state: string;
  timestamps?: Readonly<{
    start?: number;
    end?: number;
  }>;
  assets?: Readonly<{
    large_image?: string;
    large_text?: string;
  }>;
  buttons?: ReadonlyArray<Readonly<{ label: string; url: string }>>;
  instance: boolean;
}>;

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
      this.client.once('ready', () => resolve());
      this.client.login({ clientId: this.clientId }).catch(reject);
    });
  }

  public async setTrack(track: TrackInfo, artworkUrl?: string | null): Promise<boolean> {
    const trackLabel = `${track.title} - ${track.artist}`;
    const shouldSetTimestamps =
      (track.status === 'playing' || track.status === 'paused') &&
      track.durationSeconds > 0 &&
      track.positionSeconds >= 0;
    const timestamps: { start?: number; end?: number } = shouldSetTimestamps
      ? (() => {
          const now = Date.now();
          const start = Math.round(now - track.positionSeconds * 1000);
          const end = Math.round(start + track.durationSeconds * 1000);
          return { start, end };
        })()
      : {};
    const state = `by ${track.artist}`;
    const baseActivity: RawActivity = {
      type: 2,
      details: track.title,
      state,
      buttons: [{ label: 'Open Apple Music', url: 'https://music.apple.com' }],
      ...(timestamps.start || timestamps.end ? { timestamps } : {}),
      instance: false
    };

    if (artworkUrl) {
      try {
        console.log(`[presence][set] Trying dynamic artwork URL for ${trackLabel}: ${artworkUrl}`);
        await this.setRawActivity({
          ...baseActivity,
          assets: {
            large_image: artworkUrl,
            large_text: track.album || 'Apple Music'
          }
        });
        console.log(`[presence][success] Dynamic artwork applied for ${trackLabel}`);
        return true;
      } catch (error) {
        console.warn(
          `[presence][error] Discord rejected direct artwork URL for ${trackLabel}, retrying with mp: prefix`,
          error
        );
      }

      try {
        const mediaProxyArtworkUrl = `mp:${artworkUrl}`;
        console.log(
          `[presence][set] Trying dynamic artwork via media proxy for ${trackLabel}: ${mediaProxyArtworkUrl}`
        );
        await this.setRawActivity({
          ...baseActivity,
          assets: {
            large_image: mediaProxyArtworkUrl,
            large_text: track.album || 'Apple Music'
          }
        });
        console.log(`[presence][success] Dynamic artwork applied via media proxy for ${trackLabel}`);
        return true;
      } catch (error) {
        console.warn(
          `[presence][error] Discord rejected media proxy artwork for ${trackLabel}`,
          error
        );
      }
    } else {
      console.log(`[presence][skip] No dynamic artwork URL for ${trackLabel}, using fallback`);
    }

    const fallbackImageKey = this.appleMusicAssetKey.trim();
    const fallbackLabel = fallbackImageKey || '(none)';
    console.log(`[presence][set] Applying fallback artwork for ${trackLabel}: ${fallbackLabel}`);
    await this.setRawActivity(
      fallbackImageKey
        ? {
            ...baseActivity,
            assets: {
              large_image: fallbackImageKey,
              large_text: track.album || 'Apple Music'
            }
          }
        : baseActivity
    );
    console.log(`[presence][success] Fallback presence applied for ${trackLabel}`);

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
