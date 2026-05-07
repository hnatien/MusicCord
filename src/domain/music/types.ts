export type PlaybackStatus = 'playing' | 'paused' | 'stopped';

export type TrackInfo = Readonly<{
  title: string;
  artist: string;
  album: string;
  status: PlaybackStatus;
  durationSeconds: number;
  positionSeconds: number;
}>;
