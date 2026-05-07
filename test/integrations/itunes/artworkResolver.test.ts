import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __testables__,
  findArtworkUrl,
  toHighResArtworkUrl
} from '../../../src/integrations/itunes/artworkResolver.js';

describe('toHighResArtworkUrl', () => {
  it('upscales itunes artwork url to 512', () => {
    expect(
      toHighResArtworkUrl('https://is1-ssl.mzstatic.com/image/thumb/Music/100x100bb.jpg')
    ).toBe('https://is1-ssl.mzstatic.com/image/thumb/Music/512x512bb.jpg');
  });
});

describe('findArtworkUrl cache behavior', () => {
  beforeEach(() => {
    __testables__.cache.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries after miss TTL expires', async () => {
    const track = {
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      status: 'playing' as const,
      durationSeconds: 200,
      positionSeconds: 10
    };

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCount: 1,
          results: [{ artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/100x100bb.jpg' }]
        })
      } as Response);

    vi.stubGlobal('fetch', fetchMock);

    await expect(findArtworkUrl(track)).resolves.toBeNull();
    await expect(findArtworkUrl(track)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(__testables__.MISS_TTL_MS + 1);

    await expect(findArtworkUrl(track)).resolves.toBe(
      'https://is1-ssl.mzstatic.com/image/thumb/Music/512x512bb.jpg'
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
