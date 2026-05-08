import type { TrackInfo } from '../domain/music/types.js';

export type MusicPlaybackClient = Readonly<{
  getCurrentTrack: () => Promise<TrackInfo | null>;
}>;
