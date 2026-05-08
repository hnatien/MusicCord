import { describe, expect, it } from 'vitest';
import { createPlatformPlaybackClient } from '../../../src/integrations/apple-music/platformPlaybackClient.js';

describe('createPlatformPlaybackClient', () => {
  it('selects the macOS Apple Music client on darwin', () => {
    expect(createPlatformPlaybackClient('darwin').getCurrentTrack).toEqual(expect.any(Function));
  });

  it('selects the Windows media session client on win32', () => {
    expect(createPlatformPlaybackClient('win32').getCurrentTrack).toEqual(expect.any(Function));
  });

  it('throws a clear error for unsupported platforms', () => {
    expect(() => createPlatformPlaybackClient('linux')).toThrow(
      'Unsupported platform: linux. MusicCord supports macOS and Windows.'
    );
  });
});
