import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PlaybackStatus, TrackInfo } from '../../domain/music/types.js';

const execFileAsync = promisify(execFile);

const parseLocaleNumber = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed) {
    return Number.NaN;
  }

  // AppleScript number text can be locale-formatted (e.g. `207,5`).
  const normalized = trimmed.replace(',', '.');
  return Number(normalized);
};

const SCRIPT = `
tell application "Music"
  if it is running then
    set playerState to player state
    if playerState is playing or playerState is paused then
      set normalizedState to "paused"
      if playerState is playing then
        set normalizedState to "playing"
      end if

      set trackName to name of current track
      set trackArtist to artist of current track
      set trackAlbum to album of current track
      set durationSec to (duration of current track)
      set playerPos to (player position)

      return normalizedState & "||" & trackName & "||" & trackArtist & "||" & trackAlbum & "||" & durationSec & "||" & playerPos
    else
      return "stopped||||||||||"
    end if
  else
    return "stopped||||||||||"
  end if
end tell
`;

export const parseMusicOutput = (raw: string): TrackInfo | null => {
  const [statusRaw = '', title = '', artist = '', album = '', durationRaw = '', positionRaw = ''] =
    raw.trim().split('||');
  const status = statusRaw.toLowerCase() as PlaybackStatus;
  const parsedDuration = parseLocaleNumber(durationRaw);
  const parsedPosition = parseLocaleNumber(positionRaw);
  const durationSeconds = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 0;
  const positionSeconds = Number.isFinite(parsedPosition) && parsedPosition >= 0 ? parsedPosition : 0;

  if (status !== 'playing' && status !== 'paused' && status !== 'stopped') {
    return null;
  }

  if (status === 'stopped') {
    return null;
  }

  if (!title) {
    return null;
  }

  return Object.freeze({
    title,
    artist: artist || 'Unknown Artist',
    album,
    status,
    durationSeconds,
    positionSeconds
  });
};

export const getCurrentTrack = async (): Promise<TrackInfo | null> => {
  const { stdout } = await execFileAsync('osascript', ['-e', SCRIPT]);
  return parseMusicOutput(stdout);
};
