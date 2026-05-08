import { describe, expect, it, vi } from 'vitest';
import { buildTrackActivity } from '../../../src/integrations/discord/discordPresenceClient.js';
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
      instance: false
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
});
