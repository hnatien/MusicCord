import { describe, expect, it, vi } from 'vitest';
import {
  buildTrackActivity,
  buildTrackAssets
} from '../../../src/integrations/discord/discordPresenceClient.js';
import type { TrackInfo } from '../../../src/domain/music/types.js';

describe('buildTrackActivity', () => {
  it('uses Apple Music as the Discord activity name', () => {
    const track: TrackInfo = {
      title: 'Song Name',
      artist: 'Artist Name',
      album: 'Album Name',
      status: 'playing',
      durationSeconds: 180,
      positionSeconds: 30
    };

    expect(buildTrackActivity(track)).toMatchObject({
      type: 2,
      name: 'Apple Music',
      status_display_type: 2,
      details: 'Song Name',
      state: 'by Artist Name',
      buttons: [
        {
          label: 'Play on Apple Music',
          url: 'https://music.apple.com/search?term=Song%20Name%20Artist%20Name%20Album%20Name'
        }
      ],
      instance: false
    });
  });

  it('uses a resolved Apple Music track URL for the button', () => {
    const track: TrackInfo = {
      title: 'Song Name',
      artist: 'Artist Name',
      album: 'Album Name',
      status: 'playing',
      durationSeconds: 180,
      positionSeconds: 30
    };

    expect(
      buildTrackActivity(track, 'https://music.apple.com/us/album/song-name/123?i=456').buttons
    ).toEqual([
      {
        label: 'Play on Apple Music',
        url: 'https://music.apple.com/us/album/song-name/123?i=456'
      }
    ]);
  });

  it('pads one-character titles so Discord accepts the activity details', () => {
    const track: TrackInfo = {
      title: '瞬',
      artist: 'Zheng Runze',
      album: 'Album Name',
      status: 'playing',
      durationSeconds: 180,
      positionSeconds: 30
    };

    expect(buildTrackActivity(track)).toMatchObject({
      details: '瞬​',
      state: 'by Zheng Runze'
    });
  });

  it('keeps playback timestamps for active tracks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T00:00:00.000Z'));

    const track: TrackInfo = {
      title: 'Song Name',
      artist: 'Artist Name',
      album: 'Album Name',
      status: 'playing',
      durationSeconds: 180,
      positionSeconds: 30
    };

    expect(buildTrackActivity(track).timestamps).toEqual({
      start: Date.parse('2026-05-07T23:59:30.000Z'),
      end: Date.parse('2026-05-08T00:02:30.000Z')
    });

    vi.useRealTimers();
  });

  it('shows paused text before the title and omits timestamps so Discord does not keep advancing progress', () => {
    const track: TrackInfo = {
      title: 'Song Name',
      artist: 'Artist Name',
      album: 'Album Name',
      status: 'paused',
      durationSeconds: 180,
      positionSeconds: 30
    };

    expect(buildTrackActivity(track)).toMatchObject({
      details: '⏸ Song Name',
      state: 'by Artist Name'
    });
    expect(buildTrackActivity(track)).not.toHaveProperty('timestamps');
  });
});

describe('buildTrackAssets', () => {
  it('adds the Apple Music logo as the small activity image when album artwork is used', () => {
    const track: TrackInfo = {
      title: 'Song Name',
      artist: 'Artist Name',
      album: 'Album Name',
      status: 'playing',
      durationSeconds: 180,
      positionSeconds: 30
    };

    expect(buildTrackAssets(track, 'https://example.com/artwork.jpg', 'apple-music-logo')).toEqual({
      large_image: 'https://example.com/artwork.jpg',
      large_text: 'Album Name',
      small_image: 'apple-music-logo',
      small_text: 'Apple Music'
    });
  });

  it('does not duplicate the Apple Music logo when it is already the large image', () => {
    const track: TrackInfo = {
      title: 'Song Name',
      artist: 'Artist Name',
      album: 'Album Name',
      status: 'playing',
      durationSeconds: 180,
      positionSeconds: 30
    };

    expect(buildTrackAssets(track, 'apple-music-logo', 'apple-music-logo')).toEqual({
      large_image: 'apple-music-logo',
      large_text: 'Album Name'
    });
  });
});
