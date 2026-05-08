import { getCurrentTrack as getCurrentAppleMusicTrack } from './appleMusicClient.js';
import { createWindowsMediaSessionClient } from '../windows/windowsMediaSessionClient.js';
import type { MusicPlaybackClient } from '../musicPlaybackClient.js';

export const createPlatformPlaybackClient = (
  platform: NodeJS.Platform = process.platform
): MusicPlaybackClient => {
  if (platform === 'darwin') {
    return Object.freeze({
      getCurrentTrack: getCurrentAppleMusicTrack
    });
  }

  if (platform === 'win32') {
    return createWindowsMediaSessionClient();
  }

  throw new Error(`Unsupported platform: ${platform}. MusicCord supports macOS and Windows.`);
};
